import { isLoopbackUrl } from "@qticaret/server-kit"
import { isLocalEnv } from "./env"
import type { Env } from "./env"

/**
 * Why a developer's script (`cp:seed-dev`, the e2e owner) may not run
 * here, or null (C7 review L3): only in development or test, and only
 * against a database on this machine, so a local `.env` pointing at a
 * deployed database is refused too. The URL is never named in the answer.
 */
export function localOnlyProblem(env: Pick<Env, "NODE_ENV" | "DATABASE_URL">): string | null {
  if (!isLocalEnv(env)) {
    return "only in development or test"
  }
  let loopback: boolean
  try {
    loopback = isLoopbackUrl(env.DATABASE_URL)
  } catch {
    loopback = false
  }
  return loopback ? null : "only against a database on this machine"
}
