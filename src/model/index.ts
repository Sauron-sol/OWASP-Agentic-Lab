import { AnthropicModel } from './anthropic.js';
import { ScriptedModel } from './scripted.js';
import type { Model } from './types.js';

export type { Model, PlanContext, PlanStep } from './types.js';
export { ScriptedModel } from './scripted.js';

export function loadModel(): Model {
  const choice = (process.env.AGENT_MODEL ?? 'scripted').toLowerCase();
  if (choice === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('AGENT_MODEL=anthropic but ANTHROPIC_API_KEY is not set');
    return new AnthropicModel(key);
  }
  return new ScriptedModel();
}
