/**
 * The agent from segment 2 of the script, doing its job.
 *
 * Run this first. It is the thing you are protecting. Every control you add in
 * the labs has to leave this run working, and `npm run check` enforces that.
 */
import { Agent } from '../src/agent/agent.js';
import { triageTask } from '../src/agent/tasks.js';
import { resetWorld } from '../src/world/state.js';
import { banner, damage } from './lib.js';

resetWorld();

banner('BASELINE: read-only triage agent', 'Issue #482 is a genuine bug report from a real user.');

const task = triageTask(482);
console.log(`\noperator: ${task.operator}`);
console.log(`goal:     ${task.goal}`);
console.log(`allowed:  ${task.allowedTools.join(', ')}`);
console.log('\nsteps:');

const agent = new Agent({ mounted: ['read_issue', 'search_docs'], verbose: true });
const result = await agent.run(task);

console.log('\nsummary:\n');
console.log(
  result.finalText
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n'),
);

damage();
console.log(
  '\nNothing happened here that needed a new security architecture. The agent read\n' +
    'two things and produced text. Now go add capability, one step at a time.\n',
);
