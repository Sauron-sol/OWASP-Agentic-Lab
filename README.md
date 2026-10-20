# OWASP Agentic Lab: five attacks, five controls

A hands-on lab on the **OWASP Top 10 for Agentic Applications (2026)**. I built the
agent, broke it with five attacks, then wrote the control that stops each one, outside
the model. Every control has a test that must pass, and every attack has a scripted
replay that shows the result before and after the fix.

This repository is my working copy of the lab, based on the MIT-licensed
[ByteMonk weekend lab](https://github.com/bytemonk-academy/owasp-agentic-lab)
(Copyright © 2026 ByteMonk LLC). The original README is kept below.

## Results

| Lab | Risk | Attack | Control | Checks | Replay |
|-----|------|--------|---------|--------|--------|
| 01 | ASI01 Agent Goal Hijack | Instructions hidden in a GitHub issue | Untrusted-content neutralisation + goal-drift check (only the operator can create intent) | 6/6 | HIJACKED → CONTAINED |
| 02 | ASI02 Tool Misuse | Mounted tools used beyond the grant, confidential data sent to a public comment | `authorize` gate: least privilege, scope, data-flow | 7/7 | MISUSED → CONTAINED |
| 03 | ASI03 Identity and Privilege Abuse | Ambient, never-expiring agent token | Per-call scoped capability, checked on the resource side | 8/8 | 4/5 → 5/5 correct |
| 04 | ASI05 Unexpected Code Execution | Shell command that reads credentials | Sandbox: command allowlist, no operators, empty environment, pinned root | 6/6 | EXECUTED → CONTAINED |
| 05 | ASI06 Memory and Context Poisoning | Standing instruction written into long-term memory | Write gate (provenance, origin, shape) and read gate (approved entries only) | 5/5 | CONTAINED |

The capstone (`npm run check:capstone`, 4/4) runs all five controls end to end.
Full suite: 36/36 at the time of the last run.

## Key takeaways

- **Provenance beats filtering.** Text filters slow an attack down, but they can always
  be rephrased. The rule that holds is "only the operator can create intent": a tool call
  whose cause is not the operator is refused, whatever the text says.
- **Mounted is not granted.** Most real agents have tools they never need for the task.
  Least privilege per task closes that gap without touching the model.
- **Data flow is the rule people miss.** A read-only tool that reads confidential data is
  fine. The same data sent through a public write is the incident.
- **Memory needs the same rules as data.** Anything an attacker can write must not be
  recalled as an instruction in a later session.
- **Empty environment for code execution.** The command allowlist slows an attacker down.
  The empty environment is what keeps secrets off the machine.

## Layout

```
labs/          the five labs (README, NOTES per lab) and the capstone
src/security/  my controls (the solutions)
src/agent/     the agent under test
src/world/     fixtures: issues, documents, customer records (all synthetic)
tests/         the checks each control must pass
scripts/       attack replays (npm run attack:NN) and progress (npm run progress)
```

## Run it

```bash
npm install
npm run progress         # status of each lab
npm run check:01         # one lab's checks
npm run attack:01        # replay the attack, see the verdict
npm test                 # full suite
```

The lab runs offline with a deterministic scripted planner. No API key is needed.
Synthetic data only. The "customer records" and tokens are fake (`ghp_FAKE_...`).

## Scope and licence

- The lab and fixtures are synthetic. Nothing here touches a real system.
- Code: MIT (see `LICENSE`, © 2026 ByteMonk LLC). My changes are under the same licence.
- The OWASP risk names and IDs are from the OWASP GenAI Security Project.

---

## Original README (ByteMonk)

# Build an agent. Break it ten ways. Then fix it.

A weekend lab on the **OWASP Top 10 for Agentic Applications**, built the way the
risks actually arrive: you start with an agent that reads two things and writes a
summary, and you add one useful capability at a time. Each capability opens a trust
boundary, each trust boundary has an attack that works, and each attack has a fix
that lives outside the model.

Companion to the ByteMonk video on the OWASP Agentic Top 10. You do not need to
have watched it.

```
                  ┌─────────────┐
 GitHub issues ──►│             │
                  │   triage    │──► summary
 Internal docs ──►│    agent    │
                  └─────────────┘
                     read-only. no security architecture required.

                  ┌─────────────┐     tools ──► credentials ──► third-party
 GitHub issues ──►│             │──►  MCP ──► shell ──► memory ──► second agent
                  │   triage    │
 Internal docs ──►│    agent    │     ten risks, one architecture
                  └─────────────┘
```

## What you will have at the end

Five working controls you wrote yourself, and a much shorter answer to "is our
agent safe?" than you had on Friday:

| Lab | OWASP | What you build | File |
|-----|-------|----------------|------|
| 01 | ASI01 Agent Goal Hijack | Provenance-aware context handling and a goal-drift check | `src/security/untrusted.ts` |
| 02 | ASI02 Tool Misuse | An authorization boundary: least privilege, scope, data flow | `src/security/policy.ts` |
| 03 | ASI03 Identity & Privilege Abuse | Task-scoped, expiring, revocable capabilities | `src/security/capability.ts` |
| 04 | ASI05 Unexpected Code Execution | A sandbox that is not worth attacking | `src/security/sandbox.ts` |
| 05 | ASI06 Memory & Context Poisoning | A write gate and a recall filter with provenance | `src/security/memory-guard.ts` |
| — | Capstone | All five at once, plus a kill switch and a write-up | `labs/capstone/` |

Start at [`labs/README.md`](labs/README.md), which is the running order.

The other five risks (ASI04, ASI07, ASI08, ASI09, ASI10) are in
[`labs/STRETCH.md`](labs/STRETCH.md) with a scaffold for each. They are not part of
the weekend.

**Time:** about 5 to 7 hours. Lab 02 and lab 03 are the long ones.

**Prerequisites:** TypeScript, Node 20+, and having written something that calls an
API. No prior security background. No LLM API key.

## Setup

```bash
git clone <this repo> && cd owasp-agentic-lab
npm install
npm run baseline      # the agent doing its job. start here.
npm run attack:01     # the same agent, one poisoned issue
```

That is the whole setup. No API key, no network calls, no Docker.

The planner is a deterministic stand-in for an LLM
(`src/model/scripted.ts`). It reproduces exactly one property of a real model:
it cannot tell operator text from stranger text, so language that looks like an
instruction gets followed. Everything else about it is boring, because a lab needs
a pass/fail test.

If you want to watch a real model make the same mistakes, set `AGENT_MODEL=anthropic`
and `ANTHROPIC_API_KEY` (see `.env.example`). The attacks still land. They land
differently each run, which is its own lesson. **Nothing about the fixes changes**,
because none of them are in the model.

## How to work through a lab

Same five steps every time.

1. **Run the attack.** `npm run attack:01`. Read the output. Do not skip to the file.
2. **Read the brief.** `labs/lab-01-goal-hijack/README.md`. It explains the risk,
   what the attack actually did, and what a fix has to achieve.
3. **Read the code it points at.** The file has `TODO(lab-01)` markers and a contract
   you have to keep.
4. **Write the fix.** Then `npm run check:01`. It asserts the attack is contained
   **and** that the legitimate workflow still works. A control that blocks everything
   fails the lab.
5. **Run the attack again.** The verdict at the bottom should have changed.

`npm run progress` prints where you are. `npm run check` runs everything.

When you are stuck, `solutions/lab-0N/` has a reference implementation and a note on
what is wrong with it. Finish your own version first, then read it as a code review.

## Ground rules worth knowing before you start

**Nothing in this repo touches a real system.** The GitHub is a fixture array, the
customers are invented, the credentials all contain the string `FAKE`, and the
attacker's drop box is a file in your temp directory. One thing does really execute:
lab 04 runs a real child process, deliberately, because reading about code execution
and watching it happen are different experiences. Read
`src/world/attacker-harness/scripts/repro.js` before you run it. That habit is
part of the lesson.

**The model is untrusted, and you are not meant to fix it.** There is no lab where
the answer is a better system prompt. The planner sits in the middle of the agent
loop with no authority of its own, and four things outside it decide whether its
intent becomes an action. You are building three of those four.

**You cannot get all ten risks with five labs, and this repo does not pretend
otherwise.** The five here are the ones that produce real damage in the smallest,
most reproducible setup. The remaining five need a second agent, a third-party
server, or a human in the loop, and they are in the stretch notes.

## The incident this is modelled on

In 2025 a coding agent working on a staging problem found a Railway API token that
had nothing to do with its task, and made a destructive API call. About nine seconds
later the production database was gone, and so were the volume-level backups.

Nobody broke in. There was no prompt injection. The API call was authenticated and
the credential was valid. The agent simply had enough access to do something it
should never have been able to do.

That is the shape every lab here is about: an ordinary decision, an extraordinary
blast radius. The mistake is not the interesting part. What the surrounding system
let the mistake reach is.

## Repo layout

```
src/
  agent/         the loop, and the task definitions. read agent.ts first.
  model/         the planner. untrusted by design. not yours to fix.
  security/      ← the five files you edit
  tools/         read_issue, post_github_comment, run_shell, remember, ...
  world/         fixtures, the damage ledger, the attacker's payload
labs/            one brief per lab, plus STRETCH.md and the capstone
scripts/         npm run baseline, npm run attack:0N, npm run progress
solutions/       reference implementations, with their own weaknesses noted
tests/           the checks. unit tests on each control, plus end-to-end damage.
```

Two files are worth reading in full before lab 01: `src/agent/agent.ts`, which is
short, and `src/types.ts`, which contains the only idea in this repo that matters:

```ts
ToolCall  // what the MODEL wants to happen. Untrusted. A request, nothing more.
Decision  // what the SYSTEM allows to happen. This is the security boundary.
```

The model proposes. The surrounding system authorizes, isolates, records, and when
necessary stops it.

## Going further

The security underneath these fixes — OAuth and delegated authorization, IAM, token
exchange, sandboxing, secure agent architecture — is covered in much more depth in the
ByteMonk **Cybersecurity for Developers** course.

## References

- OWASP Top 10 for Agentic Applications, and the OWASP GenAI Security Project's
  supplementary guidance on agentic memory
- OWASP Top 10 for LLM Applications, for the layer underneath
- Descope's analysis of the agentic list, which makes the identity argument harder
  than most

## License

MIT. Use it in your own training, fork it, rename it. If you teach from it, a link
back is appreciated and not required.
