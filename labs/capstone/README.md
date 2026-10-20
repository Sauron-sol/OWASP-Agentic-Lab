# Capstone — the whole system at once

**Time:** ~45 minutes · **Check:** `npm run check:capstone`

## What you are doing

Everything at the same time. Every tool mounted — read, write, execute, memory,
deploy — and every poisoned issue in the fixture set, in one session, with memory
carried between runs.

```bash
npm run check:capstone
```

Four checks:

1. **Survives all the poisoned issues with every tool mounted.** Zero secret egress,
   zero config reads, zero customer records, zero deploys, nothing in the attacker's
   drop box, at least one refusal recorded, and no allowed call anywhere that
   originated in untrusted content.
2. **Leaves every legitimate workflow working.** Triage summarises. Support posts its
   comment. A repro command still runs.
3. **Can be stopped without taking the operator down with it.** `revoke(task.id)`, and
   the run terminates before it touches anything.
4. **Has a written incident note.** `labs/capstone/NOTES.md`, in your words.

If your five labs pass individually and the capstone does not, you have found an
interaction between controls. That is the most valuable failure in this repo — read
the audit log, not the assertion.

## Now look at what you built

Start where the video starts. One agent, GitHub issues, internal documentation, a
summary. Nothing about that needed a security platform.

Then: tools. Then credentials. Then third-party components. Then code execution. Then
memory. Then another agent. Each of those was a reasonable engineering decision that
made the agent more useful, and each one opened a trust boundary.

Read the list again with that in mind and the Top 10 stops looking like ten unrelated
AI problems:

```
The model reads something malicious.             ASI01
That can change its goal.                        ASI01
A changed goal can misuse a tool.                ASI02
The tool runs with some identity and privilege.  ASI03
The tool may come from an untrusted supply chain.ASI04
Some tools execute code.                         ASI05
Bad information can persist in memory.           ASI06
One agent can send it to another.                ASI07
That failure can cascade.                        ASI08
The agent can persuade a human to approve it.    ASI09
Eventually the agent itself is untrusted.        ASI10
```

They are different risks. They are one architecture.

## The mental model to take away

Treat the model as an **untrusted planner**.

It can reason. It can recommend. It can decide which action it would like to take. It
should not be the thing that decides whether that action is authorized.

The model proposes. The surrounding system authorizes, isolates, records, and when
necessary stops it.

That is the boundary, and it is visible in `src/agent/agent.ts` in about fifteen lines:

```
prepareForPlanner  ->  model.plan  ->  detectGoalDrift
                                   ->  authorize
                                   ->  mintCapability
                                   ->  tool.run (which asserts authority)
```

## Why the LLM Top 10 was not enough

Worth being able to answer, because someone will ask you.

Prompt injection still matters. Sensitive information disclosure still matters. Data
poisoning still matters. An agent still contains an LLM, and the LLM list still
describes that layer correctly.

But once the model can plan across several steps, call tools, inherit credentials,
write memory, delegate to other agents, and keep operating without a person approving
each step, you have problems that are not about the model any more. The model is where
the bad decision starts. The damage happens in the systems you connected to it.

## Your write-up

`labs/capstone/NOTES.md`. Four sections, a page is plenty. Delete the template marker
line at the top when you are done.

The third section asks which of the five uncovered risks would bite your own system
first. Answer that one about the system you actually work on, not about this one.

## Then

[`labs/STRETCH.md`](../STRETCH.md) has the other five: the third-party MCP server
whose tool description changes, the second agent that trusts a message because it says
it came from the triage agent, the one bad decision that becomes five, the approval
screen that makes a human complicit, and the agent you can no longer trust at all.

Each one needs something this repo does not have yet, which is why they are exercises
rather than labs.
