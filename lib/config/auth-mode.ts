/**
 * Server-side auth mode detection.
 * Mock auth is development-only — never Preview or Production.
 */

export {
  isDatabaseAuthConfigured,
  isDatabaseRuntime,
  isMockAuthAllowed,
  isMockRuntime,
  getRuntimeMode,
} from "@/lib/config/runtime-mode";
