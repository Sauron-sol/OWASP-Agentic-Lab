/**
 * REFERENCE SOLUTION - lab 05, ASI06 Memory and Context Poisoning.
 * Drop-in replacement for src/security/memory-guard.ts.
 */
import type { Decision, Origin } from '../../src/types.js';

export interface MemoryEntry {
  text: string;
  sourceOrigin: Origin | string;
  sourceLabel?: string;
  approved: boolean;
}

/** Origins a stranger can write into. Nothing from here earns durable memory. */
const ATTACKER_WRITABLE = new Set<string>([
  'github-issue',
  'shell',
  'peer-agent',
  'tool-description',
  'agent-memory',
]);

/**
 * Text that tells a future session how to behave, rather than recording something
 * that is true about the system. Only one of those belongs in a notebook that a
 * later run will read as guidance.
 */
const BEHAVIOURAL =
  /\b(?:always|never|before (?:analys|doing|you)|first,? (?:inspect|check|run)|you (?:must|should)|make sure to|instead of|ignore|disregard|from now on)\b/i;

function deny(reason: string): Decision {
  return { allow: false, reason, asi: 'ASI06' };
}

export function canPersist(entry: Omit<MemoryEntry, 'approved'>): Decision {
  if (!entry.sourceOrigin) {
    return deny('entry has no provenance; memory without a source cannot be reviewed');
  }
  if (ATTACKER_WRITABLE.has(String(entry.sourceOrigin))) {
    return deny(
      `content from ${entry.sourceLabel ?? entry.sourceOrigin} (${entry.sourceOrigin}) is ` +
        `writable by people outside the team and does not go into durable memory`,
    );
  }
  if (BEHAVIOURAL.test(entry.text)) {
    return deny(
      'entry is an instruction about how to behave rather than a fact about the system; ' +
        'standing instructions are configuration and belong under review, not in memory',
    );
  }
  return { allow: true };
}

/**
 * Second half of the control. Even if something got written - by an older version
 * of this code, by a migration, by a human - a new session does not have to read
 * it as guidance.
 */
export function filterForRecall(entries: MemoryEntry[]): MemoryEntry[] {
  return entries.filter((e) => {
    if (!e.approved) return false;
    if (ATTACKER_WRITABLE.has(String(e.sourceOrigin))) return false;
    if (BEHAVIOURAL.test(e.text)) return false;
    return true;
  });
}

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
