import { getSettings, getMyself, isSupportedSite, DEFAULT_BASE_URL } from './jira.js';

const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}

getSettings().then(({ baseUrl = '', email = '', token = '', sprintEnd, sprintLength }) => {
  $('baseUrl').value = baseUrl;
  $('email').value = email;
  $('token').value = token;
  $('sprintEnd').value = sprintEnd;
  $('sprintLength').value = sprintLength;
});

$('form').onsubmit = async (event) => {
  event.preventDefault();
  let url;
  try {
    url = new URL($('baseUrl').value.trim());
  } catch {
    return setStatus('Invalid URL.', true);
  }
  if (!isSupportedSite(url)) {
    return setStatus(`URL must be ${DEFAULT_BASE_URL} or https://<your-domain>.atlassian.net`, true);
  }
  if ($('email').value.trim() && !$('token').value.trim()) {
    return setStatus('Enter an API token for this email, or leave both empty.', true);
  }

  await chrome.storage.local.set({
    baseUrl: url.origin,
    email: $('email').value.trim(),
    token: $('token').value.trim(),
    sprintEnd: $('sprintEnd').value,
    sprintLength: Number($('sprintLength').value),
  });
  $('baseUrl').value = url.origin;

  setStatus('Testing connection...');
  try {
    const me = await getMyself();
    setStatus(`Saved. Connected as ${me.displayName}.`);
  } catch (err) {
    setStatus(`Saved, but connection failed: ${err.message}`, true);
  }
};
