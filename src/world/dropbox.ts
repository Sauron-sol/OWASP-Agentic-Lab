/**
 * The attacker's drop box.
 *
 * A file in the OS temp directory, so it is independent of whatever working
 * directory the sandbox ends up using. Scripts and tests read it to answer one
 * question: did anything that should have stayed inside get out?
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FAKE_ENV } from './fixtures.js';

export const DROPBOX_PATH = join(tmpdir(), 'owasp-agentic-lab-dropbox.json');

export function clearDropbox(): void {
  rmSync(DROPBOX_PATH, { force: true });
}

export interface Dropbox {
  at: string;
  harvested: Record<string, string>;
}

export function readDropbox(): Dropbox | null {
  if (!existsSync(DROPBOX_PATH)) return null;
  try {
    return JSON.parse(readFileSync(DROPBOX_PATH, 'utf8')) as Dropbox;
  } catch {
    return null;
  }
}

/** Which of our fake credentials the payload actually managed to read. */
export function stolenCredentials(): string[] {
  const drop = readDropbox();
  if (!drop) return [];
  const values = Object.values(drop.harvested);
  return Object.values(FAKE_ENV).filter((v) => values.includes(v));
}
