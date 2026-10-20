export { prepareForPlanner, detectGoalDrift, UNTRUSTED_ORIGINS } from './untrusted.js';
export { authorize, MUST_NOT_EGRESS, type PolicyInput } from './policy.js';
export {
  mintCapability,
  assertAuthority,
  revoke,
  isRevoked,
  clearRevocations,
  AMBIENT_TOKEN,
  type Capability,
} from './capability.js';
export { execute, SANDBOX_ROOT, type ExecRequest, type ExecOutcome } from './sandbox.js';
export { canPersist, filterForRecall, rollback, type MemoryEntry } from './memory-guard.js';
