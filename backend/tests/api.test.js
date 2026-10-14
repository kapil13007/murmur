// API integration tests against a real PostgreSQL test database.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, fixture, registerUser, resetDatabase, sequelize } from './helpers.js';

const V1 = '/api/v1';

before(resetDatabase);
after(() => sequelize.close());

function silentWav(seconds = 1) {
  const n = 16000 * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 2, 40);
  return buf;
}

describe('auth', () => {
  test('register, login, me and token revocation', async () => {
    const user = await registerUser({ email: 'alice@example.com' });
    assert.equal(user.user.email, 'alice@example.com');
    assert.match(user.user.referral_code, /^TEST\d{3}$/);

    await api().post(`${V1}/auth/register`).send({ email: 'ALICE@example.com', password: 'Secret123', first_name: 'A' }).expect(409);
    await api().post(`${V1}/auth/login`).send({ email: 'alice@example.com', password: 'nope-nope1' }).expect(401);
    const login = await api().post(`${V1}/auth/login`).send({ email: 'alice@example.com', password: 'Secret123' }).expect(200);

    const me = await api().get(`${V1}/users/me`).set('Authorization', `Bearer ${login.body.access_token}`).expect(200);
    assert.equal(me.body.subscription.status, 'trialing');
    assert.equal(me.body.subscription.is_pro, true);

    const changed = await api()
      .post(`${V1}/auth/change-password`)
      .set(user.auth)
      .send({ old_password: 'Secret123', new_password: 'Secret456' })
      .expect(200);
    // Old tokens are revoked, the fresh one works.
    await api().get(`${V1}/users/me`).set(user.auth).expect(401);
    await api().get(`${V1}/users/me`).set('Authorization', `Bearer ${changed.body.access_token}`).expect(200);
  });

  test('account locks after repeated failures', async () => {
    const user = await registerUser();
    for (let i = 0; i < 5; i++) {
      await api().post(`${V1}/auth/login`).send({ email: user.user.email, password: 'wrong-pass1' }).expect(401);
    }
    const locked = await api().post(`${V1}/auth/login`).send({ email: user.user.email, password: 'Secret123' }).expect(429);
    assert.equal(locked.body.code, 'account_locked');
  });

  test('private routes need a token', async () => {
    await api().get(`${V1}/history`).expect(401);
    await api().get(`${V1}/history`).set('Authorization', 'Bearer not-a-jwt').expect(401);
  });
});

describe('dictation pipeline', () => {
  test('real speech is transcribed, cleaned, styled and saved', async () => {
    const user = await registerUser();
    await api().post(`${V1}/dictionary`).set(user.auth).send({ phrase: 'Sarah' }).expect(201);
    await api().put(`${V1}/styles/personal`).set(user.auth).send({ style: 'very_casual' }).expect(200);

    const res = await api()
      .post(`${V1}/dictation/transcribe`)
      .set(user.auth)
      .attach('audio', fixture('lunch.wav'), 'lunch.wav')
      .field('app_name', 'WhatsApp')
      .field('mode', 'push_to_talk')
      .expect(200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.transcript.app_category, 'personal');
    assert.equal(res.body.transcript.personalization.style, 'very_casual');
    // Filler gone, very casual style applied, proper noun kept.
    assert.match(res.body.text, /^hey Sarah,? are you free for lunch on Friday\?$/);

    const history = await api().get(`${V1}/history`).set(user.auth).expect(200);
    assert.equal(history.body.items.length, 1);
    assert.equal(history.body.items[0].has_audio, true);

    const audio = await api().get(`${V1}/history/${res.body.transcript.id}/audio`).set(user.auth).expect(200);
    assert.equal(audio.headers['content-type'], 'audio/wav');

    const stats = await api().get(`${V1}/stats/summary`).set(user.auth).expect(200);
    assert.equal(stats.body.total_dictations, 1);
    assert.ok(stats.body.total_words >= 8);
    assert.equal(stats.body.day_streak, 1);
  });

  test('silence is reported as no_audio and not counted', async () => {
    const user = await registerUser();
    const res = await api().post(`${V1}/dictation/transcribe`).set(user.auth).attach('audio', silentWav(), 'silence.wav').expect(200);
    assert.equal(res.body.status, 'no_audio');
    const stats = await api().get(`${V1}/stats/summary`).set(user.auth).expect(200);
    assert.equal(stats.body.total_words, 0);
  });

  test('"never store" privacy keeps nothing but still returns text', async () => {
    const user = await registerUser();
    await api().patch(`${V1}/preferences`).set(user.auth).send({ data_retention: 'never_store' }).expect(200);
    const res = await api().post(`${V1}/dictation/transcribe`).set(user.auth).attach('audio', fixture('lunch.wav'), 'lunch.wav').expect(200);
    assert.equal(res.body.status, 'success');
    const history = await api().get(`${V1}/history`).set(user.auth).expect(200);
    assert.equal(history.body.items.length, 0);
  });

  test('rejects non-WAV uploads', async () => {
    const user = await registerUser();
    await api().post(`${V1}/dictation/transcribe`).set(user.auth).attach('audio', Buffer.from('not audio at all'), 'x.mp3').expect(415);
  });

  test('typed text goes through the same formatter with snippets', async () => {
    const user = await registerUser();
    await api().post(`${V1}/snippets`).set(user.auth).send({ phrase: 'my calendar link', replacement: 'https://cal.com/test' }).expect(201);
    const res = await api()
      .post(`${V1}/dictation/format`)
      .set(user.auth)
      .send({ text: 'um book a slot here my calendar link', app_name: 'Notepad' })
      .expect(200);
    assert.equal(res.body.text, 'Book a slot here https://cal.com/test');
    assert.equal(res.body.snippets_expanded, 1);
  });

  test('weekly allowance blocks Basic users at the limit', async () => {
    const user = await registerUser();
    await api().post(`${V1}/billing/cancel`).set(user.auth).expect(200); // end trial -> Basic
    await sequelize.query(
      `INSERT INTO daily_activity (user_id, activity_date, words, dictations, duration_seconds) VALUES (:id, CURRENT_DATE, 5000, 1, 60)`,
      { replacements: { id: user.user.id } },
    );
    const res = await api().post(`${V1}/dictation/transcribe`).set(user.auth).attach('audio', fixture('lunch.wav'), 'lunch.wav').expect(402);
    assert.equal(res.body.code, 'weekly_limit_reached');
  });
});

