# Droplet Dictionary (eJOY-style Chrome extension)

Select a word or phrase on any web page and click the green droplet to see its translation, definitions and pronunciation. You can save words to a notebook and review them with spaced repetition.

## Install (developer mode)
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open a normal web page (refresh any tabs that were already open), select a word, and click the 💧 icon.

## Features
- **Instant lookup**: a droplet icon appears when you select text. You can also double-click to look up (turn this on in Settings), use the right-click menu **Look up "…"**, or open the toolbar popup (`Alt+D`).
- **Translation** into your chosen language (Vietnamese by default), with alternatives grouped by part of speech.
- **English definitions and examples** (from Wiktionary), plus phonetics and synonyms (from dictionaryapi.dev) when available.
- **Pronunciation** through Chrome text-to-speech.
- **Links** to Google, Cambridge, Wikipedia, Images and YouGlish.
- **Vocabulary notebook**: saves each word with the sentence it came from and the source page. Includes search, sorting, and CSV import/export.
- **Review games**: Flashcards, Multiple choice, Fill in the blank, and Listening, scheduled with a simplified SM-2 algorithm.
- **Reminders**: the toolbar badge shows how many words are due.

## Structure
| Path | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `background.js` | Service worker: translation/dictionary APIs, storage, context menu, badge |
| `lib/common.js` | Shared helpers: settings, SRS, messaging, result-card rendering |
| `lib/card.css` | Lookup card styles (content-script shadow DOM + popup) |
| `content/content.js` | Selection droplet and lookup card on web pages |
| `popup/` | Toolbar popup: quick lookup and stats |
| `vocab/` | Notebook, review games and settings page |

## Notes
- Translation uses Google's public `translate_a` endpoint, which is unofficial and has rate limits. For production, switch to an official API key.
- All data stays in `chrome.storage` in your browser. Nothing is synced to a server.
