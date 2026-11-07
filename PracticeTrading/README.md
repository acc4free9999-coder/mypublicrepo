# Edgebook

A local-first trading checklist and performance journal built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui-style Radix primitives, and Lucide icons.

## Run

Requires Node.js 22.18+ and npm.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite.

```sh
npm test
npm run build
```

## Journal

- Editable checklist and question templates are included on first launch. Checklist progress and answers are stored separately for each local calendar date.
- Questions support written responses or multiple checked options. Use Customize to rename, delete, or change answer types.
- The ledger starts in the current local month. Trading records are keyed by year, month, and date. Month navigation never copies or overwrites other months.
- Blank trade entries do not count as trades. Explicit zeroes count as breakeven trades and are excluded from win rate. RR is numeric; displayed values are rounded to two decimal places.
- The dashboard always summarizes the current month. The performance page summarizes the selected month.
- Settings provides JSON export/import, a downloadable import template, and a two-confirmation reset. A reset removes templates as well as trading data, leaving an empty journal.

## Import a Journal

In Settings, choose **Import journal** and select an Edgebook JSON export (up to 5 MB), or choose **Paste JSON**, paste the journal into the text editor, and select **Review import**. Both methods validate the same journal format. Review the summary, optionally download your current backup, and confirm **Replace and import**. Importing replaces the entire journal rather than merging data. Cancelling or submitting invalid JSON leaves existing data unchanged. The imported journal is saved immediately; storage failures leave the current journal intact.

Choose **Download template** for an editable JSON example. The template includes checklist sections, written and checklist questions, example answers, and sample trades on January 5, 2026. Replace or remove the sample records before importing. Keep entity IDs unique, dates in `YYYY-MM-DD` format, and month keys in `YYYY-MM` format. Trade values are strings such as `"2"`, `"-1"`, or `"0"`; use `""` for an empty trade. Daily records must belong to their containing month. Empty `daily` and `months` objects are valid for a template without trading history.

## Storage

Data is automatically saved to the `edgebook-journal-v1` localStorage key. There is no backend, authentication, synchronization, or market-data service. Clearing browser data removes the journal; export important records regularly. To move a journal to another browser or from localhost to the deployed site, export it in the source browser and import the file on the destination site.

Stored data is schema-validated before use. Unreadable records are not overwritten automatically and can still be exported. Storage failures are shown in the interface rather than silently reporting success.

Fonts are loaded from Google Fonts, with local sans-serif fallbacks. All journal functionality works without external APIs.