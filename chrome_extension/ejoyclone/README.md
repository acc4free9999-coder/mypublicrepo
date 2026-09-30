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
- **Pronunciation**: UK and US IPA with native-speaker recordings from Wiktionary/Wikimedia Commons. If there is no recording, Chrome text-to-speech is used. Words saved before this feature get their pronunciation filled in automatically when the notebook opens.
- **Word family**: related forms of the word, each with a translation. For example, *decide* shows decider, decision, decisive and undecide, and *running* shows its base word *run*. Click any of them to look it up. The list comes from Wiktionary's derived and related terms.
- **Example translations**: each example sentence under a definition has its translation below it.
- **Links** to Google, Cambridge, Wikipedia, Images and YouGlish.
- **Vocabulary notebook**: saves each word with the sentence it came from and the source page. Includes search, sorting, and CSV import/export.
- **Collections**: group words into your own collections (e.g. *IELTS*, *Work*, *Movies*). A word can be in several collections at once.
  - On the lookup card, **☆ Save** adds the word to the collection you used last. **Choose ▾ / Edit ▾** lets you tick any collections or create a new one inline.
  - In the notebook, the sidebar lists your collections with word counts. You can create, rename or delete a collection. Deleting a collection keeps its words, and words left without a collection move to **Unsorted**.
  - Use a word's 📁 button to add it to or remove it from collections. Use ➖ to remove it from the collection you're viewing.
  - **Review** can be limited to one collection, and CSV export/import includes a `collections` column (names separated by `;`).
- **Review games**: Flashcards, Multiple choice (word → meaning and meaning → word), Fill in the blank, and Listening. Words come up for review on a spaced-repetition schedule (a simplified SM-2 algorithm).
  - **Mixed** mode (the default) switches between all question types, based on how well you know each word: new words get flashcards and multiple choice, and words you know get typing and listening.
  - You have **3 lives**. A wrong answer costs a life, and the missed word comes back once at the end.
  - A **combo** of correct answers multiplies points: ×1.5 at 3, ×2 at 5, and ×3 at 10. With the optional **20-second timer**, faster answers earn bonus points. Hints halve your points.
  - The game plays sounds and animations. Sound can be turned off with the 🔈 button.
  - At the end, a **results screen** shows your score, accuracy, best combo, the XP you earned and the words you missed. You can then practise just the missed words.
  - Your level, XP, daily streak and best score for each mode are saved. Only the first answer for a word in each game changes its review schedule.
  - Keyboard: `Space` shows the flashcard answer, `1`–`4` grades a flashcard or picks a choice, and `Enter` goes to the next question.
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
| `vocab/` | Notebook, review games (`game.js`) and settings page |

## Notes
- Translation uses Google's public `translate_a` endpoint, which is unofficial and has rate limits. For production, switch to an official API key.
- All data stays in `chrome.storage` in your browser. Nothing is synced to a server.
