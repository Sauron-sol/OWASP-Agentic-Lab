/**
 * LAB 02 - ASI02 Tool Misuse and Exploitation
 * ===========================================
 * The authorization boundary. This function is the difference between "the model
 * decided to call a tool" and "the action is allowed".
 *
 * Read labs/lab-02-tool-misuse/README.md. Run `npm run attack:02` first.
 */
import type { Decision, Tagged, Task, ToolCall } from '../types.js';
import { CUSTOMERS, FAKE_ENV } from '../world/fixtures.js';
import { findTool } from '../tools/index.js';

export interface PolicyInput {
  task: Task;
  call: ToolCall;
  /** Everything the agent has gathered so far, with origins intact. */
  context: Tagged[];
}

/** Values that must never leave the system, whatever the model's reasoning was. */
export const MUST_NOT_EGRESS: string[] = [
  ...Object.values(FAKE_ENV),
  ...CUSTOMERS.map((c) => c.internalNotes),
];

/** Origins whose content is confidential: they may feed reasoning, never a public sink. */
const CONFIDENTIAL_ORIGINS: readonly string[] = ['support-db', 'service-config'];

export function authorize(input: PolicyInput): Decision {
  const { task, call, context } = input;

  // 1. Least privilege: mounted is not granted.
  if (!task.allowedTools.includes(call.tool)) {
    return {
      allow: false,
      reason:
        `least privilege: ${call.tool} is mounted on the agent but not granted to task ${task.id}. ` +
        `"The agent has this tool" is not "this task may use it".`,
      asi: 'ASI02',
    };
  }

  // 2. Scope: right tool pointed at the wrong resource is still an incident.
  const s = task.scope;
  if (s.repo && call.args.repo && call.args.repo !== s.repo) {
    return deny(`scope: task concerns repo ${s.repo}, call targets ${call.args.repo}`);
  }
  if (s.issues?.length && call.args.number && !s.issues.includes(call.args.number)) {
    return deny(`scope: task concerns issues [${s.issues.join(', ')}], call targets #${call.args.number}`);
  }
  if (s.environment && call.args.environment && call.args.environment !== s.environment) {
    return deny(`scope: task is ${s.environment}, call reaches for ${call.args.environment} — the nine-second incident`);
  }

  // 3. Data flow: outbound writes are checked against where their payload came from.
  const effect = findTool(call.tool)?.spec.effect;
  if (effect && effect !== 'read') {
    const body = norm(call.args.body ?? '');

    for (const secret of MUST_NOT_EGRESS) {
      const n = norm(secret);
      if (n && body.includes(n)) {
        return deny(`data flow: payload contains a must-not-egress value (…${n.slice(0, 24)}…) — no reasoning justifies this`);
      }
    }
    for (const entry of context) {
      if (!CONFIDENTIAL_ORIGINS.includes(entry.origin)) continue;
      for (const chunk of norm(entry.text).split(/(?<=[.!?\n])\s+/)) {
        const c = chunk.trim();
        if (c.length >= 15 && body.includes(c)) {
          return deny(
            `data flow: content from ${entry.origin}${entry.label ? ` (${entry.label})` : ''} ` +
            `may not leave through ${call.tool} — confidential origin, public sink`,
          );
        }
      }
    }
  }

  return { allow: true };
}

function deny(reason: string): Decision {
  return { allow: false, reason, asi: 'ASI02' };
}

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}
