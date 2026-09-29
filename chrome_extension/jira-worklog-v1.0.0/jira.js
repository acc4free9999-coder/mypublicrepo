export const DEFAULT_BASE_URL = 'https://sd.homecredit.vn';
export const DEFAULT_SPRINT_END = '2026-09-29';
export const DEFAULT_SPRINT_LENGTH = 14;

export async function getSettings() {
  const settings = await chrome.storage.local.get(['baseUrl', 'email', 'token', 'sprintEnd', 'sprintLength']);
  return {
    ...settings,
    baseUrl: settings.baseUrl || DEFAULT_BASE_URL,
    sprintEnd: settings.sprintEnd || DEFAULT_SPRINT_END,
    sprintLength: Number(settings.sprintLength) || DEFAULT_SPRINT_LENGTH,
  };
}

export function isSupportedSite(url) {
  return url.protocol === 'https:' &&
    (url.hostname.endsWith('.atlassian.net') || url.origin === DEFAULT_BASE_URL);
}

const isCloud = (baseUrl) => new URL(baseUrl).hostname.endsWith('.atlassian.net');

/** Saves the Jira site of the active tab (if it is one) as the base URL. */
export async function detectBaseUrlFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  const url = new URL(tab.url);
  if (!isSupportedSite(url)) return null;
  await chrome.storage.local.set({ baseUrl: url.origin });
  return url.origin;
}

