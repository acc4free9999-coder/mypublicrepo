import {
  getMyWorklogs, getSettings, getMyself, searchIssues, addWorklog, updateWorklog, getIssueTimeTracking,
  getIssueDetails, updateIssueEstimate, toLocalYmd, formatSeconds, DEFAULT_SPRINT_END, DEFAULT_SPRINT_LENGTH,
} from './jira.js';

const $ = (id) => document.getElementById(id);
const DAY_MS = 86400000;
const DRAG_TYPE = 'application/x-jira-worklog';
const today = new Date();
let view = 'sprint';
let anchor = today;
let sprint = { end: DEFAULT_SPRINT_END, length: DEFAULT_SPRINT_LENGTH };
let logsById = new Map();
let renderId = 0;
let searchId = 0;
let searchTimer;
let selectedIssue = null;
let defaultAssignee = null;
let editingLog = null;
let editingEstimate = null;
const HOUR_PX = { sprint: 40, month: 12 };
const MIN_ENTRY_PX = { sprint: 18, month: 12 };
let axis = { start: 8, end: 18, px: HOUR_PX.sprint };
let dragOffsetY = 0;

$('prev').onclick = () => shift(-1);
$('next').onclick = () => shift(1);
$('today').onclick = () => { anchor = today; render(); };
$('refresh').onclick = render;
$('open-options').onclick = () => chrome.runtime.openOptionsPage();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') render();
});
$('view-sprint').onclick = () => setView('sprint');
$('view-month').onclick = () => setView('month');
$('add-log').onclick = () => openLogDialog(new Date());
$('dialog-cancel').onclick = () => $('log-dialog').close();
$('assignee').onchange = runSearch;
$('search').oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 300);
};
$('search').onkeydown = (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  clearTimeout(searchTimer);
  runSearch();
};
$('log-form').onsubmit = submitLog;
$('edit-form').onsubmit = submitEdit;
$('edit-cancel').onclick = () => $('edit-dialog').close();

let menuTarget = null;

