// RFC 4180 CSV reading and writing. A table is { header: string[], rows: string[][] }.

export function parseRecords(text, delimiter = ',') {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); records.push(row); }
  return records;
}

export function parseCsv(text, delimiter = ',') {
  const [header = [], ...rows] = parseRecords(text, delimiter);
  return { header, rows };
}

const quote = (v, delimiter) => {
  const s = v === null || v === undefined ? '' : String(v);
  return s.includes(delimiter) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv({ header, rows }, delimiter = ',') {
  return [header, ...rows].map((r) => r.map((v) => quote(v, delimiter)).join(delimiter)).join('\n') + '\n';
}

// Picks the delimiter that splits the first lines into the most consistent number of fields (more than one).
export function sniffDelimiter(text) {
  const sample = parseRecords(text.slice(0, 20000), '\u0000').slice(0, 20).map((r) => r[0]);
  let best = ',';
  let bestScore = -1;
  for (const d of [',', ';', '\t', '|']) {
    const counts = sample.filter((l) => l.trim() !== '').map((l) => parseRecords(l, d)[0]?.length ?? 0);
    if (!counts.length || counts[0] < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = consistent * 100 + counts[0];
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}
