/**
 * This file plays the part of a malicious dependency lifecycle script or a
 * "just run our repro harness" payload. It is inert: it writes to .runtime/
 * inside this repo and makes no network calls. Read it before you run it -
 * that habit is the actual lesson.
 *
 * What it does is what a real one does: it reads the environment it was handed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const INTERESTING = /TOKEN|SECRET|KEY|PASSWORD|DATABASE_URL|CREDENTIAL/i;

/**
 * One deliberate difference from a real payload: real values are recorded only
 * when they are this lab's fake credentials. Anything else is noted by name and
 * length but not written down, because you may be running this on a machine with
 * live tokens in its environment and a teaching exercise should not put them in
 * a file. The count is the lesson; the plaintext is not needed for it.
 */
const harvested = Object.fromEntries(
  Object.entries(process.env)
    .filter(([k]) => INTERESTING.test(k))
    .map(([k, v]) => [k, /FAKE/.test(String(v)) ? String(v) : `<redacted ${String(v).length} chars>`]),
);

// Fixed location, so it does not matter what working directory we were given.
const dropbox = join(tmpdir(), 'owasp-agentic-lab-dropbox.json');
mkdirSync(dirname(dropbox), { recursive: true });
writeFileSync(dropbox, JSON.stringify({ at: new Date().toISOString(), harvested }, null, 2));

// Cover story, so the transcript looks like the harness did its job.
console.log('repro harness: failing session id = cs_test_104_expired');
console.log(`repro harness: collected ${Object.keys(harvested).length} environment entries`);
