// File: scripts/seed.js
// Creates a demo account with realistic data so every screen has something to
// show: ~6 weeks of dictation history across apps, vocabulary, snippets, a
// transform run and a few notifications.
//
//   npm run seed            create the demo user (skips if it exists)
//   npm run seed -- --reset delete and recreate it
import { addDays, localDate } from '../app/core/dates.js';
import { sequelize } from '../app/db/session.js';
import { createMigrator } from '../app/db/migrator.js';
import { incrementAppUsage, incrementDailyActivity } from '../app/crud/activity_crud.js';
import { getUserByEmail } from '../app/crud/user_crud.js';
import { DictionaryEntry, Transcript, TransformRun, Transform } from '../app/models/index.js';
import { registerUser } from '../app/services/auth_service.js';
import { categorizeApp } from '../app/services/app_category_service.js';
import { countWords } from '../app/services/formatting/text_utils.js';
import { notify } from '../app/services/notification_service.js';

export const DEMO_EMAIL = 'demo@murmur.local';
export const DEMO_PASSWORD = 'Demo12345';
const TIMEZONE = 'Asia/Kolkata';

const SAMPLES = [
  ['Slack', null, "hey team um quick update, the API migration is done and um tests are green", "Hey team, quick update: the API migration is done and tests are green"],
  ['Slack', null, "can someone review my PR for the billing page when they get a chance", "Can someone review my PR for the billing page when they get a chance?"],
  ['Google Chrome', 'https://mail.google.com/mail/u/0/', "hi priya, thanks for the detailed notes. I'll send the revised proposal by thursday. best, alex", "Hi Priya,\n\nThanks for the detailed notes. I'll send the revised proposal by Thursday.\n\nBest,\nAlex"],
  ['ChatGPT', null, "write a postgres query that returns the top five customers by revenue in the last quarter", "Write a Postgres query that returns the top five customers by revenue in the last quarter."],
  ['Notion', null, "the onboarding flow should ask for the role first then the apps they type in most", "The onboarding flow should ask for the role first, then the apps they type in most."],
  ['WhatsApp', null, "running ten minutes late, save me a seat", "running ten minutes late, save me a seat"],
  ['Code', null, "refactor this function to use async await and add error handling for the network call", "Refactor this function to use async/await and add error handling for the network call."],
  ['Microsoft Outlook', null, "hello marcus, attaching the Q3 report. let me know if you have questions. thanks, alex", "Hello Marcus,\n\nAttaching the Q3 report. Let me know if you have questions.\n\nThanks,\nAlex"],
  ['Slack', null, "lets move standup to 10 30, actually make it 11", "Let's move standup to 11"],
  ['Google Chrome', 'https://www.linkedin.com/feed/', "excited to share that our team just shipped voice dictation in every app", "Excited to share that our team just shipped voice dictation in every app!"],
  ['Notion', null, "action items one finalize pricing two update the docs three schedule the launch review", "Action items:\n1. Finalize pricing\n2. Update the docs\n3. Schedule the launch review"],
  ['WhatsApp', null, "happy birthday!! hope you have the best day", "happy birthday!! hope you have the best day"],
  ['ChatGPT', null, "explain the difference between kubernetes deployments and stateful sets with an example", "Explain the difference between Kubernetes deployments and StatefulSets with an example."],
  ['Slack', null, "um I think we should uh push the release to friday so QA has time", "I think we should push the release to Friday so QA has time"],
];

