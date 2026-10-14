// Unit tests for the offline (no-LLM) instruction engine used by Command Mode
// and Transforms, and for learning vocabulary from edits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLocalInstruction, extractiveSummary } from '../app/services/text_instruction_service.js';
import { diffWords, extractLearnableCorrections } from '../app/services/dictionary_service.js';
import { categorizeApp } from '../app/services/app_category_service.js';
import { computeStreaks } from '../app/services/stats_service.js';

test('bullet lists respect line breaks and drop fillers', () => {
  const note = 'Groceries\num we need eggs, milk and bread\nbullet point call mom';
  assert.equal(applyLocalInstruction('Turn this into a bulleted list', note), '- Groceries\n- We need eggs, milk and bread\n- Call mom');
  assert.equal(applyLocalInstruction('make a numbered list', 'Open the app. Click save.'), '1. Open the app\n2. Click save');
});

test('case and tone instructions', () => {
  assert.equal(applyLocalInstruction('make this uppercase', 'ship it'), 'SHIP IT');
  assert.equal(applyLocalInstruction('title case please', 'the quick brown fox'), 'The Quick Brown Fox');
  assert.equal(applyLocalInstruction('make it more casual', 'Hey, see you at 5 pm.'), 'Hey, see you at 5 PM');
  assert.equal(applyLocalInstruction('translate to French', 'hello'), null);
});

test('extractive summary keeps the most informative sentences in order', () => {
  const text =
    'The launch is on Friday. The database migration must finish before the launch. Lunch was nice. Migration scripts for the database are ready and tested.';
  const summary = extractiveSummary(text, 2);
  assert.ok(summary.includes('database migration'));
  assert.ok(!summary.includes('Lunch'));
});

test('learning from edits picks up misheard terms, not rewrites', () => {
  assert.deepEqual(diffWords('meet at cooper netties', 'meet at Kubernetes'), [{ removed: ['cooper', 'netties'], added: ['Kubernetes'] }]);
  assert.deepEqual(extractLearnableCorrections('ping kapil about it', 'ping Kapil about it'), [{ phrase: 'Kapil', replacement: null }]);
  assert.deepEqual(extractLearnableCorrections('deploy to cooper netties', 'deploy to Kubernetes'), [
    { phrase: 'cooper netties', replacement: 'Kubernetes' },
  ]);
  // Ordinary rewording is not vocabulary.
  assert.deepEqual(extractLearnableCorrections('I think it is good', 'I believe it is great'), []);
});

test('apps and websites map to style categories', () => {
  assert.equal(categorizeApp({ appName: 'Google Chrome', url: 'https://mail.google.com/mail/u/0/' }), 'email');
  assert.equal(categorizeApp({ appName: 'Google Chrome', windowTitle: 'general (Channel) - Acme - Slack - Google Chrome' }), 'work');
  assert.equal(categorizeApp({ appName: 'WhatsApp' }), 'personal');
  assert.equal(categorizeApp({ appName: 'OUTLOOK' }), 'email');
  assert.equal(categorizeApp({ appName: 'Notepad' }), 'other');
  // User overrides on the Style page win.
  assert.equal(categorizeApp({ appName: 'Notion' }, [{ category: 'work', app_names: ['Notion'] }]), 'work');
});

test('streaks', () => {
  // Oct 8 falls in the previous Sunday-based week, so the week streak is 2.
  assert.deepEqual(computeStreaks(['2026-10-14', '2026-10-13', '2026-10-12', '2026-10-08'], '2026-10-14'), {
    day_streak: 3,
    longest_day_streak: 3,
    week_streak: 2,
  });
  // A gap of a whole week resets it.
  assert.equal(computeStreaks(['2026-10-14', '2026-10-01'], '2026-10-14').week_streak, 1);
  // Yesterday still counts; two days ago breaks the streak.
  assert.equal(computeStreaks(['2026-10-13'], '2026-10-14').day_streak, 1);
  assert.equal(computeStreaks(['2026-10-12'], '2026-10-14').day_streak, 0);
});
