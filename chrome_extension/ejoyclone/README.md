# Droplet Dictionary (eJOY-style Chrome extension)

Select a word or phrase on any web page and click the green droplet to see its translation, definitions and pronunciation. You can save words to a notebook and review them with spaced repetition.

## Supabase auto-sync guide

**Start here:** [Project setup](#supabase-project-setup) → [Create a shared notebook](#create-and-share-a-notebook)
→ [Join as a member](#join-as-a-member).

Members sign in with their own email/password accounts and join an invite-only notebook.
Adding, editing or removing words and collections then syncs automatically across Chrome
profiles/devices. No Google Drive, Firebase, native helper or manual Sync button is needed.
Review schedules, XP, levels, streaks and game scores stay personal.

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
- **Supabase shared notebooks**: email/password sign-in, owner-managed invitations, automatic
  word/collection sync, offline queues and sync status in Settings.

## Supabase project setup

Local-only use works without configuring Supabase. One administrator sets up the shared
backend; members only sign in and join a notebook.

1. Create a project at [Supabase](https://supabase.com/dashboard). Save the database password
   privately; it is **not** an extension setting.
2. Open the project's **SQL Editor**, copy [supabase/schema.sql](supabase/schema.sql), and
   run it. This creates the notebook, membership, invitation and acknowledgment storage plus
   authenticated RPC functions. RLS and function membership checks prevent public access.
   Never disable RLS or give clients direct write access to the tables.
   Copy the **entire file**, including `begin;` and the final `commit;`, and run it as
   the database owner (`postgres`). The tables are intentionally in the private
   **`notebook_private` schema**, not `public`. In Table Editor, select
   `notebook_private` in the schema dropdown and refresh. If that schema is not shown
   in the dashboard, verify it in SQL Editor instead:

   ```sql
   select table_schema, table_name
   from information_schema.tables
   where table_schema = 'notebook_private'
   order by table_name;
   ```

   Expected tables: `clients`, `invitations`, `members`, `notebooks`. They are empty
   until you create/join a notebook through the extension. Only the RPC functions
   live in `public`; **do not expose `notebook_private` through the Data API**.
   If the query returns no rows, check the SQL Editor's error output. Any error in
   this transaction rolls back table creation; fix that error and rerun the entire file.
3. In **Authentication → Providers**, enable **Email** and **Confirm email**.
   Configure **Authentication → URL Configuration → Site URL** to a trusted web page for
   confirmation redirects. Users confirm the email, then return to the extension and sign in;
   the extension does not need to process the confirmation URL.
   Use your own SMTP configuration for a group beyond Supabase's built-in email limits.
4. Find your project URL and **publishable key** under the project's API settings/Connect
   dialog. A legacy `anon` key is also supported. Fill in [supabase-config.js](supabase-config.js):

   ```js
   globalThis.SUPABASE_CONFIG = {
     url: 'https://YOUR_PROJECT_REF.supabase.co',
     publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY',
   };
   ```

   These two values are public client configuration, not passwords. **Never include a
   `service_role`, `sb_secret_...`, database password or user password in the extension.**
   Hosted `https://PROJECT.supabase.co` URLs are supported; custom domains/local Supabase
   endpoints require additional configuration and are not supported by this setup.
5. Open `chrome://extensions`, reload the extension, and open **Notebook → Settings →
   Supabase shared notebook**. Distribute the same configured extension to members.
   There is no build step and no additional JavaScript package to install.

### Create and share a notebook

1. Click **Create account**, confirm the email from Supabase, then **Sign in**.
   Alternatively, the administrator can provision a confirmed user in Supabase Authentication.
2. Export a CSV backup of any existing words before connecting.
3. Enter a notebook name and click **Create shared notebook**. Local words and collections
   upload automatically; the creator becomes its owner.
4. In the owner controls, enter a member's email and click **Invite member**.
   Invitations can be created before the member registers. **No invitation email is sent
   automatically**: send the displayed notebook ID to that member yourself.
5. Use **Revoke access** to remove that email's invitation/membership. Only the owner can
   invite/revoke. Revocation stops future server access, but cannot erase already downloaded
   local copies. The owner cannot revoke their own access.

### Join as a member

1. Install the configured extension, create your own account and confirm the email.
2. Sign in using the **exact email the owner invited**.
3. Export a CSV backup, enter the owner's notebook ID and click **Join invited notebook**.
   A notebook ID alone does not grant access: an authenticated, confirmed, invited account
   is required. Existing members can also select a notebook from **Your notebooks**.
4. Add or remove a word normally. Check Settings for **Automatically synced** status;
   changes appear on the other users' Chrome profiles automatically.

If connecting reports **"A verified email and matching invitation are required"**:

- New members must confirm their account email and have the owner invite that exact
  email for the notebook ID they are joining.
- Owners and existing members do not need a new invitation to reconnect. If you
  installed an older version, reload the updated extension and rerun the entire
  updated [supabase/schema.sql](supabase/schema.sql) in SQL Editor as `postgres`.
  Reapplying this schema updates functions without deleting existing notebook data.

### Automatic behavior and data management

- Local edits save immediately and enter a persistent outbox. Uploads are debounced by about
  half a second; remote changes and failed uploads are polled/retried about every minute while
  Chrome runs. Chrome can delay alarms, so this is automatic eventual sync, not instant push.
- Offline vocabulary/review remains usable. Queued writes survive browser restarts.
  Status shows pending changes and explicit errors; authentication problems require sign-in
  again. Automatic retries do not open sign-in dialogs.
- First connection uploads local-only words/collections and imports shared ones. Existing
  shared records win initial duplicates, except explicit queued local edits. Tombstones retain
  deletions so an unchanged old local copy cannot recreate deleted words by joining.
- Edits to different fields merge independently; simultaneous edits to the same field use the
  last server-applied edit. Collection membership is one array field, so simultaneous changes
  to that array can overwrite one another. An intentional later edit can recreate a deleted word.
- Shared data includes translations, definitions, pronunciation, saved sentences, source URLs
  and collection membership. **Only share material you intend all members to see.** Personal
  review schedules and game statistics never upload.
- Server transactions serialize updates and acknowledge each client's operation sequence,
  preventing retries after a lost response from replaying old edits.
- **Pause sync** and **Sign out** keep local words and pending edits. **Resume auto-sync** or
  signing back into the same account resumes uploads. Edits made while paused will then be shared.
  A profile is bound to one account/notebook: use a separate Chrome profile for another group
  or user to avoid mixing local copies and outboxes.
- Auth tokens are kept in extension-origin IndexedDB, not `chrome.storage` or content scripts.
  Supabase refreshes expiring sessions automatically. Passwords are not persisted by this code.
- All members can edit/delete shared words and collections. Export CSV backups and use
  Supabase database backups appropriate for your project. Do not manually remove tombstones
  or acknowledgment rows. The shared notebook has a 4 MB server-side limit; large writes are
  rejected atomically and remain queued. Pending batches are limited to 500 operations.

### Validation

Run `node --test tests/*.test.cjs` with Node 22+ for local sync/auth tests.
If `CHROME_BINARY` points to a Chrome for Testing executable, the browser smoke test also
loads the actual extension in an isolated temporary profile and verifies automatic uploads
against mock Supabase responses; otherwise it is skipped.
Run the [backend SQL acceptance tests](tests/supabase-schema.test.sql) against a
**disposable PostgreSQL database only** (they create mock authentication users/roles):

```sh
psql -X -v ON_ERROR_STOP=1 -f tests/supabase-schema.test.sql DISPOSABLE_DATABASE
```

Do not run this acceptance fixture on your live Supabase project. Apply only
[supabase/schema.sql](supabase/schema.sql) there. The SQL acceptance suite and schema
reapplication were validated with embedded PostgreSQL; hosted PostgREST and concurrent
multi-session database locking still require live verification.

Before using a production group, apply the schema to your project and test with two confirmed
accounts in separate Chrome profiles: invite/join, add/edit/delete, go offline, reconnect,
pause/resume and revoke access. No project credentials are included or deployed automatically.
Live Supabase email delivery/authentication and your hosted project must be verified separately.

## Structure
| Path | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `background.js` | Service worker: translation/dictionary APIs, storage, context menu, badge |
| `lib/common.js` | Shared helpers: settings, SRS, messaging, result-card rendering |
| `lib/notebook-sync.js` | Local outbox, field merging and private review progress |
| `lib/supabase-api.js` | Supabase REST authentication and RPC transport |
| `lib/supabase-runtime.js` | Private token storage, background sync and alarms |
| `supabase-config.js` | Public Supabase project URL and publishable key |
| `supabase/schema.sql` | Authenticated invite-only notebook backend |
| `lib/card.css` | Lookup card styles (content-script shadow DOM + popup) |
| `content/content.js` | Selection droplet and lookup card on web pages |
| `popup/` | Toolbar popup: quick lookup and stats |
| `vocab/` | Notebook, review games (`game.js`) and settings page |

## Notes
- Translation uses Google's public `translate_a` endpoint, which is unofficial and has rate limits. For production, switch to an official API key.
- By default, data stays in your browser. Optional Supabase sync shares vocabulary and
  collections with invited notebook members; personal review/game progress stays local.