function showContextMenu(event, log, url) {
  hidePopover();
  menuTarget = { log, url };
  const menu = $('context-menu');
  menu.hidden = false;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 4)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 4)}px`;
}

function hideContextMenu() {
  $('context-menu').hidden = true;
  menuTarget = null;
}

$('menu-open').onclick = () => {
  if (menuTarget) chrome.tabs.create({ url: menuTarget.url });
  hideContextMenu();
};
$('menu-edit').onclick = () => {
  const log = menuTarget?.log;
  hideContextMenu();
  if (log) openEditDialog(log);
};
document.addEventListener('click', (event) => {
  if (!$('context-menu').contains(event.target)) hideContextMenu();
});
document.addEventListener('contextmenu', (event) => {
  if (!event.target.closest('.entry')) hideContextMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  hideContextMenu();
  hidePopover();
});
const hideOverlays = () => { hideContextMenu(); hidePopover(); };
window.addEventListener('blur', hideOverlays);
window.addEventListener('scroll', hideOverlays, true);

const issueCache = new Map();
let popoverTimer;
let popoverLog = null;

function getIssueCached(key) {
  if (!issueCache.has(key)) {
    issueCache.set(key, getIssueDetails(key).catch((err) => {
      issueCache.delete(key);
      throw err;
    }));
  }
  return issueCache.get(key);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function buildPopover(log, issue, error) {
  const f = issue?.fields;
  const frag = document.createDocumentFragment();

  const head = el('div', 'popover-head');
  head.append(el('strong', null, log.key));
  if (f?.issuetype) head.append(el('span', 'popover-muted', f.issuetype.name));
  if (f?.status) head.append(el('span', 'popover-status', f.status.name));
  frag.append(head, el('div', 'popover-summary', f?.summary ?? log.summary));

  const rows = [];
  if (f) {
    const tt = f.timetracking ?? {};
    rows.push(
      ['Assignee', f.assignee?.displayName ?? 'Unassigned'],
      ['Priority', f.priority?.name ?? '-'],
      ['Estimate', `${tt.originalEstimate ?? '-'} · ${tt.remainingEstimate ?? '-'} left · ${tt.timeSpent ?? '0m'} logged`],
    );
    if (f.duedate) rows.push(['Due', f.duedate]);
  } else {
    rows.push(['', error ? `Could not load details: ${error.message}` : 'Loading details...']);
  }
  const time = log.started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  rows.push(['This log', `${time} · ${formatSeconds(log.seconds)}`]);

  const list = el('dl', 'popover-rows');
  for (const [label, value] of rows) list.append(el('dt', null, label), el('dd', null, value));
  frag.append(list);
  if (log.comment) frag.append(el('div', 'popover-comment', log.comment));
  frag.append(el('div', 'popover-hint', 'Click to edit · Right-click for menu · Drag to move'));
  return frag;
}

function positionPopover(entry) {
  const popover = $('popover');
  const rect = entry.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - popover.offsetWidth - 8));
  let top = rect.bottom + 6;
  if (top + popover.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - popover.offsetHeight - 6);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function schedulePopover(entry, log) {
  clearTimeout(popoverTimer);
  popoverTimer = setTimeout(() => showPopover(entry, log), 350);
}

async function showPopover(entry, log) {
  if (!$('context-menu').hidden) return;
  popoverLog = log;
  const popover = $('popover');
  popover.replaceChildren(buildPopover(log));
  popover.hidden = false;
  positionPopover(entry);
  let issue;
  let error;
  try {
    issue = await getIssueCached(log.key);
  } catch (err) {
    error = err;
  }
  if (popoverLog !== log) return;
  popover.replaceChildren(buildPopover(log, issue, error));
  positionPopover(entry);
}

function hidePopover() {
  clearTimeout(popoverTimer);
  popoverLog = null;
  $('popover').hidden = true;
}

function setStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}

// Day numbers in UTC avoid DST drift when adding days.
const dayNum = (d) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
const fromDayNum = (n) => {
  const u = new Date(n * DAY_MS);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};
const shortDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function sprintOf(date) {
  const [y, m, d] = sprint.end.split('-').map(Number);
  const firstStart = dayNum(new Date(y, m - 1, d)) - sprint.length + 1;
  const start = firstStart + Math.floor((dayNum(date) - firstStart) / sprint.length) * sprint.length;
  return { start: fromDayNum(start), end: fromDayNum(start + sprint.length - 1) };
}

function currentRange() {
  if (view === 'sprint') return sprintOf(anchor);
  return {
    start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
    end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
  };
}

function shift(direction) {
  anchor = view === 'sprint'
    ? fromDayNum(dayNum(sprintOf(anchor).start) + direction * sprint.length)
    : new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  render();
}

function setView(next) {
  view = next;
  render();
}

const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();
const hhmm = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Working hours 08-18, widened to fit any logs outside that window.
function computeAxis(logs) {
  let start = 8;
  let end = 18;
  for (const log of logs) {
    const s = minutesOf(log.started);
    start = Math.min(start, Math.floor(s / 60));
    end = Math.max(end, Math.ceil((s + log.seconds / 60) / 60));
  }
  return { start, end: Math.min(24, end), px: HOUR_PX[view] };
}

function applyAxis(grid, gutters) {
  grid.style.setProperty('--hour-px', `${axis.px}px`);
  grid.style.setProperty('--hours', axis.end - axis.start);
  const step = axis.px < 20 ? 2 : 1;
  for (const gutter of gutters) {
    gutter.replaceChildren();
    for (let h = axis.start; h < axis.end; h += step) {
      const label = el('span', 'hour-label', `${String(h).padStart(2, '0')}:00`);
      label.style.top = `${(h - axis.start) * axis.px}px`;
      gutter.append(label);
    }
  }
}

/** Assigns side-by-side columns to overlapping logs within a day. */
function layoutDay(logs) {
  const minMinutes = (MIN_ENTRY_PX[view] / axis.px) * 60;
  const items = logs
    .map((log) => {
      const start = minutesOf(log.started);
      return { log, start, end: start + Math.max(log.seconds / 60, minMinutes), col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  let cluster = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const colEnds = [];
    for (const item of cluster) {
      let col = colEnds.findIndex((end) => end <= item.start);
      if (col === -1) col = colEnds.push(0) - 1;
      colEnds[col] = item.end;
      item.col = col;
    }
    for (const item of cluster) item.cols = colEnds.length;
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return items;
}

function createEntry(item, baseUrl) {
  const { log } = item;
  const entry = el('a', 'entry');
  entry.href = `${baseUrl}/browse/${encodeURIComponent(log.key)}`;
  entry.target = '_blank';
  entry.rel = 'noopener';
  entry.draggable = true;

  const maxHeight = (axis.end - axis.start) * axis.px;
  const top = (item.start / 60 - axis.start) * axis.px;
  const height = Math.min(((item.end - item.start) / 60) * axis.px, maxHeight - top);
  entry.style.top = `${top}px`;
  entry.style.height = `${height - 1}px`;
  entry.style.left = `${(item.col / item.cols) * 100}%`;
  entry.style.width = `calc(${100 / item.cols}% - 2px)`;

  entry.append(el('strong', null, log.key), ' ', el('span', 'entry-time', formatSeconds(log.seconds)));
  if (height >= 32) entry.append(el('div', 'entry-summary', log.summary));

  entry.ondragstart = (event) => {
    hidePopover();
    dragOffsetY = event.clientY - entry.getBoundingClientRect().top;
    event.dataTransfer.setData(DRAG_TYPE, log.id);
    event.dataTransfer.effectAllowed = 'move';
  };
  entry.onmouseenter = () => schedulePopover(entry, log);
  entry.onmouseleave = hidePopover;
  entry.onclick = (event) => {
    if (event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    hidePopover();
    openEditDialog(log);
  };
  entry.oncontextmenu = (event) => {
    event.preventDefault();
    showContextMenu(event, log, entry.href);
  };
  return entry;
}

async function render() {
  const id = ++renderId;
  hidePopover();
  // Estimates may have changed after edits, so refetch details on each render.
  issueCache.clear();
  const settings = await getSettings();
  sprint = { end: settings.sprintEnd, length: settings.sprintLength };
  const { start: first, end: last } = currentRange();
  const todaySprint = sprintOf(today);

  $('view-sprint').classList.toggle('active', view === 'sprint');
  $('view-month').classList.toggle('active', view === 'month');
  $('range-label').textContent = view === 'sprint'
    ? `Sprint ${shortDate(first)} – ${shortDate(last)}, ${last.getFullYear()}`
    : first.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  $('range-total').textContent = '';

  const grid = $('grid');
  grid.replaceChildren();
  grid.classList.toggle('sprint-view', view === 'sprint');
  axis = { start: 8, end: 18, px: HOUR_PX[view] };
  const cells = new Map();
  const gutters = [];
  let slot = 0;
  const addSlot = (node) => {
    if (slot % 7 === 0) {
      const gutter = el('div', 'gutter');
      const gutterTimeline = el('div', 'timeline gutter-timeline');
      gutter.append(el('div', 'day-header'), gutterTimeline);
      gutters.push(gutterTimeline);
      grid.append(gutter);
    }
    grid.append(node);
    slot++;
  };
  const leading = (first.getDay() + 6) % 7; // Monday-first

  for (let i = 0; i < leading; i++) addSlot(el('div', 'day empty'));
  for (let n = dayNum(first); n <= dayNum(last); n++) {
    const date = fromDayNum(n);
    const cell = document.createElement('div');
    cell.className = 'day';
    if (date.getDay() === 0 || date.getDay() === 6) cell.classList.add('weekend');
    if (n === dayNum(today)) cell.classList.add('today');
    if (view === 'month' && n >= dayNum(todaySprint.start) && n <= dayNum(todaySprint.end)) {
      cell.classList.add('in-sprint');
    }

    const header = document.createElement('div');
    header.className = 'day-header';
    const label = document.createElement('span');
    label.textContent = view === 'sprint' || date.getDate() === 1 ? shortDate(date) : date.getDate();
    const daySprint = sprintOf(date);
    const marker = n === dayNum(daySprint.start) ? 'Sprint start' : n === dayNum(daySprint.end) ? 'Sprint end' : '';
    if (marker) {
      const tag = document.createElement('small');
      tag.className = 'sprint-tag';
      tag.textContent = marker;
      label.append(' ', tag);
    }
    const total = document.createElement('span');
    total.className = 'day-total';
    const add = document.createElement('button');
    add.className = 'day-add';
    add.textContent = '+';
    add.title = 'Log time on this day';
    add.onclick = () => openLogDialog(date);
    const right = document.createElement('span');
    right.append(total, add);
    header.append(label, right);
    const timeline = el('div', 'timeline');
    cell.append(header, timeline);

    cell.ondragover = (event) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      cell.classList.add('drop-target');
    };
    cell.ondragleave = (event) => {
      if (!cell.contains(event.relatedTarget)) cell.classList.remove('drop-target');
    };
    cell.ondrop = (event) => {
      event.preventDefault();
      cell.classList.remove('drop-target');
      const y = event.clientY - timeline.getBoundingClientRect().top - dragOffsetY;
      const minutes = Math.round((axis.start * 60 + (y / axis.px) * 60) / 15) * 15;
      moveWorklog(event.dataTransfer.getData(DRAG_TYPE), date, Math.max(0, Math.min(24 * 60 - 15, minutes)));
    };

    addSlot(cell);
    cells.set(toLocalYmd(date), { total, timeline, seconds: 0, logs: [] });
  }
  applyAxis(grid, gutters);

  setStatus('Loading worklogs...');
  try {
    const logs = await getMyWorklogs(first, last);
    if (id !== renderId) return;

    logsById = new Map(logs.map((log) => [log.id, log]));
    let rangeSeconds = 0;
    for (const log of logs) {
      const day = cells.get(toLocalYmd(log.started));
      if (!day) continue;
      day.logs.push(log);
      day.seconds += log.seconds;
      rangeSeconds += log.seconds;
    }
    axis = computeAxis(logs);
    applyAxis(grid, gutters);
    for (const day of cells.values()) {
      if (day.seconds) day.total.textContent = formatSeconds(day.seconds);
      for (const item of layoutDay(day.logs)) day.timeline.append(createEntry(item, settings.baseUrl));
    }
    $('range-total').textContent = `Total: ${formatSeconds(rangeSeconds)} `;
    setStatus(logs.length ? '' : `No worklogs this ${view}.`);
  } catch (err) {
    if (id === renderId) setStatus(err.message, true);
  }
}

async function moveWorklog(worklogId, date, minutes) {
  const log = logsById.get(worklogId);
  if (!log) return;
  const started = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60);
  if (toLocalYmd(started) === toLocalYmd(log.started) && minutesOf(started) === minutesOf(log.started)) return;
  const when = `${shortDate(started)} ${hhmm(started)}`;
  setStatus(`Moving ${log.key} to ${when}...`);
  try {
    await updateWorklog(log.key, log.id, { started, seconds: log.seconds });
    await render();
    setStatus(`Moved ${log.key} (${formatSeconds(log.seconds)}) to ${when}.`);
  } catch (err) {
    setStatus(err.message, true);
  }
}

function setDialogStatus(message, isError = false) {
  $('dialog-status').textContent = message;
  $('dialog-status').classList.toggle('error', isError);
}

function setEditStatus(message, isError = false) {
  $('edit-status').textContent = message;
  $('edit-status').classList.toggle('error', isError);
}

function readStarted(dateInput, timeInput) {
  const [y, m, d] = dateInput.value.split('-').map(Number);
  const [hh, mm] = timeInput.value.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

async function showTimeTracking(issueKey, info) {
  info.dataset.key = issueKey;
  info.textContent = 'Loading estimate...';
  try {
    const { originalEstimate, remainingEstimate, timeSpent } = await getIssueTimeTracking(issueKey);
    if (info.dataset.key !== issueKey) return;
    info.textContent = `Original: ${originalEstimate ?? '-'} · Remaining: ${remainingEstimate ?? '-'} · Logged: ${timeSpent ?? '-'}`;
  } catch (err) {
    if (info.dataset.key === issueKey) info.textContent = err.message;
  }
}

function openEditDialog(log) {
  editingLog = log;
  editingEstimate = null;
  const pad = (n) => String(n).padStart(2, '0');
  $('edit-title').textContent = `${log.key}: ${log.summary}`;
  $('edit-time').value = formatSeconds(log.seconds);
  $('edit-date').value = toLocalYmd(log.started);
  $('edit-start').value = `${pad(log.started.getHours())}:${pad(log.started.getMinutes())}`;
  $('edit-comment').value = log.comment;
  setEditStatus('');
  $('edit-dialog').showModal();
  $('edit-time').focus();
  loadEditEstimates(log);
}

async function loadEditEstimates(log) {
  const inputs = [$('edit-original'), $('edit-remaining')];
  inputs.forEach((input) => { input.value = ''; input.disabled = true; });
  $('edit-estimate-info').textContent = 'Loading estimate...';
  try {
    const tracking = await getIssueTimeTracking(log.key);
    if (editingLog !== log) return;
    editingEstimate = {
      original: tracking.originalEstimate ?? '',
      remaining: tracking.remainingEstimate ?? '',
    };
    $('edit-original').value = editingEstimate.original;
    $('edit-remaining').value = editingEstimate.remaining;
    $('edit-estimate-info').textContent = `Total logged on task: ${tracking.timeSpent ?? '-'}`;
    inputs.forEach((input) => { input.disabled = false; });
  } catch (err) {
    if (editingLog === log) $('edit-estimate-info').textContent = `Could not load estimate: ${err.message}`;
  }
}

async function submitEdit(event) {
  event.preventDefault();
  const log = editingLog;
  const started = readStarted($('edit-date'), $('edit-start'));
  const timeSpent = $('edit-time').value.trim();
  const comment = $('edit-comment').value.trim();
  const original = $('edit-original').value.trim();
  const remaining = $('edit-remaining').value.trim();
  const originalChanged = Boolean(editingEstimate && original && original !== editingEstimate.original);
  const remainingChanged = Boolean(editingEstimate && remaining && remaining !== editingEstimate.remaining);
  const button = event.submitter;
  button.disabled = true;
  setEditStatus('Saving...');
  try {
    await updateWorklog(log.key, log.id, {
      started,
      timeSpent,
      // Only send the comment when changed, so rich formatting in Jira isn't overwritten.
      comment: comment !== log.comment.trim() ? comment : undefined,
      // Remaining-only changes go through the worklog, which doesn't need edit-screen access.
      newEstimate: remainingChanged && !originalChanged ? remaining : undefined,
    });
    if (originalChanged) {
      await updateIssueEstimate(log.key, {
        originalEstimate: original,
        remainingEstimate: remainingChanged ? remaining : undefined,
      });
    }
    $('edit-dialog').close();
    anchor = started;
    await render();
    setStatus(`Updated work log on ${log.key}.`);
  } catch (err) {
    setEditStatus(err.message, true);
  } finally {
    button.disabled = false;
  }
}

const jqlString = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

async function openLogDialog(date) {
  $('log-form').reset();
  selectedIssue = null;
  $('selected').textContent = 'Select a task below.';
  $('date').value = toLocalYmd(date);
  $('results').replaceChildren();
  $('estimate-info').textContent = '';
  delete $('estimate-info').dataset.key;
  setDialogStatus('');
  $('log-dialog').showModal();
  $('search').focus();

  if (defaultAssignee === null) {
    try {
      const me = await getMyself();
      defaultAssignee = me.emailAddress || me.name || '';
    } catch (err) {
      return setDialogStatus(err.message, true);
    }
  }
  $('assignee').value = defaultAssignee;
  runSearch();
}

async function runSearch() {
  const id = ++searchId;
  const text = $('search').value.trim();
  const assignee = $('assignee').value.trim();

  const clauses = [];
  if (assignee) clauses.push(`assignee = ${jqlString(assignee)}`);
  if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(text)) clauses.push(`issuekey = ${jqlString(text.toUpperCase())}`);
  else if (text) clauses.push(`summary ~ ${jqlString(`${text}*`)}`);
  else clauses.push('statusCategory != Done');

  setDialogStatus('Searching...');
  try {
    const issues = (await searchIssues(`${clauses.join(' AND ')} ORDER BY updated DESC`, ['summary', 'status'], 20)).slice(0, 20);
    if (id !== searchId) return;
    renderResults(issues);
    setDialogStatus(issues.length ? '' : 'No tasks found.');
  } catch (err) {
    if (id === searchId) setDialogStatus(err.message, true);
  }
}

function renderResults(issues) {
  const list = $('results');
  list.replaceChildren();
  for (const issue of issues) {
    const li = document.createElement('li');
    if (issue.key === selectedIssue?.key) li.className = 'selected';
    const key = document.createElement('strong');
    key.textContent = issue.key;
    const summary = document.createElement('span');
    summary.textContent = issue.fields.summary ?? '';
    summary.title = summary.textContent;
    const status = document.createElement('small');
    status.textContent = issue.fields.status?.name ?? '';
    li.append(key, summary, status);
    li.onclick = () => {
      selectedIssue = issue;
      $('selected').textContent = `Selected: ${issue.key} - ${issue.fields.summary ?? ''}`;
      list.querySelectorAll('li').forEach((el) => el.classList.toggle('selected', el === li));
      showTimeTracking(issue.key, $('estimate-info'));
      $('time').focus();
    };
    list.append(li);
  }
}

async function submitLog(event) {
  event.preventDefault();
  if (!selectedIssue) return setDialogStatus('Select a task first.', true);

  const started = readStarted($('date'), $('start'));
  const timeSpent = $('time').value.trim();
  const button = event.submitter;
  button.disabled = true;
  setDialogStatus('Saving...');
  try {
    await addWorklog(selectedIssue.key, {
      timeSpent,
      started,
      comment: $('comment').value.trim(),
      newEstimate: $('estimate').value.trim(),
    });
    $('log-dialog').close();
    anchor = started;
    const key = selectedIssue.key;
    await render();
    setStatus(`Logged ${timeSpent} on ${key}.`);
  } catch (err) {
    setDialogStatus(err.message, true);
  } finally {
    button.disabled = false;
  }
}

render();
