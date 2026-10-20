/**
 * Optional: run the same labs against a real model.
 *
 * Not required for any lab. It exists because the first question people ask is
 * "does this only work because your fake model is dumb?" - so go check. Set
 * AGENT_MODEL=anthropic and ANTHROPIC_API_KEY and watch a real planner make the
 * same category of mistake, less predictably.
 *
 * Note what does NOT change when you swap the planner: the fixes. Every control
 * you write in src/security/ sits outside the model and works either way. That
 * is the point of the exercise.
 */
import type { Model, PlanContext, PlanStep } from './types.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export class AnthropicModel implements Model {
  readonly name = 'anthropic';
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.AGENT_MODEL_ID ?? 'claude-sonnet-4-5',
  ) {}

  async plan(ctx: PlanContext): Promise<PlanStep> {
    const tools = ctx.tools.map((t) => `- ${t.name} (${t.effect}): ${t.description}`).join('\n');
    const context = ctx.context
      .map((c, i) => `[${i}] origin=${c.origin} label=${c.label ?? '-'}\n${c.text}`)
      .join('\n\n');
    const history = ctx.history.map((h) => `${h.tool}(${JSON.stringify(h.args)})`).join('\n') || 'none';

    const prompt = [
      `Goal from operator: ${ctx.task.goal}`,
      '',
      `Tools:\n${tools}`,
      '',
      `Context:\n${context}`,
      '',
      `Calls already made:\n${history}`,
      '',
      'Reply with ONLY one JSON object and no prose:',
      '{"kind":"call","call":{"tool":"name","args":{}},"sourceIndex":0}',
      'or',
      '{"kind":"final","text":"your summary"}',
    ].join('\n');

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`model request failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { kind: 'final', text: text || '(no plan returned)' };
    try {
      const parsed = JSON.parse(json) as PlanStep;
      if (parsed.kind === 'call' && typeof parsed.sourceIndex !== 'number') {
        return { ...parsed, sourceIndex: 0 };
      }
      return parsed;
    } catch {
      return { kind: 'final', text };
    }
  }
}
