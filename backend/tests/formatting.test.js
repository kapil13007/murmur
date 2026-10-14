// Unit tests for the offline formatting engine (no database or network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRules } from '../app/services/formatting/rules.js';
import { applyCorrections, applyVocabulary, expandSnippets } from '../app/services/formatting/dictionary.js';
import { cleanAsrText } from '../app/services/asr/index.js';

const fmt = (text, opts = {}) => applyRules(text, { cleanupLevel: 'light', style: 'formal', ...opts });

test('removes fillers and applies a spoken self-correction', () => {
  const raw =
    'Um, so I think we should, uh, meet tomorrow at 3 pm to go over the quarterly report. Actually, let\'s do 4 pm instead.';
  assert.equal(fmt(raw), 'So I think we should meet tomorrow at 4 PM to go over the quarterly report.');
});

test('inline corrections keep the final value', () => {
  assert.equal(fmt("Let's meet on Tuesday, no wait, Wednesday at noon."), "Let's meet on Wednesday at noon.");
  assert.equal(fmt('I need 5, sorry, 6 copies of the deck.'), 'I need 6 copies of the deck.');
});

test('"scratch that" deletes the previous sentence', () => {
  assert.equal(fmt('Send the report today. Actually, scratch that. Send it tomorrow.'), 'Send it tomorrow.');
  assert.equal(fmt('Book the big room scratch that book the small one'), 'Book the small one.');
});

test('removes stutters but keeps meaningful repeats', () => {
  assert.equal(fmt('I- I think the the plan is good'), 'I think the plan is good.');
  assert.equal(fmt('I know that that is true'), 'I know that that is true.');
});

test('the four Wispr styles', () => {
  const raw = 'Hey, are you free for lunch tomorrow? Let\'s do 12 if that works for you.';
  assert.equal(fmt(raw, { style: 'formal' }), "Hey, are you free for lunch tomorrow? Let's do 12 if that works for you.");
  assert.equal(fmt(raw, { style: 'casual' }), "Hey, are you free for lunch tomorrow? Let's do 12 if that works for you");
  assert.equal(fmt(raw, { style: 'very_casual' }), "hey are you free for lunch tomorrow? let's do 12 if that works for you");
  assert.equal(fmt(raw, { style: 'excited' }), "Hey, are you free for lunch tomorrow? Let's do 12 if that works for you!");
  // Proper nouns survive "very casual".
  assert.equal(fmt('Sarah is coming at 4 pm.', { style: 'very_casual' }), 'Sarah is coming at 4pm');
});

test('spoken formatting commands', () => {
  assert.equal(
    fmt('Hi team new paragraph the build is green new line please review question mark'),
    'Hi team\n\nThe build is green\nPlease review?',
  );
  assert.equal(fmt('I need a new line of credit'), 'I need a new line of credit.');
  // Self-corrections still work across line breaks.
  assert.equal(
    fmt('Agenda new line review budget new line meet at 2 pm. Actually, make it 3 pm.'),
    'Agenda\nReview budget\nMeet at 3 PM.',
  );
});

test('lists are detected from numbered speech', () => {
  assert.equal(
    fmt('My priorities are 1. Fix the bug, 2. Write tests, 3. Deploy.'),
    'My priorities are:\n1. Fix the bug\n2. Write tests\n3. Deploy',
  );
  assert.equal(
    fmt('The steps are: one, open the app, two, click settings, three, choose your language.'),
    'The steps are:\n1. Open the app\n2. Click settings\n3. Choose your language',
  );
  assert.equal(
    fmt('Bullet point eggs bullet point milk bullet point bread'),
    '- Eggs\n- Milk\n- Bread',
  );
  // Prose with number words is not a list.
  assert.equal(fmt('One of my friends has two cats and three dogs.'), 'One of my friends has two cats and three dogs.');
});

