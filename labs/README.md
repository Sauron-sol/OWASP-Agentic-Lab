# The labs

Do them in order. Each one adds a capability to the agent, so lab 03 assumes the
tools from lab 02 exist and lab 05 assumes the agent can write things down.

| | Lab | OWASP | Time | You edit | Check |
|---|---|---|---|---|---|
| ▸ | [01 Goal hijack](lab-01-goal-hijack/) | ASI01 | ~50 min | `src/security/untrusted.ts` | `npm run check:01` |
| ▸ | [02 Tool misuse](lab-02-tool-misuse/) | ASI02 | ~80 min | `src/security/policy.ts` | `npm run check:02` |
| ▸ | [03 Identity & privilege](lab-03-identity/) | ASI03 | ~80 min | `src/security/capability.ts` | `npm run check:03` |
| ▸ | [04 Code execution](lab-04-code-execution/) | ASI05 | ~70 min | `src/security/sandbox.ts` | `npm run check:04` |
| ▸ | [05 Memory poisoning](lab-05-memory/) | ASI06 | ~60 min | `src/security/memory-guard.ts` | `npm run check:05` |
| ★ | [Capstone](capstone/) | all | ~45 min | `labs/capstone/NOTES.md` | `npm run check:capstone` |
| + | [Stretch: the other five](STRETCH.md) | ASI04, 07, 08, 09, 10 | 2-4 hrs each | — | — |

About 5 to 7 hours for the five labs and the capstone. Lab 02 and lab 03 are the
long ones, and they are the two worth slowing down for.

## Before lab 01

```bash
npm install
npm run baseline      # the agent doing its job. this is what you are protecting.
```

Then read two files, in this order:

- `src/agent/agent.ts` — the loop. Fifteen lines of it are the whole architecture.
- `src/types.ts` — specifically `ToolCall` and `Decision`. One is what the model
  wants. The other is what the system allows. Every lab lives in the gap between them.

## Every lab works the same way

1. **Run the attack.** `npm run attack:01`. Read the output before you open any code.
2. **Read the brief.** The README in the lab folder.
3. **Read the file it points at.** It has `TODO(lab-0N)` markers and a contract to keep.
4. **Write the fix.** Then run the check. It asserts the attack is contained **and**
   that the legitimate workflow still works — a control that blocks everything fails.
5. **Run the attack again.** The verdict at the bottom should have changed.

`npm run progress` prints which labs are passing. `npm run check` runs everything.

## If you get stuck

`npm run solution -- 01` shows a diff between your version and a reference
implementation, and changes nothing. Add `--apply` to overwrite. Finish your own
attempt first, then read theirs as a code review — `solutions/README.md` lists what
is wrong with each one.
