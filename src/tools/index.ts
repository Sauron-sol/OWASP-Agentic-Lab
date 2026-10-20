/**
 * The agent's tools.
 *
 * Each one is written the way a reasonable engineer would write it. None of them
 * is "the vulnerability" - read_service_config is a real debugging convenience,
 * post_github_comment is what makes the agent useful, run_shell is how you
 * reproduce a bug. The gap this lab is about is between a tool working as designed
 * and an action being one the operator actually wanted.
 *
 * You do not need to edit this file to complete any lab.
 */
import { resolve } from 'node:path';
import { assertAuthority, type Capability } from '../security/capability.js';
import { canPersist } from '../security/memory-guard.js';
import { execute, SANDBOX_ROOT } from '../security/sandbox.js';
import type { Task, ToolCall, ToolResult, ToolSpec } from '../types.js';
import { CUSTOMERS, DOCS, FAKE_ENV } from '../world/fixtures.js';
import { getWorld, issueIn, recordEgress } from '../world/state.js';

export interface ToolEnv {
  task: Task;
  capability: Capability;
  call: ToolCall;
}

export interface Tool {
  spec: ToolSpec;
  run(args: Record<string, string>, env: ToolEnv): Promise<ToolResult>;
}

function denied(reason: string): ToolResult {
  return { ok: false, output: { origin: 'operator', text: `refused: ${reason}`, label: 'system' } };
}

/** Every tool asks the same question first: does the presented authority cover this? */
async function guarded(env: ToolEnv, body: () => Promise<ToolResult>): Promise<ToolResult> {
  const d = assertAuthority(env.capability, env.task, env.call);
  if (!d.allow) {
    getWorld().ledger.blocked.push({ tool: env.call.tool, reason: d.reason, asi: d.asi });
    return denied(`${d.asi} ${d.reason}`);
  }
  return body();
}

const readIssue: Tool = {
  spec: {
    name: 'read_issue',
    description: 'Read a GitHub issue, including its body and comments.',
    effect: 'read',
    triggers: ['issue'],
  },
  run: (args, env) =>
    guarded(env, async () => {
      const issue = issueIn(args.repo ?? '', Number(args.number));
      if (!issue) return denied(`no such issue ${args.repo}#${args.number}`);
      const text = [
        `title: ${issue.title}`,
        `author: ${issue.author}`,
        `labels: ${issue.labels.join(', ')}`,
        '',
        issue.body,
        ...issue.comments.map((c) => `\ncomment by ${c.author}: ${c.body}`),
      ].join('\n');
      return { ok: true, output: { origin: 'github-issue', text, label: `issue #${issue.number}` } };
    }),
};

const searchDocs: Tool = {
  spec: {
    name: 'search_docs',
    description: 'Search internal engineering documentation.',
    effect: 'read',
    triggers: ['docs'],
  },
  run: (args, env) =>
    guarded(env, async () => {
      const q = (args.query ?? '').toLowerCase();
      const hits = DOCS.filter((d) => d.body.toLowerCase().includes(q) || d.path.includes(q));
      const chosen = hits.length ? hits : DOCS.slice(0, 1);
      return {
        ok: true,
        output: {
          origin: 'internal-docs',
          text: chosen.map((d) => `${d.path}: ${d.body}`).join('\n'),
          label: `docs(${args.query ?? ''})`,
        },
      };
    }),
};

const readServiceConfig: Tool = {
  spec: {
    name: 'read_service_config',
    description: 'Read the service configuration for the current environment. Useful when debugging.',
    effect: 'read',
    triggers: ['config', 'environment'],
  },
  run: (_args, env) =>
    guarded(env, async () => {
      const world = getWorld();
      for (const v of Object.values(FAKE_ENV)) world.ledger.secretsRead.push(v);
      const text = Object.entries(FAKE_ENV)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      return { ok: true, output: { origin: 'service-config', text, label: 'service config' } };
    }),
};

