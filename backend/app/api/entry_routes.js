// File: app/api/entry_routes.js
// Route builder shared by dictionary_router (vocabulary) and snippets_router:
// both are views over `dictionary_entries`, filtered by `is_snippet`.
import { Router } from 'express';
import { notFound } from '../core/errors.js';
import { uuidParam, validate } from '../core/validators.js';
import { BulkIdsRequest, ImportRequest, ListEntriesQuery } from '../schemas/dictionary_schema.js';
import { addEntry, editEntry, importEntries, listForUser, removeEntries } from '../services/dictionary_service.js';

export function buildEntryRouter({ isSnippet, createSchema, updateSchema }) {
  const router = Router();
  const label = isSnippet ? 'Snippet' : 'Word';

  router.get('', validate({ query: ListEntriesQuery }), async (req, res) => {
    res.json(await listForUser(req.user, req.validatedQuery, isSnippet));
  });

  router.post('', validate({ body: createSchema }), async (req, res) => {
    res.status(201).json(await addEntry(req.user, req.body, isSnippet));
  });

  router.post('/bulk-delete', validate({ body: BulkIdsRequest }), async (req, res) => {
    res.json(await removeEntries(req.user, req.body.ids, isSnippet));
  });

  router.post('/import', validate({ body: ImportRequest }), async (req, res) => {
    res.json(await importEntries(req.user, req.body.text, isSnippet));
  });

  router.put('/:id', validate({ params: uuidParam(), body: updateSchema }), async (req, res) => {
    res.json(await editEntry(req.user, req.params.id, req.body, isSnippet));
  });

  router.delete('/:id', validate({ params: uuidParam() }), async (req, res) => {
    const { deleted } = await removeEntries(req.user, [req.params.id], isSnippet);
    if (!deleted) throw notFound(`${label} not found`);
    res.status(204).end();
  });

  return router;
}