/** `path` is relative to /rest/api/{2|3}; Cloud uses v3, Server/Data Center uses v2. */
async function request(path, options = {}) {
  const { baseUrl, email, token } = await getSettings();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Atlassian-Token': 'no-check',
  };
  if (email && token) headers.Authorization = 'Basic ' + btoa(`${email}:${token}`);
  // Token without email = Jira Server/Data Center personal access token.
  else if (token) headers.Authorization = `Bearer ${token}`;

  const apiVersion = isCloud(baseUrl) ? 3 : 2;
  const res = await fetch(`${baseUrl}/rest/api/${apiVersion}${path}`, {
    ...options,
    // Without a token, reuse the browser's logged-in Jira session cookies.
    credentials: token ? 'omit' : 'include',
    headers,
  });
  if (res.status === 401 && !token) {
    throw new Error(`Not logged in. Log in at ${baseUrl} in this browser, or add an API token in Settings.`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

export function getMyself() {
  return request('/myself');
}

export async function searchIssues(jql, fields = ['summary', 'status'], limit = 500) {
  const { baseUrl } = await getSettings();
  const issues = [];

  if (isCloud(baseUrl)) {
    let nextPageToken;
    do {
      const params = new URLSearchParams({ jql, fields: fields.join(','), maxResults: '100' });
      if (nextPageToken) params.set('nextPageToken', nextPageToken);
      const data = await request(`/search/jql?${params}`);
      issues.push(...data.issues);
      nextPageToken = data.isLast ? undefined : data.nextPageToken;
    } while (nextPageToken && issues.length < limit);
    return issues;
  }

  let total = 0;
  do {
    const params = new URLSearchParams({ jql, fields: fields.join(','), maxResults: '100', startAt: issues.length });
    const data = await request(`/search?${params}`);
    if (!data.issues.length) break;
    issues.push(...data.issues);
    total = data.total;
  } while (issues.length < total && issues.length < limit);
  return issues;
}

function toCommentBody(baseUrl, text) {
  if (!isCloud(baseUrl)) return text;
  return { type: 'doc', version: 1, content: text ? [{ type: 'paragraph', content: [{ type: 'text', text }] }] : [] };
}

function commentText(comment) {
  if (!comment) return '';
  if (typeof comment === 'string') return comment;
  return (comment.content ?? []).map((block) => (block.content ?? []).map((n) => n.text ?? '').join('')).join('\n');
}

// Empty newEstimate falls back to Jira's `auto` (add) or `leave` (edit) behaviour.
const estimateParams = (newEstimate, fallback) =>
  new URLSearchParams(newEstimate ? { adjustEstimate: 'new', newEstimate } : { adjustEstimate: fallback });

export async function getIssueTimeTracking(issueKey) {
  const data = await request(`/issue/${encodeURIComponent(issueKey)}?fields=timetracking`);
  return data.fields.timetracking ?? {};
}

export function getIssueDetails(issueKey) {
  const fields = 'summary,status,issuetype,priority,assignee,reporter,duedate,timetracking';
  return request(`/issue/${encodeURIComponent(issueKey)}?fields=${fields}`);
}

export function updateIssueEstimate(issueKey, { originalEstimate, remainingEstimate }) {
  const timetracking = {};
  if (originalEstimate) timetracking.originalEstimate = originalEstimate;
  if (remainingEstimate) timetracking.remainingEstimate = remainingEstimate;
  return request(`/issue/${encodeURIComponent(issueKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ fields: { timetracking } }),
  });
}

export async function addWorklog(issueKey, { timeSpent, started, comment, newEstimate }) {
  const { baseUrl } = await getSettings();
  const body = { timeSpent, started: toJiraDateTime(started) };
  if (comment) body.comment = toCommentBody(baseUrl, comment);
  return request(`/issue/${encodeURIComponent(issueKey)}/worklog?${estimateParams(newEstimate, 'auto')}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateWorklog(issueKey, worklogId, { started, seconds, timeSpent, comment, newEstimate }) {
  const { baseUrl } = await getSettings();
  const body = { started: toJiraDateTime(started) };
  if (timeSpent) body.timeSpent = timeSpent;
  else body.timeSpentSeconds = seconds;
  if (comment !== undefined) body.comment = toCommentBody(baseUrl, comment);
  const path = `/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}`;
  return request(`${path}?${estimateParams(newEstimate, 'leave')}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function getIssueWorklogs(issueKey, startedAfter, startedBefore) {
  const worklogs = [];
  let startAt = 0;
  let total = 0;
  do {
    const params = new URLSearchParams({ startAt, maxResults: 1000, startedAfter, startedBefore });
    const data = await request(`/issue/${encodeURIComponent(issueKey)}/worklog?${params}`);
    worklogs.push(...data.worklogs);
    total = data.total;
    startAt += data.worklogs.length;
    if (!data.worklogs.length) break;
  } while (startAt < total);
  return worklogs;
}

/** Returns the current user's worklogs between two local dates (inclusive). */
export async function getMyWorklogs(fromDate, toDate) {
  const me = await getMyself();
  const { baseUrl } = await getSettings();
  const isMe = isCloud(baseUrl)
    ? (author) => author?.accountId === me.accountId
    : (author) => author?.key === me.key || author?.name === me.name;
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1);
  const jql = `worklogAuthor = currentUser() AND worklogDate >= "${toLocalYmd(start)}" AND worklogDate <= "${toLocalYmd(toDate)}"`;
  const issues = await searchIssues(jql, ['summary']);

  const perIssue = await Promise.all(
    issues.map(async (issue) => {
      const logs = await getIssueWorklogs(issue.key, start.getTime(), end.getTime());
      return logs
        .filter((w) => isMe(w.author))
        .map((w) => ({
          id: w.id,
          key: issue.key,
          summary: issue.fields.summary,
          // Jira returns "+0700"; add a colon so Date parses it reliably.
          started: new Date(w.started.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')),
          seconds: w.timeSpentSeconds,
          comment: commentText(w.comment),
        }))
        // Server ignores startedAfter/startedBefore, so filter locally.
        .filter((w) => w.started >= start && w.started < end);
    })
  );
  return perIssue.flat().sort((a, b) => a.started - b.started);
}

const pad = (n) => String(n).padStart(2, '0');

export function toLocalYmd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toJiraDateTime(d) {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${toLocalYmd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00.000${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

export function formatSeconds(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m';
}
