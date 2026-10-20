/**
 * REFERENCE SOLUTION - lab 02, ASI02 Tool Misuse and Exploitation.
 * Drop-in replacement for src/security/policy.ts.
 */
import type { Decision, Origin, Tagged, Task, ToolCall } from '../../src/types.js';
import { CUSTOMERS, FAKE_ENV } from '../../src/world/fixtures.js';
import { findTool } from '../../src/tools/index.js';

export interface PolicyInput {
  task: Task;
  call: ToolCall;
  context: Tagged[];
}

export const MUST_NOT_EGRESS: string[] = [
  ...Object.values(FAKE_ENV),
  ...CUSTOMERS.map((c) => c.internalNotes),
];

/** Origins whose content must not be republished somewhere the world can read. */
const CONFIDENTIAL_ORIGINS: Origin[] = ['support-db', 'service-config'];

function deny(reason: string): Decision {
  return { allow: false, reason, asi: 'ASI02' };
}

export function authorize({ task, call, context }: PolicyInput): Decision {
  // 1. Least privilege. Mounted is not granted.
  if (!task.allowedTools.includes(call.tool)) {
    return deny(`tool ${call.tool} is mounted but not granted to task ${task.id}`);
  }

  // 2. Scope. Right tool, wrong target is still an incident.
  if (call.args.repo && task.scope.repo && call.args.repo !== task.scope.repo) {
    return deny(`repo ${call.args.repo} is outside this task's scope (${task.scope.repo})`);
  }
  if (call.args.number && task.scope.issues && !task.scope.issues.includes(call.args.number)) {
    return deny(`issue #${call.args.number} is outside this task's scope (${task.scope.issues.join(', ')})`);
  }
  if (
    call.args.environment &&
    task.scope.environment &&
    call.args.environment !== task.scope.environment
  ) {
    return deny(`environment ${call.args.environment} is outside this task's scope (${task.scope.environment})`);
  }

  // 3. Data flow. An outbound write carries a payload; where did the payload come from?
  const effect = findTool(call.tool)?.spec.effect ?? 'read';
  if (effect !== 'read') {
    const payload = [call.args.body, call.args.note].filter(Boolean).join('\n');
    if (payload) {
      for (const secret of MUST_NOT_EGRESS) {
        if (payload.includes(secret)) {
          return deny(`payload for ${call.tool} contains a value that must never leave the system`);
        }
      }
      for (const item of context) {
        if (!CONFIDENTIAL_ORIGINS.includes(item.origin)) continue;
        // Compare on a substantial slice so that an incidental word match does
        // not trip the rule, but a copied record does.
        const fingerprint = item.text.slice(0, 60);
        if (fingerprint.length > 20 && payload.includes(fingerprint)) {
          return deny(
            `payload for ${call.tool} carries content from ${item.label ?? item.origin} ` +
              `(${item.origin}); that data is not cleared to leave through this tool`,
          );
        }
      }
    }
  }

  return { allow: true };
}
