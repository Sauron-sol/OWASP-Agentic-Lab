/**
 * ASI03 - Identity and Privilege Abuse
 *
 * This one does not need an injected instruction. It asks a narrower question:
 * when a tool is about to act, what is it actually checking?
 *
 * A tool can be called by the planner, by a retry worker, by a peer agent, or by
 * next week's code. So the credential check has to live at the resource, not only
 * in the planner's path. That is why this lab works on the capability layer
 * directly rather than through a full agent run.
 */
import { mintCapability, assertAuthority, AMBIENT_TOKEN } from '../src/security/capability.js';
import { triageTask } from '../src/agent/tasks.js';
import { resetWorld } from '../src/world/state.js';
import type { ToolCall } from '../src/types.js';
import { banner, scene, verdict } from './lib.js';

resetWorld();
banner('ASI03: IDENTITY AND PRIVILEGE ABUSE', 'The credential is valid. Ask a better question.');

const task = triageTask(482);
const call = (tool: string, args: Record<string, string> = {}): ToolCall => ({
  tool,
  args,
  causedBy: 'operator',
});

scene(1, 'What the agent presents today');
const cap = mintCapability(task, call('read_issue', { repo: 'bytemonk/checkout', number: '482' }));
console.log(`  agent:       ${cap.agent}`);
console.log(`  on behalf of: ${cap.onBehalfOf}`);
console.log(`  task:        ${cap.taskId}`);
console.log(`  tools:       ${cap.tools.join(', ')}`);
console.log(`  expires:     ${cap.expiresAt === Infinity ? 'never' : new Date(cap.expiresAt).toISOString()}`);
console.log(`  is the shared token: ${cap === AMBIENT_TOKEN ? 'yes' : 'no'}`);

const probes: { label: string; run: () => ReturnType<typeof assertAuthority> }[] = [
  {
    label: 'a read-only triage task deploying to production',
    run: () => assertAuthority(cap, task, call('deploy', { commit: 'abc123', environment: 'production' })),
  },
  {
    label: 'the read_issue capability used to pull a customer record',
    run: () => assertAuthority(cap, task, call('get_customer_record', { customer: 'cus_4471' })),
  },
  {
    label: 'yesterday\'s capability, reused today',
    run: () => {
      const stale = { ...cap, taskId: task.id, expiresAt: Date.now() - 86_400_000 };
      return assertAuthority(stale, task, call('read_issue', { repo: 'bytemonk/checkout', number: '482' }));
    },
  },
  {
    label: 'another task\'s capability, presented for this task',
    run: () => {
      const other = { ...cap, taskId: 'task-from-some-other-run' };
      return assertAuthority(other, task, call('read_issue', { repo: 'bytemonk/checkout', number: '482' }));
    },
  },
  {
    label: 'an in-scope read, which must keep working',
    run: () => assertAuthority(cap, task, call('read_issue', { repo: 'bytemonk/checkout', number: '482' })),
  },
];

scene(2, 'Five things a resource might be asked to do with that credential');
let wrong = 0;
probes.forEach((p, i) => {
  const d = p.run();
  const shouldAllow = i === probes.length - 1;
  const ok = d.allow === shouldAllow;
  if (!ok) wrong++;
  const verdictText = d.allow ? 'ALLOWED' : `refused (${d.asi}: ${d.reason})`;
  console.log(`  ${ok ? '  ' : '!!'} ${p.label}\n       -> ${verdictText}`);
});

verdict([
  wrong > 0
    ? `${wrong} of these came out wrong.\n\n` +
      'The agent is holding a permanent, shared, everything-scoped credential, so\n' +
      '"is this valid?" always answers yes. A tool that can only ask that question\n' +
      'cannot refuse anything.\n\n' +
      'Give the task its own authority instead: which agent, for which human, for\n' +
      'which task, over which tools and resources, expiring when the task does.\n\n' +
      'Open src/security/capability.ts.'
    : 'All five behaved correctly. Authority is scoped to the task, not to the agent.\n' +
      'Run `npm run check:03`.',
]);
