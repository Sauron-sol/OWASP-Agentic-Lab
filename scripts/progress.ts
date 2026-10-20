/**
 * Where you are. Runs each lab's checks and prints one line per lab.
 */
import { execSync } from 'node:child_process';

const LABS: { id: string; asi: string; title: string; file: string }[] = [
  { id: '01', asi: 'ASI01', title: 'Agent goal hijack', file: 'src/security/untrusted.ts' },
  { id: '02', asi: 'ASI02', title: 'Tool misuse', file: 'src/security/policy.ts' },
  { id: '03', asi: 'ASI03', title: 'Identity and privilege', file: 'src/security/capability.ts' },
  { id: '04', asi: 'ASI05', title: 'Unexpected code execution', file: 'src/security/sandbox.ts' },
  { id: '05', asi: 'ASI06', title: 'Memory poisoning', file: 'src/security/memory-guard.ts' },
];

console.log('\n  lab  ASI     topic                          status');
console.log('  ' + '─'.repeat(62));

let done = 0;
for (const lab of LABS) {
  let pass = false;
  try {
    execSync(`npx vitest run tests/lab-${lab.id}.test.ts`, { stdio: 'ignore' });
    pass = true;
  } catch {
    pass = false;
  }
  if (pass) done++;
  console.log(
    `  ${lab.id}   ${lab.asi}   ${lab.title.padEnd(30)} ${pass ? 'passing' : 'not yet'}   ${pass ? '' : lab.file}`,
  );
}

let capstone = false;
try {
  execSync('npx vitest run tests/capstone.test.ts', { stdio: 'ignore' });
  capstone = true;
} catch {
  capstone = false;
}
console.log(`  --   all     Capstone${' '.repeat(24)}${capstone ? 'passing' : 'not yet'}`);
console.log(`\n  ${done}/5 labs complete${capstone ? ', capstone complete' : ''}\n`);
