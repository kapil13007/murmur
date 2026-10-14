// File: app/api/snippets_router.js
// Voice shortcuts that expand into longer text ("my calendar link" -> URL).
import { CreateSnippetRequest, UpdateSnippetRequest } from '../schemas/dictionary_schema.js';
import { buildEntryRouter } from './entry_routes.js';

export default buildEntryRouter({
  isSnippet: true,
  createSchema: CreateSnippetRequest,
  updateSchema: UpdateSnippetRequest,
});
