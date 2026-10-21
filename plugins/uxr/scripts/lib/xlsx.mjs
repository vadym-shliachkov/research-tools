// Zero-dependency .xlsx reader: unzips the workbook and reads shared strings, styles and sheet cells.
// Cells formatted as time or date are returned the way Excel shows them (h:mm, m:ss, h:mm:ss, YYYY-MM-DD), not as
// serial numbers.
import zlib from 'node:zlib';

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file (no end-of-directory record)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { method, size, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
    const data = buf.subarray(start, start + e.size);
    if (e.method === 0) return data.toString('utf8');
    if (e.method === 8) return zlib.inflateRawSync(data).toString('utf8');
    throw new Error(`unsupported zip compression method ${e.method}`);
  };
}

const decodeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&');
const attr = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');

// Built-in time formats by what they show: h:mm (18, 20), mm:ss (45, 47) or h:mm:ss (19, 21, 46).
const TIME_IDS = new Map([[18, 'h:mm'], [20, 'h:mm'], [45, 'm:ss'], [47, 'm:ss'], [19, 'h:mm:ss'], [21, 'h:mm:ss'], [46, 'h:mm:ss']]);
const DATE_IDS = new Set([14, 15, 16, 17, 22]);

// Each style becomes 'date', a time shape ('h:mm', 'm:ss', 'h:mm:ss') or null.
function formatKinds(stylesXml) {
  const custom = new Map();
  for (const m of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) custom.set(Number(attr(m[0], 'numFmtId')), decodeXml(attr(m[0], 'formatCode') ?? ''));
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? '';
  return [...xfs.matchAll(/<xf\s[^>]*?\/?>/g)].map((m) => {
    const id = Number(attr(m[0], 'numFmtId') ?? 0);
    if (TIME_IDS.has(id)) return TIME_IDS.get(id);
    if (DATE_IDS.has(id)) return 'date';
    const raw = custom.get(id) ?? '';
    const code = raw.replace(/"[^"]*"|\\./g, '').replace(/\[(?![hms]+\])[^\]]*\]/gi, '');
    if (/[dy]/i.test(code)) return 'date';
    const h = /h/i.test(code);
    const s = /s/i.test(code);
    if (h || s || (/m/i.test(code) && /:/.test(code))) return h && s ? 'h:mm:ss' : h ? 'h:mm' : 'm:ss';
    return null;
  });
}

const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

// Written in the shape the cell shows, so a two-part value stays ambiguous and gets asked about: "1:03" typed into an
// h:mm cell may have meant 1 min 3 s. Seconds that the shape would hide fall back to h:mm:ss.
function excelTime(serial, shape = 'h:mm:ss') {
  const total = Math.round(serial * 86400);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (x) => String(x).padStart(2, '0');
  if (shape === 'h:mm' && s === 0) return `${h}:${two(m)}`;
  if (shape === 'm:ss' && h === 0) return `${m}:${two(s)}`;
  return `${h}:${two(m)}:${two(s)}`;
}
const excelDate = (serial) => new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000)).toISOString().slice(0, 10);

export function readWorkbook(buf) {
  const read = unzip(buf);
  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new Error('not an Excel workbook (xl/workbook.xml is missing)');
  const rels = read('xl/_rels/workbook.xml.rels') ?? '';
  const targets = new Map([...rels.matchAll(/<Relationship\s[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const sheets = [...workbook.matchAll(/<sheet\s[^>]*>/g)].map((m) => {
    const target = targets.get(attr(m[0], 'r:id')) ?? '';
    return { name: decodeXml(attr(m[0], 'name') ?? ''), path: target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}` };
  });
  const shared = [...(read('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const kinds = formatKinds(read('xl/styles.xml') ?? '');

  const readSheet = (name) => {
    const sheet = sheets.find((s) => s.name === name);
    if (!sheet) throw new Error(`no sheet named "${name}"`);
    const xml = read(sheet.path) ?? '';
    const rows = [];
    const formatted = { time: 0, date: 0 };
    for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const r = Number(attr(rm[0], 'r')) - 1;
      const row = [];
      for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const open = `<c${cm[1]}>`;
        const ref = attr(open, 'r');
        const type = attr(open, 't');
        const style = Number(attr(open, 's') ?? 0);
        const inner = cm[2] ?? '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let value = '';
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = textOf(inner);
        else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else if (type === 'str' || type === 'e') value = decodeXml(v ?? '');
        else if (v !== undefined) {
          const kind = kinds[style];
          const num = Number(v);
          if (kind && kind !== 'date') { value = excelTime(num, kind); formatted.time++; }
          else if (kind === 'date' && num < 1) { value = excelTime(num); formatted.time++; }
          else if (kind === 'date') { value = excelDate(num); formatted.date++; }
          else value = String(num);
        }
        row[ref ? colIndex(ref) : row.length] = value;
      }
      rows[r] = Array.from(row, (x) => x ?? '');
    }
    return { rows: Array.from(rows, (x) => x ?? []), formatted };
  };

  return { sheetNames: sheets.map((s) => s.name), readSheet };
}
