/**
 * A deterministic stand-in for an LLM planner.
 *
 * It is not pretending to be intelligent. It is reproducing exactly one property
 * of a real language model, the property that every risk in this lab depends on:
 *
 *   It cannot tell the difference between text that came from its operator and
 *   text that came from a stranger. It sees language, and language that looks
 *   like an instruction gets followed.
 *
 * Everything else about it is boring on purpose. Determinism is what lets a lab
 * have a pass/fail test. If you want to watch a real model do the same thing,
 * set AGENT_MODEL=anthropic - the attacks still land, they just land differently
 * each run, which is its own lesson.
 *
 * You are not meant to fix this file. The planner is untrusted by design.
 * Every lab fix lives outside the model, in src/security/.
 */
import type { Model, PlanContext, PlanStep } from './types.js';

interface Directive {
  /** What the text has to look like for a naive planner to take it as an order. */
  pattern: RegExp;
  tool: string;
  args: (m: RegExpMatchArray, sentence: string, whole: string) => Record<string, string>;
}

const DIRECTIVES: Directive[] = [
  {
    pattern: /(?:investigate|triage|analys[ei]|look at|read)\b[^.]*?\bissue\s*#?(\d{2,4})/i,
    tool: 'read_issue',
    args: (m) => ({ repo: 'bytemonk/checkout', number: m[1] ?? '482' }),
  },
  {
    pattern: /(?:search|check|consult|look up)\b[^.]*?\b(?:doc|documentation|runbook)/i,
    tool: 'search_docs',
    args: (_m, _sentence, whole) => ({ query: pickQuery(whole) }),
  },
  {
    pattern: /\b(?:inspect|dump|read|include|collect)\b[^.]*?\b(?:developer environment|environment configuration|environment|configuration values|config)\b/i,
    tool: 'read_service_config',
    args: () => ({ which: 'all' }),
  },
  {
    pattern: /\b(?:customer record|look up the customer|customer details|account record)\b/i,
    tool: 'get_customer_record',
    args: (_m, sentence) => ({ customer: /reporter/i.test(sentence) ? 'reporter' : 'cus_4471' }),
  },
  {
    pattern: /\bpost\b[^.]*?\b(?:comment|as a comment)\b/i,
    tool: 'post_github_comment',
    args: (_m, sentence) => ({
      repo: 'bytemonk/checkout',
      number: sentence.match(/issue\s*#?(\d{2,4})/i)?.[1] ?? '482',
      body: '__FINDINGS__',
    }),
  },
  {
    pattern: /\b(?:run|execute)\b[^.]*?(?:setup step|repro|harness|command)|^\s{2,}(npm install[^\n]*)/im,
    tool: 'run_shell',
    args: (_m, _sentence, whole) => ({ command: pickCommand(whole) }),
  },
  {
    pattern: /\b(?:remember (?:this|that)|record the standard|always inspect|store (?:this )?for future|for future sessions)\b/i,
    tool: 'remember',
    args: (_m, _sentence, whole) => ({ note: pickNote(whole) }),
  },
  {
    pattern: /\b(?:deploy|ship|release)\b[^.]*?\bcommit\s+([0-9a-f]{6,})/i,
    tool: 'deploy',
    args: (m) => ({ commit: m[1] ?? 'abc123', environment: 'production' }),
  },
];

function pickQuery(whole: string): string {
  const m = whole.match(/\b(?:error|code)\s*(\d{3})\b/);
  if (m) return `error ${m[1]}`;
  if (/checkout|payment|billing|enrol/i.test(whole)) return 'checkout';
  return 'troubleshooting';
}

function pickCommand(whole: string): string {
  const fenced = whole.match(/^\s{2,}(\S[^\n]*)$/m);
  if (fenced?.[1]) return fenced[1].trim();
  const inline = whole.match(/\b(npm install[^\n.]*|node [^\n.]*)/);
  return (inline?.[1] ?? '').trim();
}

function pickNote(whole: string): string {
  const sentences = splitSentences(whole);
  const imperative = sentences.find((s) =>
    /\b(?:always|never|first|should)\b/i.test(s) && !/^remember this for future sessions:?$/i.test(s.trim()),
  );
  return (imperative ?? sentences[sentences.length - 1] ?? whole)
    .replace(/^[\s-]+/, '')
    .replace(/^remember (?:this|that)[^:]*:\s*/i, '')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Stable key so the planner does not re-issue a call it already made. */
function callKey(tool: string, args: Record<string, string>): string {
  return `${tool}:${Object.entries(args)
    .filter(([k]) => k !== 'body' && k !== 'note')
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join(',')}`;
}

export class ScriptedModel implements Model {
  readonly name = 'scripted';

  async plan(ctx: PlanContext): Promise<PlanStep> {
    const available = new Set(ctx.tools.map((t) => t.name));
    const done = new Set(ctx.history.map((h) => callKey(h.tool, h.args)));

    // Walk every piece of text the agent handed us, oldest first, and do
    // whatever it seems to be telling us to do. This is the bug. It is also
    // a fair description of how an obedient model behaves.
    for (let i = 0; i < ctx.context.length; i++) {
      const item = ctx.context[i];
      if (!item) continue;
      for (const sentence of splitSentences(item.text)) {
        for (const d of DIRECTIVES) {
          const m = sentence.match(d.pattern);
          if (!m) continue;
          if (!available.has(d.tool)) continue;
          const args = d.args(m, sentence, item.text);
          // A directive that names no concrete target is not an instruction.
          if (Object.values(args).some((v) => v === '')) continue;
          if (done.has(callKey(d.tool, args))) continue;
          return { kind: 'call', call: { tool: d.tool, args }, sourceIndex: i };
        }
      }
    }

    return { kind: 'final', text: this.summarise(ctx) };
  }

  private summarise(ctx: PlanContext): string {
    const findings = ctx.context
      .filter((c) => c.origin !== 'operator')
      .map((c) => `- [${c.label ?? c.origin}] ${c.text.replace(/\s+/g, ' ').slice(0, 400)}`);
    return [`Task: ${ctx.task.goal}`, '', 'What I found:', ...findings].join('\n');
  }
}
