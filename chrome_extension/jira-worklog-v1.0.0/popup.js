import { searchIssues, addWorklog, getSettings, toLocalYmd, detectBaseUrlFromActiveTab } from './jira.js';

const $ = (id) => document.getElementById(id);
let issues = [];
let selected = null;
let baseUrl = '';

$('open-calendar').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('calendar.html') });
$('open-options').onclick = () => chrome.runtime.openOptionsPage();
$('filter').oninput = render;
$('cancel').onclick = () => select(null);
$('log-form').onsubmit = submit;

function setStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}

async function load() {
  setStatus('Loading tasks...');
  try {
    await detectBaseUrlFromActiveTab();
    ({ baseUrl = '' } = await getSettings());
    issues = await searchIssues(
      'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC',
      ['summary', 'status']
    );
    setStatus(issues.length ? '' : 'No open tasks assigned to you.');
    render();
  } catch (err) {
    setStatus(err.message, true);
  }
}

function render() {
  const query = $('filter').value.trim().toLowerCase();
  const list = $('issues');
  list.replaceChildren();
  for (const issue of issues) {
    const summary = issue.fields.summary ?? '';
    if (query && !`${issue.key} ${summary}`.toLowerCase().includes(query)) continue;

    const li = document.createElement('li');
    if (issue === selected) li.className = 'selected';
    const key = document.createElement('strong');
    key.textContent = issue.key;
    const title = document.createElement('span');
    title.textContent = summary;
    title.title = summary;
    const status = document.createElement('small');
    status.textContent = issue.fields.status?.name ?? '';
    li.append(key, title, status);
    li.onclick = () => select(issue);
    list.append(li);
  }
}

function select(issue) {
  selected = issue;
  $('log-form').hidden = !issue;
  if (issue) {
    const link = $('selected-issue');
    link.textContent = `${issue.key}: ${issue.fields.summary}`;
    link.href = `${baseUrl}/browse/${encodeURIComponent(issue.key)}`;
    $('date').value = toLocalYmd(new Date());
    $('time').focus();
  }
  render();
}

async function submit(event) {
  event.preventDefault();
  const [y, m, d] = $('date').value.split('-').map(Number);
  const [hh, mm] = $('start').value.split(':').map(Number);
  const timeSpent = $('time').value.trim();
  const button = event.submitter;
  button.disabled = true;
  try {
    await addWorklog(selected.key, {
      timeSpent,
      started: new Date(y, m - 1, d, hh, mm),
      comment: $('comment').value.trim(),
    });
    setStatus(`Logged ${timeSpent} on ${selected.key}.`);
    $('log-form').reset();
    select(null);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    button.disabled = false;
  }
}

load();
