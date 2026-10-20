# Lab 03 — ASI03 Identity and Privilege Abuse

**Time:** ~80 minutes · **You edit:** `src/security/capability.ts` · **Check:** `npm run check:03`

## Run it first

```bash
npm run attack:03
```

## The question this lab is about

The agent needs credentials to call GitHub. The easiest implementation is obvious:
give it a token. Maybe the developer already has one. Maybe there is a service
account token in an environment variable. Maybe the user signed in with OAuth and the
agent reuses that delegated access.

This works, and it is how a lot of ordinary applications already call APIs.

An autonomous agent adds a question those applications never had to answer. When
GitHub receives the request, **who is acting?** The human? The agent? The application?
The task the agent is currently performing? Those are not the same thing, and the
difference starts mattering the moment the agent runs unattended.

You may have permission to merge a pull request. That does not mean every agent you
run should have permanent permission to merge pull requests. And if you authorize an
agent to merge one specific dependency update, that does not mean it should still
have that permission tomorrow, while triaging an unrelated security issue.

## What the attack shows

`attack:03` works on the credential layer directly rather than through a full agent
run, and that is deliberate. A tool can be called by the planner, by a retry worker,
by a peer agent, or by next week's code. So the credential check has to live at the
resource, not only in the planner's path.

It presents one capability and asks a resource five questions:

```
a read-only triage task deploying to production          -> ALLOWED
the read_issue capability used to pull a customer record  -> ALLOWED
yesterday's capability, reused today                     -> ALLOWED
another task's capability, presented for this task       -> ALLOWED
an in-scope read, which must keep working                -> ALLOWED
```

Four of those are wrong. They are all allowed because what the agent presents is this:

```
Token: engineering-bot
Scope: everything
Expires: never
```

A resource holding that can only ever answer one question — *is this credential
valid?* — and the answer is always yes. **A valid credential is not an authorized
action.** That sentence is the lab.

## What a fix has to do

The shape you are building is the one from the video:

```
User:    himalay
Agent:   triage-agent
Task:    investigate issue #482
Allowed: read_issue, search_docs
Expires: when the task finishes
```

### `mintCapability(task, call, agent)`

Issue authority for *this* task and *this* call instead of returning the shared
token. It should name the agent, the human it acts for, the task, only the tools the
task declared, only the resources in the task's scope, and an expiry no later than
the task's own. Consider capping the lifetime independently, so a task with a
generous deadline does not get a generous credential.

### `assertAuthority(cap, task, call, now)`

Runs inside every tool, before it does anything. Reject a capability that is a
wildcard agent-wide credential, has expired, belongs to a different task, does not
cover the tool, does not cover the resource in `call.args`, or belongs to a task
that has been revoked.

`revoke(taskId)` and `isRevoked(taskId)` are already there. Wire revocation into your
check now — the capstone needs it, and ASI10 is the reason it exists.

## Why this is not the same as lab 02

It is worth being precise, because the two labs look similar and OWASP separates them.

Lab 02 is **authorization of an action**: given what this task is for, should this
call happen at all? It runs once, in the agent loop, with the full context available.

Lab 03 is **identity and delegation**: on whose authority is this happening, how
narrow is that authority, how long does it last, and can it be taken away
independently of the human it was delegated from? It runs at the resource, where the
context is gone and all you have is the credential.

You want both, and the second one is what lets you stop an agent at 2am without
disabling the developer whose token it borrowed.

## If you get stuck

`npm run solution -- 03` shows the diff against a reference implementation without
changing anything. It is an in-process object standing in for a real short-lived
credential — the shape is right, the mechanism is not.

## Check

```bash
npm run check:03
npm run attack:03
```

Eight checks, seven of which are refusals and one of which is "the happy path still
runs". As always, both halves.

## Questions worth sitting with

1. Your capability is a plain object the agent mints for itself. What is wrong with
   that, and what does the real version look like? (Terms to search: token exchange,
   RFC 8693; workload identity; audience-restricted tokens.)
2. Every capability here expires when the task does. What about a task that
   legitimately takes six hours?
3. Your agent now has an identity separate from the developer's. What does that break
   in your logging, your rate limits, and your on-call runbook?
4. Descope's argument is that most of the agentic list collapses into an identity
   problem. Having written this lab and lab 02: how much of it does, and where does
   the argument stop?