describe('history editing and learning', () => {
  test('edits teach the dictionary new words', async () => {
    const user = await registerUser();
    const dictation = await api().post(`${V1}/dictation/transcribe`).set(user.auth).attach('audio', fixture('lunch.wav'), 'lunch.wav').expect(200);
    const id = dictation.body.transcript.id;
    const edited = dictation.body.text.replace(/Sarah/, 'Saarah');
    const patched = await api().patch(`${V1}/history/${id}`).set(user.auth).send({ edited_text: edited }).expect(200);
    assert.equal(patched.body.text, edited);
    assert.deepEqual(patched.body.learned_words.map((w) => w.phrase), ['Saarah']);

    const dict = await api().get(`${V1}/dictionary`).set(user.auth).expect(200);
    assert.equal(dict.body.items[0].source, 'auto_learned');

    await api().patch(`${V1}/history/${id}`).set(user.auth).send({ is_archived: true }).expect(200);
    assert.equal((await api().get(`${V1}/history`).set(user.auth)).body.items.length, 0);
    assert.equal((await api().get(`${V1}/history?archived=true`).set(user.auth)).body.items.length, 1);
    await api().delete(`${V1}/history/${id}`).set(user.auth).expect(204);
  });

  test('history items carry timestamps and paginate with a cursor', async () => {
    const user = await registerUser();
    for (let i = 0; i < 2; i++) {
      await api().post(`${V1}/dictation/transcribe`).set(user.auth).attach('audio', fixture('lunch.wav'), 'lunch.wav').expect(200);
    }
    const first = await api().get(`${V1}/history?limit=1`).set(user.auth).expect(200);
    assert.equal(first.body.items.length, 1);
    assert.ok(Date.parse(first.body.items[0].created_at), 'created_at must be a timestamp');
    assert.equal(first.body.has_more, true);
    const second = await api().get(`${V1}/history?limit=1&before=${encodeURIComponent(first.body.next_before)}`).set(user.auth).expect(200);
    assert.equal(second.body.items.length, 1);
    assert.notEqual(second.body.items[0].id, first.body.items[0].id);
    assert.equal(second.body.has_more, false);
  });

  test("users can't see each other's data", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const dictation = await api().post(`${V1}/dictation/transcribe`).set(a.auth).attach('audio', fixture('lunch.wav'), 'lunch.wav').expect(200);
    await api().get(`${V1}/history/${dictation.body.transcript.id}`).set(b.auth).expect(404);
    await api().delete(`${V1}/history/${dictation.body.transcript.id}`).set(b.auth).expect(404);
  });
});

describe('dictionary and snippets', () => {
  test('CRUD, duplicates, starring, import and bulk delete', async () => {
    const user = await registerUser();
    const word = await api().post(`${V1}/dictionary`).set(user.auth).send({ phrase: 'Kubernetes' }).expect(201);
    await api().post(`${V1}/dictionary`).set(user.auth).send({ phrase: 'kubernetes' }).expect(409);
    await api().put(`${V1}/dictionary/${word.body.id}`).set(user.auth).send({ is_starred: true }).expect(200);
    const imported = await api()
      .post(`${V1}/dictionary/import`)
      .set(user.auth)
      .send({ text: 'Supabase\nwisper flow -> Wispr Flow\nKubernetes' })
      .expect(200);
    assert.deepEqual(imported.body, { created: 2, skipped: 1, errors: [] });

    const list = await api().get(`${V1}/dictionary?sort=starred`).set(user.auth).expect(200);
    assert.equal(list.body.items[0].phrase, 'Kubernetes');
    assert.equal(list.body.items.length, 3);

    const del = await api().post(`${V1}/dictionary/bulk-delete`).set(user.auth).send({ ids: list.body.items.map((i) => i.id) }).expect(200);
    assert.equal(del.body.deleted, 3);
    // Snippets are a separate view over the same table.
    await api().post(`${V1}/snippets`).set(user.auth).send({ phrase: 'sig', replacement: '' }).expect(422);
  });
});

