// The calculator's own sentences (reasons, suggestions, warnings, why a method does not apply) in the report's
// language. sum-lib writes them in English with a code and the numbers as params; English reports use that text as
// it is, Ukrainian reports rebuild it here. An unknown code falls back to the English text.

// Ukrainian noun forms after a number: 1 помилка, 2–4 помилки, 5+ (and 11–14) помилок.
export function uaPlural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const UA_WARNINGS = {
  'small-n': ({ n }) => `Лише ${n} ${uaPlural(n, 'спроба', 'спроби', 'спроб')}; кожна складова має широкий діапазон невизначеності.`,
  'errors-not-predefined': () => 'Не підтверджено, що можливі помилки визначили до дослідження; складова помилок може бути ненадійною.',
  'failed-time-excluded': ({ failed }) => `${failed} ${uaPlural(failed, 'невдалу спробу', 'невдалі спроби', 'невдалих спроб')} не враховано в часі; час описує лише успішні спроби.`,
  'sigma-shift': ({ shift }) => `Застосовано зсув на ${String(shift).replace('.', ',')} сигми; оцінки не можна порівнювати із SUM без зсуву.`,
  smoothing: () => 'До часток застосовано згладжування за Лапласом ((x+0,5)/(n+1)); це не оригінальна SUM.',
  'incomplete-rows': ({ n }) => `${n} ${uaPlural(n, 'рядок', 'рядки', 'рядків')} без однієї з чотирьох відповідей не враховано.`,
  'bootstrap-skips': ({ skipped, B }) => `${skipped} з ${B} бутстреп-вибірок дали невизначену оцінку; діапазон наближений.`,
  'previous-differs': ({ list }) => `Контракт відрізняється від попередньої хвилі (${list}), тож хвилі не можна порівнювати напряму.`,
  'gate-ignores-time': ({ timeTargets, satTarget }) => {
    const unused = [timeTargets ? 'цілі за часом' : null, satTarget ? 'ціль задоволеності' : null].filter(Boolean);
    return `Оцінка зручності враховує, хто виконав завдання й оцінив відчуття часу, легкість і задоволеність не нижче порогів. Виміряний час на завдання в неї не входить${unused.length ? `, як і ${unused.join(' та ')} (їх використано лише для порівняння з іншими методами)` : ''}.`;
  },
  'mixed-design': ({ shared, group, vs }) => `${shared} ${uaPlural(shared, 'учасник брав', 'учасники брали', 'учасників брали')} участь і в ${vs}, і в ${group}, решта — лише в одній групі. Різниця враховує результати кожної людини разом; перевірте, що дослідження проводили саме так.`,
  'completion-extreme': ({ pct, x, n }) => `Частка успіху ${pct}% (${x}/${n}); її z-оцінка нескінченна. Оберіть згладжування (laplace) або усереднення відсотків.`,
  'errors-extreme': ({ pct }) => `Частка дій без помилок ${pct}%; її z-оцінка нескінченна. Оберіть згладжування (laplace) або усереднення відсотків.`,
};

const UA_REASONS = {
  'previous-run': ({ differences }) => `Є попередня хвиля цього дослідження. Той самий метод і ті самі цілі зберігають порівнянність хвиль.${differences ? ` Але контракт відрізняється від неї (${differences}), тож хвилі не можна порівнювати напряму.` : ''}`,
  'goal-gate': () => 'Мета — поріг «пройдено / не пройдено», і є всі чотири оцінки; частка людей, які пройшли все, — найзрозуміліша відповідь.',
  errors: (p) => ({
    usable: 'Можливі помилки визначили до дослідження, тож помилки можна надійно рахувати.',
    'not-predefined': 'Помилки є, але їхні можливості не визначили до дослідження, тому помилки не враховано (Microsoft і Autodesk вважали їх ненадійними).',
    none: 'Даних про помилки немає; використано SUM із трьох складових.',
  })[p?.case],
  'completion-benchmark': ({ pct }) => `Задано орієнтир успішності (${pct}%); поправка Пірсона робить цей орієнтир нейтральною точкою 50%.`,
  'time-target': () => 'Ціль за часом не задано; за підходом Autodesk ціль — 80-й процентиль часу задоволених учасників, які виконали завдання (75% ліміту часу, якщо їх 3 або менше).',
  measuringu: () => 'Результати порівнюватимуть із числами MeasuringU, які усереднюють відсотки складових.',
  extremes: ({ tasks }, decision) => `Завдання ${tasks} мають 0% або 100% для частки, тож її z-оцінка нескінченна. ${decision === 'smoothing=laplace' ? 'Обрано згладжування за Лапласом; воно робить оцінку скінченною і позначене у звіті.' : 'Обрано усереднення відсотків; для часток воно не потребує z-оцінки.'}`,
  default: () => 'Ні дані, ні мета не вимагають іншого варіанта; SUM із трьох складових — найстабільніший типовий вибір.',
};

