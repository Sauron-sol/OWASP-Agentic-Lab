/**
 * LAB 05 - ASI06 Memory and Context Poisoning
 * ===========================================
 * Memory is the only part of the system where a single bad input outlives the
 * session that produced it.
 *
 * The control is two gates, and both are needed:
 *   - canPersist:    the write gate. What earns a place in memory at all.
 *   - filterForRecall: the read gate. What a new session is allowed to read
 *     as guidance, regardless of how the entry got in.
 *
 * The durable parts of the answer are provenance and an approval state with a
 * way out (rollback). The behavioural-text check below is a deliberately
 * labelled placeholder: it is a heuristic, it will fail, and that is expected.
 */
import type { Decision, Origin } from '../types.js';

export interface MemoryEntry {
  text: string;
  sourceOrigin: Origin | string;
  sourceLabel?: string;
  /** Whether this entry has passed whatever gate you decide to build. */
  approved: boolean;
}

/**
 * Origins a stranger can write into. Nothing from here earns durable memory.
 * The last one is the subtle one: memory itself. A store that can approve its
 * own recall bootstraps its own trust - Monday's note re-saved as
 * "agent-memory" would become legitimate on Tuesday.
 */
const ATTACKER_WRITABLE = new Set<string>([
  'github-issue',
  'shell',
  'peer-agent',
  'tool-description',
  'agent-memory',
]);

/**
 * Text that tells a future session how to behave, rather than recording
 * something that is true about the system.
 *
 * PLACEHOLDER HEURISTIC. It is the weakest code in this repo on purpose, and
 * it will miss phrasings it does not list. When it fails, the two things that
 * keep working are the provenance check and the approval state - a false pass
 * here is reviewable and rollbackable, not silent.
 */
const STANDING_INSTRUCTION =
  /\b(?:always|never|you must|you should|make sure to|don'?t forget|from now on|going forward|henceforth|whenever|instead of|ignore|disregard|before (?:analys\w+|doing|you)\b|first,? (?:inspect|check|run|confirm))\b/i;

function deny(reason: string): Decision {
  return { allow: false, reason, asi: 'ASI06' };
}

function isUntrusted(entry: Pick<MemoryEntry, 'text' | 'sourceOrigin'>): boolean {
  return ATTACKER_WRITABLE.has(String(entry.sourceOrigin));
}

/**
 * Called before anything is written to long-term memory.
 *
 * Order of the checks mirrors cost and permanence: provenance first, because
 * without it there is nothing to review; then origin, because content a
 * stranger can write is the whole problem; then shape, because a fact and a
 * standing instruction are not the same kind of thing and only the fact
 * belongs in a notebook a future session will obey.
 */
export function canPersist(entry: Omit<MemoryEntry, 'approved'>): Decision {
  const origin = String(entry.sourceOrigin ?? '').trim();
  if (!origin) {
    return deny(
      'entry has no provenance; a memory without a source cannot be reviewed or rolled back',
    );
  }
  if (ATTACKER_WRITABLE.has(origin)) {
    return deny(
      `content from ${entry.sourceLabel ?? origin} (${origin}) is writable by people outside the ` +
        `team and does not go into durable memory; persist it unapproved for review instead`,
    );
  }
  if (STANDING_INSTRUCTION.test(entry.text)) {
    return deny(
      'entry is an instruction about how to behave rather than a fact about the system; ' +
        'standing instructions are configuration and belong under review, not in memory',
    );
  }
  return { allow: true };
}

/**
 * Called when a new session loads memory back into context.
 *
 * The half that saves you. Entries got into the store before this gate
 * existed - a migration, a bulk import, a colleague's script, an older version
 * of this file - and a new session does not have to read any of them as
 * guidance. An unapproved entry, an untrusted origin, or a standing
 * instruction: any one of the three keeps it out of context.
 *
 * CONTRACT: returns the surviving entries in their original relative order.
 */
export function filterForRecall(entries: MemoryEntry[]): MemoryEntry[] {
  return entries.filter(
    (e) => e.approved && !isUntrusted(e) && !STANDING_INSTRUCTION.test(e.text),
  );
}

/**
 * STRETCH - rollback. Trivially implemented on purpose: remove the matching
 * entries, return what was removed so `npm run attack:05` can show the
 * recovery step. The interesting question this does not answer: how do you
 * find every downstream conclusion a poisoned entry contributed to before it
 * was caught?
 */
export function rollback(
  entries: MemoryEntry[],
  predicate: (e: MemoryEntry) => boolean,
): MemoryEntry[] {
  const removed = entries.filter(predicate);
  for (const e of removed) {
    const i = entries.indexOf(e);
    if (i >= 0) entries.splice(i, 1);
  }
  return removed;
}