describe('teams', () => {
  test('shared vocabulary reaches teammates; ownership transfers on leave', async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const created = await api().post(`${V1}/teams`).set(owner.auth).send({ name: 'Acme' }).expect(201);
    const code = created.body.team.invite_code;

    const word = await api().post(`${V1}/dictionary`).set(owner.auth).send({ phrase: 'Acmeify', share_with_team: true }).expect(201);
    assert.equal(word.body.is_shared, true);

    await api().post(`${V1}/teams/join`).set(member.auth).send({ invite_code: code }).expect(200);
    const memberView = await api().get(`${V1}/dictionary?scope=team`).set(member.auth).expect(200);
    assert.deepEqual(memberView.body.items.map((i) => i.phrase), ['Acmeify']);
    // Members can't edit someone else's shared word.
    await api().put(`${V1}/dictionary/${word.body.id}`).set(member.auth).send({ phrase: 'Nope' }).expect(403);

    await api().post(`${V1}/teams/leave`).set(owner.auth).expect(200);
    const after = await api().get(`${V1}/teams/me`).set(member.auth).expect(200);
    assert.equal(after.body.team.is_owner, true);
    assert.equal(after.body.team.my_role, 'admin');
  });
});

describe('notes, transforms, billing, export', () => {
  test('notes keep restorable versions', async () => {
    const user = await registerUser();
    // A quick note's first line becomes the title.
    const note = await api().post(`${V1}/notes`).set(user.auth).send({ content: 'Ideas\nfirst draft' }).expect(201);
    assert.equal(note.body.title, 'Ideas');
    assert.equal(note.body.content, 'first draft');
    await api().patch(`${V1}/notes/${note.body.id}`).set(user.auth).send({ content: 'second draft' }).expect(200);
    const versions = await api().get(`${V1}/notes/${note.body.id}/versions`).set(user.auth).expect(200);
    assert.equal(versions.body.length, 1);
    const restored = await api().post(`${V1}/notes/${note.body.id}/versions/${versions.body[0].id}/restore`).set(user.auth).expect(200);
    assert.equal(restored.body.content, 'first draft');
  });

  test('transforms run offline and custom prompts need an LLM', async () => {
    const user = await registerUser();
    const list = await api().get(`${V1}/transforms`).set(user.auth).expect(200);
    const bullets = list.body.find((t) => t.name === 'Bullet points');
    const run = await api().post(`${V1}/transforms/apply`).set(user.auth).send({ text: 'Buy milk. Call mom.', transform_id: bullets.id }).expect(200);
    assert.equal(run.body.output_text, '- Buy milk\n- Call mom');
    await api().post(`${V1}/transforms/apply`).set(user.auth).send({ text: 'hello', instruction: 'Translate to German' }).expect(503);
    await api().delete(`${V1}/transforms/${bullets.id}`).set(user.auth).expect(403);
  });

  test('billing lifecycle', async () => {
    const user = await registerUser();
    const paid = await api()
      .post(`${V1}/billing/checkout`)
      .set(user.auth)
      .send({ plan: 'FLOW_PRO', interval: 'month', cardholder_name: 'Test', card_last4: '4242' })
      .expect(200);
    assert.equal(paid.body.status, 'active');
    assert.equal((await api().post(`${V1}/billing/cancel`).set(user.auth).expect(200)).body.cancel_at_period_end, true);
    assert.equal((await api().post(`${V1}/billing/resume`).set(user.auth).expect(200)).body.cancel_at_period_end, false);
    const history = await api().get(`${V1}/billing/history`).set(user.auth).expect(200);
    assert.deepEqual(history.body.map((e) => e.event_type), ['cancel_reverted', 'cancel_scheduled', 'payment_succeeded', 'trial_started']);
  });

  test('export contains every section and delete-account removes everything', async () => {
    const user = await registerUser();
    await api().post(`${V1}/notes`).set(user.auth).send({ content: 'keep me' }).expect(201);
    const exported = await api().get(`${V1}/data/export`).set(user.auth).expect(200);
    assert.equal(exported.body.notes.length, 1);
    assert.equal(exported.body.styles.length, 4);
    await api().delete(`${V1}/users/me`).set(user.auth).send({ password: 'wrong' }).expect(400);
    await api().delete(`${V1}/users/me`).set(user.auth).send({ password: user.password }).expect(204);
    const [[{ n }]] = await sequelize.query('SELECT count(*)::int AS n FROM notes WHERE user_id = :id', { replacements: { id: user.user.id } });
    assert.equal(n, 0);
  });
});