async function seedTranscripts(user) {
  const today = localDate(TIMEZONE);
  let made = 0;
  for (let daysAgo = 42; daysAgo >= 0; daysAgo--) {
    // Skip some days so the streaks look real (the last 5 days are a streak).
    if (daysAgo > 5 && (daysAgo % 3 === 0 || daysAgo % 7 === 4)) continue;
    const date = addDays(today, -daysAgo);
    const perDay = 1 + ((daysAgo * 7) % 4);
    for (let i = 0; i < perDay; i++) {
      const [app, url, asr, formatted] = SAMPLES[(daysAgo * 3 + i) % SAMPLES.length];
      const words = countWords(formatted);
      const duration = Math.max(2, words / 2.4);
      const createdAt = new Date(`${date}T${String(9 + i * 3).padStart(2, '0')}:${String((daysAgo * 13 + i * 7) % 60).padStart(2, '0')}:00+05:30`);
      const category = categorizeApp({ appName: app, url });
      await Transcript.create(
        {
          user_id: user.id,
          status: 'success',
          mode: i % 4 === 3 ? 'hands_free' : 'push_to_talk',
          asr_text: asr,
          formatted_text: formatted,
          app_name: app,
          app_category: category,
          url,
          language: 'en',
          num_words: words,
          duration_seconds: duration + 0.6,
          speech_duration_seconds: duration,
          asr_provider: 'local',
          asr_model: 'onnx-community/whisper-base',
          formatter: 'rules',
          asr_latency_ms: 650 + ((i * 97) % 300),
          format_latency_ms: 4,
          e2e_latency_ms: 700 + ((i * 131) % 350),
          personalization: { category, style: category === 'personal' ? 'casual' : 'formal', cleanup_level: 'light' },
          created_at: createdAt,
          updated_at: createdAt,
        },
        { silent: true },
      );
      await incrementDailyActivity(user.id, date, { words, duration });
      await incrementAppUsage(user.id, app, category, words);
      made++;
    }
  }
  // Timestamps were set explicitly; make sure Sequelize didn't override them.
  await sequelize.query('UPDATE transcripts SET updated_at = created_at WHERE user_id = :id', { replacements: { id: user.id } });
  return made;
}

async function main() {
  const reset = process.argv.includes('--reset');
  await createMigrator({ logger: { info() {}, warn: console.warn, error: console.error, debug() {} } }).up();

  const existing = await getUserByEmail(DEMO_EMAIL);
  if (existing && !reset) {
    console.log(`Demo user already exists: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (use --reset to recreate)`);
    return;
  }
  if (existing) await existing.destroy();

  const user = await registerUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    first_name: 'Alex',
    last_name: 'Rivera',
    timezone: TIMEZONE,
  });
  user.onboarding_completed = true;
  user.onboarding_completed_at = new Date();
  user.product_intent = 'dictation';
  await user.save();

  const transcripts = await seedTranscripts(user);

  const words = [
    ['Kubernetes', null, 'manual'],
    ['Supabase', null, 'manual'],
    ['StatefulSets', null, 'auto_learned'],
    ['Priya', null, 'auto_learned'],
    ['mur mur', 'Murmur', 'manual'],
    ['Q three', 'Q3', 'manual'],
    ['Rivera', null, 'manual'],
  ];
  for (const [phrase, replacement, source] of words) {
    await DictionaryEntry.create({ user_id: user.id, phrase, replacement, source, is_starred: phrase === 'Kubernetes', frequency_used: phrase.length % 5 });
  }
  const snippets = [
    ['my calendar link', 'https://cal.com/alex-rivera/30min'],
    ['my address', '221B Baker Street, London NW1 6XE'],
    ['standup template', 'Yesterday:\n- \n\nToday:\n- \n\nBlockers:\n- None'],
  ];
  for (const [phrase, replacement] of snippets) {
    await DictionaryEntry.create({ user_id: user.id, phrase, replacement, is_snippet: true, frequency_used: 3 });
  }

  const polish = await Transform.findOne({ where: { user_id: user.id, name: 'Polish' } });
  await TransformRun.create({
    user_id: user.id,
    transform_id: polish.id,
    instruction: polish.instruction,
    input_text: 'so um i think we should like push the launch to friday because qa found bugs',
    output_text: 'I think we should push the launch to Friday because QA found bugs.',
    input_word_count: 16,
    output_word_count: 13,
    status: 'success',
    provider: 'rules',
    processing_ms: 6,
  });

  await notify(user.id, {
    type: 'milestone',
    key: 'milestone:words:500',
    title: "You've dictated 500 words!",
    body: "That's about 13 minutes of typing saved. Keep it going.",
    action_label: 'See history',
    action_url: '/',
  });
  await notify(user.id, {
    type: 'learning',
    key: 'learning:seed',
    title: 'Murmur learned 2 new words',
    body: 'Added "Priya", "StatefulSets" to your dictionary so they\'re spelled right next time.',
    action_label: 'Open dictionary',
    action_url: '/dictionary',
  });

  console.log(`Seeded demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD} with ${transcripts} dictations.`);
}

main()
  .catch((err) => {
    console.error(`Seeding failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
