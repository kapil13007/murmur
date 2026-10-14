// File: app/services/app_category_service.js
// Decides which writing style applies to a dictation from the app it was
// spoken into (Wispr's per-app "Style" categories).

const DOMAINS = {
  email: ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'mail.yahoo.com', 'mail.proton.me', 'superhuman.com', 'app.fastmail.com', 'app.hey.com', 'mail.zoho.com'],
  work: ['app.slack.com', 'teams.microsoft.com', 'teams.live.com', 'chat.google.com', 'app.zoom.us', 'mattermost.com'],
  personal: ['web.whatsapp.com', 'www.messenger.com', 'messenger.com', 'web.telegram.org', 'discord.com', 'www.instagram.com', 'messages.google.com', 'app.signal.org'],
};

// Desktop app / process names (lower-case, matched as whole words).
const APPS = {
  email: ['outlook', 'olk', 'hxoutlook', 'thunderbird', 'mailspring', 'superhuman', 'spark', 'mail', 'gmail'],
  work: ['slack', 'teams', 'ms-teams', 'microsoft teams', 'zoom', 'webex', 'google chat', 'mattermost', 'rocket.chat'],
  personal: ['whatsapp', 'telegram', 'signal', 'messenger', 'discord', 'wechat', 'line', 'viber', 'skype', 'instagram', 'messages'],
};

// Browser window titles carry the web app's name ("Inbox - Gmail - Google Chrome").
const TITLE_HINTS = {
  email: ['gmail', 'outlook', 'yahoo mail', 'proton mail', 'superhuman', 'fastmail'],
  work: ['slack', 'microsoft teams', 'google chat'],
  personal: ['whatsapp', 'messenger', 'telegram', 'discord', 'instagram', 'signal'],
};

const wordMatch = (haystack, needle) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu').test(haystack);

function hostOf(url) {
  if (!url) return null;
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * @param {{appName?: string, url?: string, windowTitle?: string}} context
 * @param {Array<{category: string, app_names: string[]}>} styleProfiles  user overrides
 */
export function categorizeApp({ appName, url, windowTitle } = {}, styleProfiles = []) {
  const host = hostOf(url);
  if (host) {
    for (const [category, domains] of Object.entries(DOMAINS)) {
      if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return category;
    }
  }
  const app = (appName || '').trim();
  const title = (windowTitle || '').trim();
  // The user's own app lists on the Style page win over built-in guesses.
  for (const profile of styleProfiles) {
    if (profile.category === 'other') continue;
    for (const name of profile.app_names || []) {
      if (app && wordMatch(app, name)) return profile.category;
    }
  }
  for (const [category, hints] of Object.entries(TITLE_HINTS)) {
    if (title && hints.some((h) => wordMatch(title, h))) return category;
  }
  for (const [category, names] of Object.entries(APPS)) {
    if (app && names.some((n) => wordMatch(app, n))) return category;
  }
  return 'other';
}
