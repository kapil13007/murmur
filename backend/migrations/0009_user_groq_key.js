// Migration 0009: each user's own Groq API key (encrypted at rest).
// Murmur's public server doesn't pay for anyone's speech-to-text or AI
// cleanup: users paste their free Groq key in Settings.
export async function up({ queryInterface, Sequelize }) {
  await queryInterface.addColumn('users', 'groq_key_encrypted', { type: Sequelize.TEXT, allowNull: true });
  await queryInterface.addColumn('users', 'groq_key_last4', { type: Sequelize.STRING(4), allowNull: true });
}

export async function down({ queryInterface }) {
  await queryInterface.removeColumn('users', 'groq_key_last4');
  await queryInterface.removeColumn('users', 'groq_key_encrypted');
}
