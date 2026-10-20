/**
 * Copies a reference solution over your own file.
 *
 *   npm run solution -- 02          # preview the diff, change nothing
 *   npm run solution -- 02 --apply  # overwrite src/security/policy.ts
 *
 * It exists because the solution files live one directory deeper than the files
 * they replace, so a plain `cp` leaves broken imports. This rewrites them.
 *
 * It will not overwrite your work unless you pass --apply, and it keeps a copy of
 * whatever it replaced next to the original with a .yours suffix.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const TARGETS: Record<string, string> = {
  '01': 'untrusted.ts',
  '02': 'policy.ts',
  '03': 'capability.ts',
  '04': 'sandbox.ts',
  '05': 'memory-guard.ts',
};

const args = process.argv.slice(2);
const lab = args.find((a) => /^0?[1-5]$/.test(a))?.padStart(2, '0');
const apply = args.includes('--apply');

if (!lab) {
  console.error('usage: npm run solution -- <01|02|03|04|05> [--apply]');
  process.exit(1);
}

const file = TARGETS[lab]!;
const from = `solutions/lab-${lab}/${file}`;
const to = `src/security/${file}`;

if (!existsSync(from)) {
  console.error(`no solution at ${from}`);
  process.exit(1);
}

// The solution sits two levels down from src/, the target sits one.
const rewritten = readFileSync(from, 'utf8').replaceAll("'../../src/", "'../");

if (!apply) {
  writeFileSync('.solution-preview.ts', rewritten);
  console.log(`\nDiff between your ${to} and the reference solution:\n`);
  try {
    execFileSync('diff', ['-u', to, '.solution-preview.ts'], { stdio: 'inherit' });
    console.log('(no differences)');
  } catch {
    // diff exits non-zero when files differ, which is the normal case here.
  }
  console.log(`\nNothing was changed. Re-run with --apply to overwrite ${to}.\n`);
  process.exit(0);
}

copyFileSync(to, `${to}.yours`);
writeFileSync(to, rewritten);
console.log(`\n${to}  <-  ${from}`);
console.log(`your version was saved as ${to}.yours\n`);
