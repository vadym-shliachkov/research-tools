# The "How to understand your results" document

A short document for a broad audience: product managers, designers, executives. It explains *these* results without statistics. You write the draft from `facts.json`; the plain-language editor rewrites it; the script renders it to PDF with the component chart.

## Schema (`explainer.draft.json`)

```json
{
  "lang": "en",
  "title": "How to understand your results",
  "study": "Checkout benchmark",
  "headline": {
    "value": "67%",
    "label": "Overall usability score",
    "sentence": "The checkout works for most people, but it feels slower and less pleasant than it should."
  },
  "sections": [
    { "id": "measured",   "heading": "What we measured",               "paragraphs": ["…"] },
    { "id": "result",     "heading": "Your result",                    "paragraphs": ["…"] },
    { "id": "components", "heading": "What the score is made of",      "paragraphs": ["…"], "items": [{ "label": "Completion", "value": "80%", "text": "8 of 10 people finished." }] },
    { "id": "range",      "heading": "How sure we are",                "paragraphs": ["…"] },
    { "id": "fix-first",  "heading": "What to fix first",              "paragraphs": ["…"] },
    { "id": "limits",     "heading": "What this number cannot tell you", "paragraphs": ["…"] },
    { "id": "methods",    "heading": "Would another method change the answer?", "paragraphs": ["…"] }
  ],
  "glossary": [{ "term": "Usability score", "definition": "One number from 0 to 100% that sums up how well people managed the tasks." }]
}
```

The six sections `measured`, `result`, `components`, `range`, `fix-first` and `limits` are required, in that order. Add `methods` when `facts.methodDependent` is true or the user asked for a comparison. `items` is optional in any section. The chart of components is added by the renderer after the `result` section; do not describe its colours.

## What each section says

- **measured:** who did what, in one or two sentences: the number of people, the task in everyday words, what was recorded.
- **result:** the score, and that 50% means "exactly on the target the team set". Say whether the result is above or below that, and by how much in plain words.
- **components:** each part in everyday terms ("8 of 10 people finished"; "a typical attempt took 62 seconds; the target was 60"). Say which parts are on target and which are not.
- **range:** how sure we are, using `overall.ci` ("with ten people, the true score is most likely between 48% and 80%"). Small studies give wide ranges; say what more participants would buy.
- **fix-first:** the weakest component of each task (`tasks[].weakest`), and what that suggests looking into. Do not invent causes the data does not show.
- **limits:** what the number does not say: why people struggled, other tasks, other users. Add each caveat from `facts.caveats` in plain words. If the method matters (`methodDependent`), say so here or in `methods`.
- **methods** (optional): the sensitivity numbers in one sentence each, and why the chosen method fits the goal.

## Writing

- Use only numbers from `facts.json`. Round as it does.
- About 20 words per sentence at most, one idea per sentence, active voice, two to four sentences per paragraph.
- No statistics vocabulary: no z-score, standard deviation, percentile, Φ, sigma, bootstrap or logarithm. No method keys, file names or code. If a term is unavoidable, define it in the glossary.
- Name things the same way everywhere. Refer to people as "people" or "participants", not "users" or "respondents" in turn.

## Ukrainian version

Write `explainer.ua.draft.json` (`"lang": "ua"`) from the **edited** English text, as natural Ukrainian prose rather than a word-for-word translation. Keep every number. Use a decimal comma (3,7) and «с» for seconds. Use these terms consistently:

| English | Українською |
|---|---|
| How to understand your results | Як зрозуміти ваші результати |
| Usability score / SUM | Оцінка зручності (SUM) |
| Completion / completion rate | Частка успішного виконання |
| Time on task | Час на завдання |
| Satisfaction | Задоволеність |
| Error-free rate | Частка дій без помилок |
| Ease | Легкість |
| Perceived time | Відчуття часу |
| Target | Ціль |
| Range (confidence range) | Діапазон (найімовірніший діапазон значень) |
| Participant | Учасник |
| Task | Завдання |
| Benchmark (study tracked over time) | Регулярне вимірювання, порівняльне дослідження |
| What to fix first | Що виправити насамперед |
| What this number cannot tell you | Чого це число не скаже |
| Glossary | Словник |
