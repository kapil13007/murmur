// File: app/services/transform_service.js
// Transforms: one-click AI rewrites of a piece of text ("Polish", "Make it
// concise", custom prompts). Every run is logged so it can be reviewed/undone.
import { conflict, forbidden, notFound } from '../core/errors.js';
import { getPreferences } from '../crud/preference_crud.js';
import {
  createTransform,
  createTransformRun,
  deleteTransform,
  getTransform,
  getTransformRun,
  listTransformRuns,
  listTransforms,
  updateTransform,
} from '../crud/transform_crud.js';
import { Transform } from '../models/index.js';
import { toTransformOut, toTransformRunOut } from '../schemas/transform_schema.js';
import { buildPolishInstruction } from './llm/prompts.js';
import { countWords } from './formatting/text_utils.js';
import { runTextInstruction } from './text_instruction_service.js';

export async function getTransforms(userId) {
  return (await listTransforms(userId)).map(toTransformOut);
}

export async function addTransform(userId, data) {
  if (await Transform.findOne({ where: { user_id: userId, name: data.name } })) {
    throw conflict('You already have a transform with that name');
  }
  return toTransformOut(await createTransform(userId, data));
}

export async function editTransform(userId, id, changes) {
  const transform = await getTransform(userId, id);
  if (!transform) throw notFound('Transform not found');
  if (transform.is_builtin && (changes.name || changes.instruction)) {
    throw forbidden('Built-in transforms can be reordered or turned off, but not renamed or rewritten');
  }
  return toTransformOut(await updateTransform(transform, changes));
}

export async function removeTransform(userId, id) {
  const transform = await getTransform(userId, id);
  if (!transform) throw notFound('Transform not found');
  if (transform.is_builtin) throw forbidden('Built-in transforms can be turned off, but not deleted');
  await deleteTransform(userId, id);
}

// Resolves the instruction for a run. "Polish" is assembled from the user's
// polish toggles (Transforms page) rather than a fixed prompt.
async function resolveInstruction(userId, { transform_id, instruction }) {
  if (!transform_id) return { transform: null, instruction, llmInstruction: instruction };
  const transform = await getTransform(userId, transform_id);
  if (!transform) throw notFound('Transform not found');
  if (transform.is_builtin && transform.name === 'Polish') {
    const prefs = await getPreferences(userId);
    return { transform, instruction: transform.instruction, llmInstruction: buildPolishInstruction(prefs.polish_instructions) };
  }
  return { transform, instruction: transform.instruction, llmInstruction: transform.instruction };
}

export async function applyTransform(userId, { text, transform_id, instruction, app_name }) {
  const resolved = await resolveInstruction(userId, { transform_id, instruction });
  const base = {
    user_id: userId,
    transform_id: resolved.transform ? resolved.transform.id : null,
    instruction: resolved.instruction,
    input_text: text,
    input_word_count: countWords(text),
    app_name: app_name || null,
  };
  try {
    const result = await runTextInstruction({
      purpose: 'transform',
      instruction: resolved.instruction,
      llmInstruction: resolved.llmInstruction,
      text,
    });
    const unchanged = result.output.trim() === text.trim();
    const run = await createTransformRun({
      ...base,
      output_text: result.output,
      output_word_count: countWords(result.output),
      status: unchanged ? 'no_changes' : 'success',
      provider: result.provider,
      model: result.model,
      processing_ms: result.processing_ms,
    });
    run.transform = resolved.transform;
    return toTransformRunOut(run);
  } catch (err) {
    await createTransformRun({ ...base, status: 'error' });
    throw err;
  }
}

export async function getTransformHistory(userId) {
  return (await listTransformRuns(userId)).map(toTransformRunOut);
}

export async function markRunUndone(userId, runId) {
  const run = await getTransformRun(userId, runId);
  if (!run) throw notFound('Transform run not found');
  run.is_undone = true;
  await run.save();
  return toTransformRunOut(run);
}
