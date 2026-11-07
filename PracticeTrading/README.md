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
- Settings provides a JSON export and a two-confirmation reset. A reset removes templates as well as trading data, leaving an empty journal.

## Storage

Data is automatically saved to the `edgebook-journal-v1` localStorage key. There is no backend, authentication, synchronization, or market-data service. Clearing browser data removes the journal; export important records regularly. Exports are backups, not an in-app import feature.

Stored data is schema-validated before use. Unreadable records are not overwritten automatically and can still be exported. Storage failures are shown in the interface rather than silently reporting success.

Fonts are loaded from Google Fonts, with local sans-serif fallbacks. All journal functionality works without external APIs.