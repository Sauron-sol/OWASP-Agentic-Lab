# Lab 04 — ASI05 Unexpected Code Execution

**Time:** ~70 minutes · **You edit:** `src/security/sandbox.ts` · **Check:** `npm run check:04`

## Read this before you run it

This is the one lab that really executes a child process on your machine. The payload
is `src/world/attacker-harness/scripts/repro.js`. Open it and read it — it is thirty
lines, it makes no network calls, and it writes one file to your temp directory.

It also only records the plaintext of credentials that contain the string `FAKE`.
Anything else it finds in your environment is noted by name and length and not
written down, because you may be running this on a machine with live tokens on it and
a teaching exercise should not put them in a file. The count is the lesson; the
plaintext is not needed for it.

Reading the payload before running it is not a formality. It is the habit this lab is
about.

```bash
npm run attack:04
```

## What just happened

Issue #733 says you cannot reproduce the bug from logs, and helpfully provides the
command:

```
    node ./scripts/repro.js
```

So we gave the agent a shell. For a coding agent this is the single most useful
capability you can add: clone the repo, install dependencies, run the tests,
reproduce the problem. It is also where untrusted text stops being text.

The command ran. It printed a plausible failing session id, because a payload that
does not do its cover story gets noticed. It also read every environment variable it
was handed and wrote the interesting ones to a file:

```
credentials taken that had nothing to do with payments: 4
```

A Railway token, a GitHub token, a database URL, a Stripe key. None of them had
anything to do with reproducing a payment bug. All of them were in the environment
because the sandbox inherited the developer's environment.

Two more things the unhardened sandbox allowed:

```
running outside the sandbox root:  allowed
chaining a second command:         allowed
```

## This is the shape of the nine-second incident

Go back to the incident. The agent found a Railway API token that was not meant for
the task it was working on, and made a destructive API call. Nine seconds later the
production database and its volume-level backups were gone.

The agent's decision was ordinary. Reproduce the bug the way the reporter described.
Use the credential that is sitting right there. What made it an incident was that the
surrounding system had arranged for an ordinary decision to be able to reach
production with enough authority to destroy something.

**The agent will make mistakes. The sandbox determines how expensive they are
allowed to be.**

## What a fix has to do

Four things, and none of them involve asking the model to be more careful about which
commands it runs. That instinct is the wrong one and this lab exists partly to
break it.

### 1. Allowlist the shape, not the string

Decide which binaries a repro step may legitimately invoke. Then remember that
`;`, `&&`, `||`, backticks and `$(...)` turn one command into two, so an allowlist of
first words is not an allowlist of commands unless you also refuse the metacharacters.

Denylists of dangerous strings lose this game. Allowlists of permitted shapes win it.

### 2. Do not hand it credentials

Look at what the stub passes as `env`. A sandbox that inherits the developer's
environment is not a sandbox, it is a convenience with a security-sounding name.

Build the child's environment from nothing and add only what a repro step genuinely
needs. `PATH`, a writable `HOME` and `TMPDIR` inside the sandbox, a locale. That is
close to the whole list.

### 3. Contain it

Keep the working directory inside `SANDBOX_ROOT`, and resolve the path before you
compare it — `../../..` is a thing. Put a timeout on execution so a hung or spinning
command cannot hold the agent forever, and a cap on output so a noisy one cannot
exhaust memory.

### 4. Write down what you did not fix

`labs/lab-04-code-execution/NOTES.md` has a template. Fill it in. The point of this
step is that everything in items 1 to 3 runs *inside the same process as the agent*,
and a control that lives in the same process as the thing it is containing is a
speed bump.

The reference solution's closing comment is the version of this answer we would give.
Write yours before you read it.

## The honest limit of this lab

Your hardened `execute()` will pass `check:04`, and an allowlisted `node` can still
open a socket and post anything it can read to anywhere on the internet. It runs as
your user. It can read your home directory. A timeout is not a cgroup.

The real boundary for ASI05 is not a function. It is a container or a VM, per task,
thrown away afterwards, with default-deny network egress and only the checkout
mounted. The in-process version is worth having because it is cheap and catches the
common case, and worth being clear-eyed about because it is not the boundary.

## If you get stuck

`npm run solution -- 04` shows the diff against a reference implementation without
changing anything. Read its closing comment last, after you have written your own
NOTES.md — most of the answer to ASI05 is not TypeScript.

## Check

```bash
npm run check:04
npm run attack:04
```

The suite checks that a legitimate repro still runs and still prints its session id,
that the payload finds nothing worth taking, that a command cannot run outside the
sandbox root, that chaining is refused, that a binary with no business in a repro step
is refused, and that execution is bounded in time.

The last one takes twenty seconds against the unhardened sandbox. That is the bug.

## Questions worth sitting with

1. Your allowlist includes `npm`. `npm install` runs arbitrary lifecycle scripts from
   the network. Is `npm` still on your list, and if so, what else had to be true?
2. The agent needs to check out the reporter's repository to reproduce anything. Where
   does that checkout live, who can write to it, and what happens to it afterwards?
3. You scrubbed the environment. Where else does a process pick up credentials on a
   developer machine? (`~/.aws`, `~/.config/gh`, `~/.docker`, the keychain, a running
   agent socket.)
4. Suppose the command needs the network to be useful — installing dependencies, for
   instance. Write the smallest egress policy that makes that safe.
