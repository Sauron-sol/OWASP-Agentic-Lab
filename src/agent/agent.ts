/**
 * The agent loop.
 *
 * Read this once before you start lab 01. It is short on purpose, and the order
 * of the calls inside `run` is the whole architecture:
 *
 *     prepareForPlanner  ->  model.plan  ->  detectGoalDrift
 *                                        ->  authorize
 *                                        ->  mintCapability
 *                                        ->  tool.run (which asserts authority)
 *
 * The model sits in the middle of that chain with no authority of its own. It
 * returns an intent. Four things outside it decide whether the intent becomes an
 * action. Right now three of those four are permissive stubs, which is your job.
 *
 * Note the distinction between MOUNTED tools and ALLOWED tools. Mounted is what
 * the application wired up; allowed is what this task may use. They are not the
 * same list, and confusing them is how a triage task ends up able to deploy.
 */
import { loadModel, type Model } from '../model/index.js';
import { filterForRecall } from '../security/memory-guard.js';
import { authorize } from '../security/policy.js';
import { detectGoalDrift, prepareForPlanner } from '../security/untrusted.js';
import { mintCapability, isRevoked } from '../security/capability.js';
import { findTool, toolsFor, type Tool } from '../tools/index.js';
import type { AuditEntry, Tagged, Task, ToolCall } from '../types.js';
import { getWorld } from '../world/state.js';

export interface AgentOptions {
  /** Tool names the application has wired up. Not the same as task.allowedTools. */
  mounted: string[];
  model?: Model;
  maxSteps?: number;
  /** Print each step. On by default for the attack scripts, off in tests. */
  verbose?: boolean;
  /** Load long-term memory into context at the start of the run. */
  useMemory?: boolean;
  agentName?: string;
}

export interface RunResult {
  finalText: string;
  audit: AuditEntry[];
  context: Tagged[];
}

export class Agent {
  private readonly model: Model;
  private readonly tools: Tool[];

  constructor(private readonly opts: AgentOptions) {
    this.model = opts.model ?? loadModel();
    this.tools = toolsFor(opts.mounted);
  }

  async run(task: Task): Promise<RunResult> {
    const world = getWorld();
    const audit: AuditEntry[] = [];
    const context: Tagged[] = [{ origin: 'operator', text: task.goal, label: 'operator' }];

    if (this.opts.useMemory) {
      for (const entry of filterForRecall(world.memory)) {
        context.push({
          origin: 'agent-memory',
          text: entry.text,
          label: `memory (from ${entry.sourceLabel ?? entry.sourceOrigin})`,
        });
      }
    }

    const maxSteps = this.opts.maxSteps ?? 12;
    const history: ToolCall[] = [];

    for (let step = 0; step < maxSteps; step++) {
      if (isRevoked(task.id)) {
        return { finalText: 'run terminated: task authority revoked', audit, context };
      }

      // Lab 01 lives here: what the planner is allowed to read, and how.
      const visible = prepareForPlanner(context);
      if (visible.length !== context.length) {
        throw new Error(
          'prepareForPlanner must return the same number of entries in the same order - ' +
            'see the CONTRACT note in src/security/untrusted.ts',
        );
      }

      const plan = await this.model.plan({
        task,
        context: visible,
        tools: this.tools.map((t) => t.spec),
        history,
      });

      if (plan.kind === 'final') {
        return { finalText: plan.text, audit, context };
      }

      const cause = context[plan.sourceIndex] ?? context[0]!;
      const call: ToolCall = {
        tool: plan.call.tool,
        args: this.fillPlaceholders(plan.call.args, context),
        causedBy: cause.origin,
        causedByLabel: cause.label,
      };
      history.push(call);

      // Three checks outside the model, in order of how much they cost to run.
      const decision =
        this.reject(detectGoalDrift(task, call, cause)) ??
        this.reject(authorize({ task, call, context })) ??
        null;

      const record = (d: AuditEntry['decision']) =>
        audit.push({
          taskId: task.id,
          tool: call.tool,
          args: call.args,
          causedBy: call.causedBy,
          causedByLabel: call.causedByLabel,
          decision: d,
          at: Date.now(),
        });

      if (decision) {
        record(decision);
        world.ledger.blocked.push({ tool: call.tool, reason: decision.reason, asi: decision.asi });
        this.log(`  BLOCKED ${call.tool} (${decision.asi}): ${decision.reason}`);
        context.push({
          origin: 'operator',
          text: `system: request to call ${call.tool} was refused (${decision.asi}).`,
          label: 'system',
        });
        continue;
      }

      const tool = findTool(call.tool);
      if (!tool) {
        context.push({ origin: 'operator', text: `system: no tool named ${call.tool}`, label: 'system' });
        continue;
      }

      record({ allow: true });
      this.log(`  ${call.tool}(${JSON.stringify(call.args).slice(0, 120)})  <- ${call.causedByLabel ?? call.causedBy}`);

      const capability = mintCapability(task, call, this.opts.agentName ?? 'triage-agent');
      const result = await tool.run(call.args, { task, capability, call });
      context.push(result.output);
    }

    return { finalText: '(step budget exhausted)', audit, context };
  }

  private reject(d: ReturnType<typeof authorize>) {
    return d.allow ? undefined : d;
  }

  /**
   * The planner asks for a comment body of __FINDINGS__, meaning "everything I
   * have learned". The agent expands it. This is not a trick: it is what an agent
   * that writes up its findings actually does, and it is why an outbound write is
   * a data-flow decision and not just a permissions decision.
   */
  private fillPlaceholders(args: Record<string, string>, context: Tagged[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(args)) {
      out[k] =
        v === '__FINDINGS__'
          ? context
              .filter((c) => c.origin !== 'operator')
              .map((c) => `[${c.label ?? c.origin}] ${c.text}`)
              .join('\n')
          : v;
    }
    return out;
  }

  private log(line: string): void {
    if (this.opts.verbose) console.log(line);
  }
}
