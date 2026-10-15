import { z } from "zod";

export const diditEnvironmentSchema = z.enum(["sandbox", "live"]);
export type DiditEnvironment = z.infer<typeof diditEnvironmentSchema>;

export function matchesExpectedDiditEnvironment(value: unknown, expected: DiditEnvironment): boolean {
  return diditEnvironmentSchema.safeParse(value).success && value === expected;
}