test('times are normalised without breaking sentences', () => {
  assert.equal(fmt('see you at 4 p.m. tomorrow'), 'See you at 4 PM tomorrow.');
  assert.equal(fmt('The call is at 9:30 a.m. Please join early.'), 'The call is at 9:30 AM. Please join early.');
});

test('medium cleanup removes discourse fillers', () => {
  assert.equal(
    fmt('So, you know, I was thinking, like, we could ship it on Friday.', { cleanupLevel: 'medium' }),
    'I was thinking we could ship it on Friday.',
  );
});

test('weekdays and dated months are capitalised, "like" after modals removed at medium', () => {
  assert.equal(fmt('lets ship it on friday or in may'), 'Lets ship it on Friday or in May.');
  assert.equal(fmt('you may want to march ahead'), 'You may want to march ahead.');
  assert.equal(fmt('so um i think we should like ship it friday', { cleanupLevel: 'medium' }), 'So I think we should ship it Friday.');
  assert.equal(fmt('I would like to ship it', { cleanupLevel: 'medium' }), 'I would like to ship it.');
});

test('cleanup level "none" keeps the transcript verbatim', () => {
  const raw = 'um so I think, uh, we should go';
  assert.equal(fmt(raw, { cleanupLevel: 'none' }), raw);
});

test('email layout puts greeting and sign-off on their own lines', () => {
  const raw = 'Hi Alex, it was great talking with you today. Looking forward to our next chat. Best, Mary.';
  assert.equal(
    fmt(raw, { category: 'email' }),
    'Hi Alex,\n\nIt was great talking with you today. Looking forward to our next chat.\n\nBest,\nMary',
  );
  // "Thanks for your help." is a sentence, not a sign-off.
  assert.equal(
    fmt('Hi Sam, the deck looks great. Thanks for your help.', { category: 'email' }),
    'Hi Sam,\n\nThe deck looks great. Thanks for your help.',
  );
});

test('non-English text only gets whitespace cleanup', () => {
  assert.equal(applyRules('  வணக்கம்   um  நண்பா ', { english: false }), 'வணக்கம் um நண்பா');
});

test('dictionary corrections, vocabulary and snippets', () => {
  const corrected = applyCorrections('I love wisper flow so much.', [{ id: 'c1', phrase: 'wisper flow', replacement: 'Wispr Flow' }]);
  assert.equal(corrected.text, 'I love Wispr Flow so much.');
  assert.equal(corrected.count, 1);

  const vocab = [
    { id: 'v1', phrase: 'ChatGPT' },
    { id: 'v2', phrase: 'Kubernetes' },
    { id: 'v3', phrase: 'Wispr Flow' },
    { id: 'v4', phrase: 'Kapil' },
  ];
  assert.equal(applyVocabulary('I asked chat gpt about it.', vocab).text, 'I asked ChatGPT about it.');
  assert.equal(applyVocabulary('Deploy it on Kubernets today.', vocab).text, 'Deploy it on Kubernetes today.');
  assert.equal(applyVocabulary('I use whisper flow daily.', vocab).text, 'I use Wispr Flow daily.');
  assert.equal(applyVocabulary("That is kapil's laptop.", vocab).text, "That is Kapil's laptop.");
  // Ordinary words are never "corrected".
  assert.equal(applyVocabulary('The capital of France is Paris.', vocab).text, 'The capital of France is Paris.');

  const snippets = [{ id: 's1', phrase: 'my calendar link', replacement: 'https://cal.com/prem' }];
  assert.equal(expandSnippets('My calendar link.', snippets).text, 'https://cal.com/prem');
  assert.equal(expandSnippets('Book a slot here: my calendar link.', snippets).text, 'Book a slot here: https://cal.com/prem');
});

test('ASR hallucination filter only applies to near-silent audio', () => {
  assert.equal(cleanAsrText('Thank you.', { weakSpeech: true }), '');
  assert.equal(cleanAsrText('Thank you.', { weakSpeech: false }), 'Thank you.');
  assert.equal(cleanAsrText('[BLANK_AUDIO]'), '');
});
