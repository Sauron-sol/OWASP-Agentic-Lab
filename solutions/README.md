# Reference solutions

One file per lab, each a drop-in replacement for the matching file in `src/security/`.

Use them the way you would use someone else's pull request: finish your own
version first, then read theirs and work out which of the two is wrong. Several
of these make judgement calls you might reasonably make differently, and a couple
are deliberately stricter than a production system would be.

```bash
npm run solution -- 02            # show the diff against your version. changes nothing.
npm run solution -- 02 --apply    # overwrite src/security/policy.ts with the reference
```

Use the script rather than `cp`: these files live one directory deeper than the ones
they replace, so a plain copy leaves broken imports. `--apply` keeps your version
next to the original as `policy.ts.yours`.

## What each one is not

- `lab-01/untrusted.ts` - the sentence filter is mitigation, not a boundary. Any
  attacker who reads this file can phrase around it. It is in the solution because
  making the cheap attack fail is still worth doing, not because it is the control.
- `lab-02/policy.ts` - refuses an outbound write that carries confidential content.
  A production system would more likely redact and annotate, so the useful part of
  the comment still gets posted. Refusing is easier to test and easier to reason
  about, which is why it is here.
- `lab-03/capability.ts` - an in-process object standing in for a real short-lived
  credential. The shape is right; a real one is signed, is issued by something
  other than the agent, and is verified by the resource rather than by the caller.
- `lab-04/sandbox.ts` - read the closing comment. Most of the answer to ASI05 is
  not TypeScript.
- `lab-05/memory-guard.ts` - the behavioural-text heuristic is the weakest part.
  The durable idea is the other one: provenance, an approval state, and a way to
  take an entry back out.

## If you want to check them all at once

```bash
for n in 01 02 03 04 05; do npm run solution -- $n --apply; done
npm run check
```

35 of the 36 checks pass in that state. The one that does not is the capstone's
write-up check, which no reference implementation can pass for you.

Restore your own work from the `.yours` files afterwards, or `git checkout src/security`.
