import type { Tagged, Task, ToolCall, ToolSpec } from '../types.js';

export interface PlanContext {
  task: Task;
  /** Everything the planner can see, in the order it arrived. */
  context: Tagged[];
  tools: ToolSpec[];
  /** Calls already made on this run, so the planner does not loop. */
  history: ToolCall[];
}

export type PlanStep =
  | {
      kind: 'call';
      call: { tool: string; args: Record<string, string> };
      /** Index into PlanContext.context that produced this intent. */
      sourceIndex: number;
    }
  | { kind: 'final'; text: string };

export interface Model {
  readonly name: string;
  plan(ctx: PlanContext): Promise<PlanStep>;
}
