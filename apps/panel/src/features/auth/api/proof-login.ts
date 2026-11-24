import { sdk } from "@/lib/sdk"
import { answerKey, postGated } from "./gated-post"
import type { StaffGate } from "./gated-post"
import type { Credentials, MfaChallenge } from "./me"

interface LoginAnswer {
  token?: string
  mfa_challenge?: MfaChallenge
}

/**
 * The sign-in request past the backend's bot checks (`postGated`):
 * Turnstile's token on every try (adr/0044 Ek 2026-11-24), the proof of
 * work it asks after five tries on one address (adr/0044 §1, the F15
 * audit) solved in the browser; then the session opened as the SDK's
 * session mode does. Wrong credentials fail as they would without it.
 */
export async function signInWithProof(
  credentials: Credentials,
  gate: StaffGate | null = null
): Promise<MfaChallenge | null> {
  const answer = await postGated<LoginAnswer>("/auth/user/emailpass", credentials, gate)
  const token = answer.body.token
  if (answer.status >= 400 || !token) {
    throw Object.assign(new Error(answer.body.message ?? ""), {
      status: answer.status,
      code: answerKey(answer.body),
    })
  }
  await sdk.client.fetch("/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  return answer.body.mfa_challenge ?? null
}
