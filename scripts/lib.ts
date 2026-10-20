import { getWorld, summariseDamage } from '../src/world/state.js';

export function banner(title: string, subtitle?: string): void {
  const line = '─'.repeat(Math.max(title.length, (subtitle ?? '').length, 52));
  console.log(`\n${line}\n${title}${subtitle ? `\n${subtitle}` : ''}\n${line}`);
}

export function scene(n: number, title: string): void {
  console.log(`\nSCENE ${n}: ${title}`);
}

export function damage(): void {
  console.log('\nDamage ledger');
  console.log(
    summariseDamage()
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n'),
  );
  const l = getWorld().ledger;
  for (const e of l.egress) {
    console.log(`  !! ${truncate(e.value, 40)}  ->  ${e.destination}  via ${e.via}`);
  }
  for (const b of l.blocked) {
    console.log(`  -- blocked ${b.tool} (${b.asi}): ${b.reason}`);
  }
}

export function verdict(lines: string[]): void {
  console.log('');
  for (const l of lines) console.log(l);
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
