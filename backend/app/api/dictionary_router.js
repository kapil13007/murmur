// File: app/api/dictionary_router.js
// Vocabulary words and misspelling corrections (Wispr's `/api/v1/dictionary`).
import { CreateWordRequest, UpdateWordRequest } from '../schemas/dictionary_schema.js';
import { buildEntryRouter } from './entry_routes.js';

export default buildEntryRouter({
  isSnippet: false,
  createSchema: CreateWordRequest,
  updateSchema: UpdateWordRequest,
});
