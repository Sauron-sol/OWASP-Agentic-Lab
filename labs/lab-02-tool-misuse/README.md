# Lab 02 — ASI02 Tool Misuse and Exploitation

**Time:** ~80 minutes · **You edit:** `src/security/policy.ts` · **Check:** `npm run check:02`

## Run it first

```bash
npm run attack:02
```

Two scenes. The second one is the uncomfortable one.

## Scene 1: a tool that is mounted but not granted

The support team liked the agent, so we gave it more tools. It can post comments,
look up customer records, read service configuration. Every one of those is a
reasonable thing for a support agent to have.

The task the operator created only needs two of them:

```
allowed for this task: read_issue, search_docs
mounted on the agent:  read_issue, search_docs, read_service_config,
                       get_customer_record, post_github_comment
```

Those are two different lists, and nothing in the system currently compares them.
The injected instruction in issue #601 reached a tool that the task never asked for,
because "the agent has this tool" was treated as "this task may use this tool".

## Scene 2: no injection at all

Now the honest version of ASI02. The operator asks for this, in their own words:

> Investigate issue 601, check the documentation, look up the customer record for the
> reporter, and post a summary comment on issue 601.

Every call the agent makes is on the allowed list. Every call is one the operator
explicitly asked for. No attacker text is involved in any decision.

And the agent publishes this onto a public GitHub issue:

```
notes: CONFIDENTIAL: flagged for scraping, 14 accounts same fingerprint
```

The tool worked exactly as designed. The authorization check, such as it was,
succeeded. **The action still did not match what the user actually intended.** That
gap is ASI02, and it is why "the model decided to call the tool" cannot be the
security boundary.

Read that scene's output again and notice what would not have helped: a better
prompt, a smarter model, a stricter allowlist of tools. The agent needed
`get_customer_record` and it needed `post_github_comment`. The problem is what was
allowed to flow between them.

## What a fix has to do

`src/security/policy.ts` exports one function, `authorize`, and the agent calls it
for every tool call before anything runs. Three checks.

### 1. Least privilege

`task.allowedTools` is what this task may use. A tool existing on the agent is not
permission. This is the cheapest check in the whole repo and it closes scene 1.

### 2. Scope

Right tool, wrong target is still an incident. `task.scope` declares which repo,
which issues, and which environment the task concerns. Compare it against
`call.args`. A triage task scoped to issue #601 that posts to #482 has done something
nobody asked for, even though `post_github_comment` is on its list.

Scope is also where the nine-second incident shows up: a task scoped to staging reaching
for production.

### 3. Data flow

This is the one that takes real thought, and the one that closes scene 2.

An outbound write carries a payload. `call.args.body` is what will be published, and
`input.context` tells you where every piece of the agent's knowledge came from, with
origins intact. Two rules to encode:

- Nothing in `MUST_NOT_EGRESS` leaves, ever, whatever the model's reasoning was.
- Content that arrived from a confidential origin does not leave through a public
  one. `support-db` and `service-config` are confidential; a GitHub comment is
  public.

`findTool(call.tool)?.spec.effect` tells you whether a call is outbound at all, so
you are not running this on every read.

### The lazy fix, and why it fails

`return { allow: false, ... }` passes the attack assertions and fails the lab.
`npm run check:02` also asserts that an ordinary support task still posts its comment.
Both halves have to hold at once. That constraint is the actual job.

## The judgement call in this lab

Refusing an outbound write that carries confidential content is the easiest thing to
test and the bluntest thing to ship. A production system would more likely **redact
and annotate** — post the useful half of the comment, drop the record, and note that
something was withheld — because a support agent that silently refuses to comment is
a support agent nobody uses.

The reference solution refuses, because refusing is easier to reason about in a lab.
If you build the redacting version instead, `check:02` will still pass, and you will
have built the better thing. Write down which one you would ship and why.

## If you get stuck

`npm run solution -- 02` shows the diff against a reference implementation without
changing anything. Read the note in `solutions/README.md` first: the reference refuses
the write where a real system would redact, and it says so.

## Check

```bash
npm run check:02
npm run attack:02
```

## Questions worth sitting with

1. Your data-flow rule compares payload text against context text. What happens when
   the model paraphrases the customer record instead of copying it?
2. Scope compares `call.args` to `task.scope`. Who writes `task.scope`, and what stops
   the agent from proposing its own?
3. Scene 2 had no attacker in it. How much of your agent's risk surface is just
   "someone asked for something reasonable"?
4. Where should this function actually live in a real system — in the agent process,
   in a sidecar, or at the resource? What does each choice cost you?