const getCustomerRecord: Tool = {
  spec: {
    name: 'get_customer_record',
    description: 'Look up a customer support record by id or by reporter handle.',
    effect: 'read',
    triggers: ['customer'],
  },
  run: (args, env) =>
    guarded(env, async () => {
      const key = (args.customer ?? '').toLowerCase();
      const record =
        key === 'reporter'
          ? CUSTOMERS.find((c) => c.email.startsWith('drive-by')) ?? CUSTOMERS[0]
          : CUSTOMERS.find((c) => c.id === args.customer || c.email === args.customer);
      if (!record) return denied(`no such customer ${args.customer}`);
      getWorld().ledger.recordsRead.push(record.id);
      const text = [
        `id: ${record.id}`,
        `email: ${record.email}`,
        `plan: ${record.plan}`,
        `last charge: ${record.lastCharge}`,
        `notes: ${record.internalNotes}`,
      ].join('\n');
      return { ok: true, output: { origin: 'support-db', text, label: `customer ${record.id}` } };
    }),
};

const postGithubComment: Tool = {
  spec: {
    name: 'post_github_comment',
    description: 'Post a comment on a GitHub issue.',
    effect: 'write',
    triggers: ['comment'],
  },
  run: (args, env) =>
    guarded(env, async () => {
      const issue = issueIn(args.repo ?? '', Number(args.number));
      if (!issue) return denied(`no such issue ${args.repo}#${args.number}`);
      const body = args.body ?? '';
      // A comment on a public issue is egress. Whatever is in the body is now out.
      recordEgress(body, `${issue.repo}#${issue.number}`, 'post_github_comment');
      issue.comments.push({ author: 'triage-agent', body });
      getWorld().ledger.commentsPosted.push({ repo: issue.repo, issue: issue.number, body });
      return {
        ok: true,
        output: { origin: 'operator', text: `posted comment on #${issue.number}`, label: 'system' },
      };
    }),
};

const runShell: Tool = {
  spec: {
    name: 'run_shell',
    description: 'Run a command to reproduce a bug. Runs in the checked-out repository.',
    effect: 'execute',
    triggers: ['command', 'repro'],
  },
  run: (args, env) =>
    guarded(env, async () => {
      const command = args.command ?? '';
      const cwd = args.cwd ? resolve(args.cwd) : SANDBOX_ROOT;
      const outcome = execute({ command, cwd });
      if (outcome.blocked) {
        getWorld().ledger.blocked.push({
          tool: 'run_shell',
          reason: outcome.blocked,
          asi: 'ASI05',
        });
        return denied(`ASI05 ${outcome.blocked}`);
      }
      getWorld().ledger.commandsRun.push(command);
      const text = `$ ${command}\n${outcome.stdout}${outcome.stderr}`.trim();
      return { ok: outcome.ok, output: { origin: 'shell', text, label: `shell(${command})` } };
    }),
};

const remember: Tool = {
  spec: {
    name: 'remember',
    description: 'Save a short note to long-term memory for future sessions.',
    effect: 'write',
    triggers: ['remember'],
  },
  run: (args, env) =>
    guarded(env, async () => {
      const note = args.note ?? '';
      const entry = {
        text: note,
        sourceOrigin: env.call.causedBy,
        sourceLabel: env.call.causedByLabel,
      };
      const d = canPersist(entry);
      const world = getWorld();
      if (!d.allow) {
        world.ledger.blocked.push({ tool: 'remember', reason: d.reason, asi: d.asi });
        return denied(`${d.asi} ${d.reason}`);
      }
      world.memory.push({ ...entry, approved: true });
      world.ledger.memoryWrites.push(entry);
      return {
        ok: true,
        output: { origin: 'operator', text: 'saved to memory', label: 'system' },
      };
    }),
};

const deploy: Tool = {
  spec: {
    name: 'deploy',
    description: 'Deploy a commit to an environment.',
    effect: 'execute',
    triggers: ['deploy'],
  },
  run: (args, env) =>
    guarded(env, async () => {
      const commit = args.commit ?? 'HEAD';
      const environment = args.environment ?? 'staging';
      getWorld().ledger.deploys.push({ commit, environment });
      return {
        ok: true,
        output: {
          origin: 'operator',
          text: `deployed ${commit} to ${environment}`,
          label: 'system',
        },
      };
    }),
};

export const ALL_TOOLS: Tool[] = [
  readIssue,
  searchDocs,
  readServiceConfig,
  getCustomerRecord,
  postGithubComment,
  runShell,
  remember,
  deploy,
];

export function toolsFor(names: string[]): Tool[] {
  return ALL_TOOLS.filter((t) => names.includes(t.spec.name));
}

export function findTool(name: string): Tool | undefined {
  return ALL_TOOLS.find((t) => t.spec.name === name);
}
