// Per-user Groq keys: encryption at rest, request-scoped lookup and the API.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerUser, resetDatabase, sequelize } from './helpers.js';
import { decryptSecret, encryptSecret } from '../app/core/secrets.js';
import { groqKey, requireGroqKey, runWithUserKey } from '../app/core/request_context.js';

const V1 = '/api/v1';

before(resetDatabase);
after(() => sequelize.close());

describe('secrets', () => {
  test('keys round-trip, are not stored in clear and differ per encryption', () => {
    const key = `gsk_${'x'.repeat(40)}`; // obviously fake
    const a = encryptSecret(key);
    assert.ok(!a.includes('gsk_'));
    assert.notEqual(a, encryptSecret(key));
    assert.equal(decryptSecret(a), key);
    assert.equal(decryptSecret('not-valid-base64-ciphertext'), null);
    assert.equal(decryptSecret(null), null);
  });

  test("a request sees its own user's key and nothing leaks between requests", async () => {
    const results = await Promise.all([
      runWithUserKey('gsk_user_one', async () => {
        await new Promise((r) => setTimeout(r, 15));
        return groqKey();
      }),
      runWithUserKey('gsk_user_two', async () => groqKey()),
    ]);
    assert.deepEqual(results, ['gsk_user_one', 'gsk_user_two']);
    assert.equal(runWithUserKey('gsk_x', () => requireGroqKey()), 'gsk_x');
  });
});

describe('groq key endpoints', () => {
  test('status starts empty, rejects malformed keys and can be removed', async () => {
    const user = await registerUser();
    const me = await api().get(`${V1}/users/me`).set(user.auth).expect(200);
    assert.deepEqual(me.body.groq_key, { has_key: false, last4: null, required: false });

    await api().put(`${V1}/users/me/groq-key`).set(user.auth).send({ key: 'sk-not-a-groq-key' }).expect(400);
    await api().put(`${V1}/users/me/groq-key`).set(user.auth).send({ key: '' }).expect(422);
    await api().put(`${V1}/users/me/groq-key`).send({ key: 'gsk_x' }).expect(401);

    const removed = await api().delete(`${V1}/users/me/groq-key`).set(user.auth).expect(200);
    assert.equal(removed.body.has_key, false);
  });

  test('stored keys never appear in API responses or exports', async () => {
    const user = await registerUser();
    await sequelize.query(`UPDATE users SET groq_key_encrypted = :enc, groq_key_last4 = 'wxyz' WHERE id = :id`, {
      replacements: { enc: 'ciphertext-placeholder', id: user.user.id },
    });
    const me = await api().get(`${V1}/users/me/groq-key`).set(user.auth).expect(200);
    assert.deepEqual(me.body, { has_key: true, last4: 'wxyz', required: false });
    const exported = await api().get(`${V1}/data/export`).set(user.auth).expect(200);
    assert.ok(!JSON.stringify(exported.body).includes('ciphertext-placeholder'));
    assert.ok(!JSON.stringify((await api().get(`${V1}/users/me`).set(user.auth)).body).includes('ciphertext-placeholder'));
  });
});
