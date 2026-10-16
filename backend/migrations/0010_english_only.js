// Migration 0010: Murmur currently supports English only. Existing accounts
// that picked other languages are moved to English so Whisper never has to
// guess the language of a short clip. Re-enable more languages by extending
// SUPPORTED_LANGUAGES in app/models/constants.js.
export async function up({ queryInterface }) {
  await queryInterface.sequelize.query("UPDATE user_preferences SET selected_languages = ARRAY['en']::varchar(10)[]");
}

export async function down() {
  // The languages people had selected are not recoverable; nothing to undo.
}
