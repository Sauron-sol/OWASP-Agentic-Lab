/**
 * Shared vocabulary for the lab.
 *
 * The single most important idea in this repo is expressed by two types:
 *
 *   ToolCall  - what the MODEL wants to happen. Untrusted. A request, nothing more.
 *   Decision  - what the SYSTEM allows to happen. This is the security boundary.
 *
 * The model proposes. The surrounding system authorizes.
 */

/** Where a piece of text came from. Trust is a property of provenance, not of content. */
export type Origin =
  | 'operator'        // the human running the agent, typed directly
  | 'github-issue'    // attacker-writable
  | 'internal-docs'   // semi-trusted, still content
  | 'support-db'       // data records
  | 'service-config'   // configuration and secrets
  | 'tool-description' // third-party supply chain
  | 'agent-memory'     // whatever we let past the memory gate last time
  | 'peer-agent'       // another agent
  | 'shell';           // command output

/** Text plus the one fact that decides how much authority it should carry. */
export interface Tagged {
  origin: Origin;
  text: string;
  /** Free-form label for audit output, e.g. "issue #482". */
  label?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** Does a successful call change state outside the agent, or move data outward? */
  effect: 'read' | 'write' | 'execute';
  /** Which keywords a naive planner will latch onto. Used by the scripted model. */
  triggers: string[];
}

export interface ToolCall {
  tool: string;
  args: Record<string, string>;
  /** Which tagged input caused the planner to ask for this. Set by the agent loop. */
  causedBy: Origin;
  causedByLabel?: string;
}

export interface ToolResult {
  ok: boolean;
  /** What the model gets to see. Always tagged - never a bare string. */
  output: Tagged;
}

export type Decision =
  | { allow: true; reason?: string }
  | { allow: false; reason: string; asi: string };

/** One task = one grant of authority. Scope lives here, not on the agent. */
export interface Task {
  id: string;
  /** What the operator actually asked for, in their own words. */
  goal: string;
  operator: string;
  /** Tool names this task may use. Nothing else is reachable, even if it exists. */
  allowedTools: string[];
  /** Resources this task is about. Used to catch "right tool, wrong target". */
  scope: { repo?: string; issues?: string[]; environment?: 'staging' | 'production' };
  /** Wall-clock budget. Authority that outlives the task is how yesterday's
   *  approval deploys tomorrow's code. */
  expiresAt: number;
}

export interface AuditEntry {
  taskId: string;
  tool: string;
  args: Record<string, string>;
  causedBy: Origin;
  causedByLabel?: string;
  decision: Decision;
  at: number;
}