const UA_SUGGESTIONS = {
  'Show sum3 next to it for gradation (it is in the sensitivity table).': 'Покажіть поруч sum3 для градації (вона є в таблиці чутливості).',
  'No pass mark (gate_threshold) was agreed, so the score is reported without a target: as the share of people who passed everything, with its range.': 'Прохідну частку (gate_threshold) не погоджено, тож оцінку подано без цілі: як частку людей, які пройшли все, з діапазоном.',
  'With this many tasks, pca-entropy (data-driven weights) could rank tasks against each other. It is planned for v2 and gives dataset-relative scores.': 'За такої кількості завдань pca-entropy (ваги з даних) могла б ранжувати завдання між собою. Її заплановано у v2; вона дає оцінки відносно конкретного набору даних.',
  'Accessibility data is present: report it as a separate pass/fail gate next to SUM, not blended into it (SUMA has no validated formula yet).': 'Є дані про доступність: подавайте їх окремим порогом «пройдено / не пройдено» поруч із SUM, а не змішуйте з нею (для SUMA ще немає перевіреної формули).',
};

const UA_NEEDS = {
  'time-target': () => 'ціль за часом (time_target_s або expert_time_s з expert_multiplier)',
  'empirical-needs-sat-target': () => 'ціль задоволеності, щоб знайти задоволених учасників для емпіричної цілі за часом',
  'empirical-time-impossible': ({ n }) => `емпірична ціль за часом, для якої потрібні 4 задоволені учасники, що виконали завдання, або cutoff_s (знайдено ${n}, ліміту немає)`,
  'completion-benchmark': ({ mode }) => `орієнтир успішності (completion_benchmark) для поправки ${mode}`,
  cutoff: () => 'ліміт часу (cutoff_s), щоб рахувати невдалі спроби за лімітом',
  'sat-target': () => 'ціль задоволеності (sat_target)',
  thresholds: () => 'пороги для perceived_time, ease і satisfaction (типові 3/4/4 розраховані на 5-бальні шкали)',
};

const UA_NOT_APPLICABLE = {
  'no-error-data': () => 'немає даних про помилки',
  'errors-not-predefined': () => 'можливі помилки не визначили до дослідження',
  'no-benchmark': () => 'немає орієнтира успішності',
  'completion-extreme': ({ pct, x, n }) => `частка успіху ${pct}% (${x}/${n}), z-оцінка нескінченна`,
  'errors-extreme': ({ pct }) => `частка дій без помилок ${pct}%, z-оцінка нескінченна`,
};

const UA_TIME_SOURCES = [
  [/^contract target$/, () => 'ціль із контракту'],
  [/^previous wave$/, () => 'попередня хвиля'],
  [/^expert time (\S+) s × (\S+)$/, (m) => `час експерта ${m[1]} с × ${m[2]}`],
  [/^empirical: 80th percentile of (\d+) satisfied successful users$/, (m) => `емпірично: 80-й процентиль часу ${m[1]} задоволених учасників, що виконали завдання`],
  [/^empirical fallback: 75% of the (\S+) s cutoff \((\d+) satisfied successful users\)$/, (m) => `емпіричний запасний варіант: 75% ліміту ${m[1]} с (${m[2]} задоволених учасників, що виконали завдання)`],
];

const ua = (lang) => lang === 'ua';
const call = (table, code, params, ...rest) => (table[code] ? table[code](params ?? {}, ...rest) : undefined);

export function warningText(w, lang) {
  return (ua(lang) && call(UA_WARNINGS, w.code, w.params)) || w.message;
}

export function whereText(w, lang) {
  if (!ua(lang)) return w.where;
  if (w.task !== undefined) return `${w.group ? `група ${w.group}, ` : ''}завдання ${w.task}`;
  if (w.group) return `група ${w.group}`;
  return { 'all tasks': 'усі завдання', contract: 'контракт' }[w.where] ?? w.where;
}

export function reasonText(r, lang) {
  return (ua(lang) && call(UA_REASONS, r.rule, r.params, r.decision)) || r.why;
}

export function suggestionText(s, lang) {
  return (ua(lang) && UA_SUGGESTIONS[s]) || s;
}

function needText(m, lang) {
  const text = ua(lang) && call(UA_NEEDS, m.code, m.params);
  if (!text) return m.text;
  return m.group !== null && m.group !== undefined && m.text.endsWith(`(group ${m.group})`) ? `${text} (група ${m.group})` : text;
}

export function notApplicableText(s, lang) {
  if (!ua(lang)) return s.reason;
  if (s.code === 'needs' && s.missing) return `бракує: ${s.missing.map((m) => needText(m, lang)).join('; ')}`;
  return call(UA_NOT_APPLICABLE, s.code, s.params) ?? s.reason;
}

export function timeSourceText(source, lang) {
  if (!ua(lang)) return source;
  for (const [re, f] of UA_TIME_SOURCES) {
    const m = re.exec(source);
    if (m) return f(m);
  }
  return source;
}
