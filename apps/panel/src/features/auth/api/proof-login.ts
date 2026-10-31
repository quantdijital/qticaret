import { challengeHeader, solveChallenge } from "@/lib/challenge"
import type { Challenge } from "@/lib/challenge"
import { sdk } from "@/lib/sdk"
import type { Credentials, MfaChallenge } from "./me"

interface LoginAnswer {
  token?: string
  mfa_challenge?: MfaChallenge
  message?: string
  challenge?: Challenge
}

/**
 * The sign-in request as the SDK sends it, its answer's body kept: the
 * SDK's errors keep only the message, and a 428 carries its challenge.
 */
async function postLogin(credentials: Credentials, headers: Record<string, string> = {}) {
  const response = await fetch(new URL("/auth/user/emailpass", window.location.origin), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json", ...headers },
    body: JSON.stringify(credentials),
  })
  const body = (await response.json().catch(() => ({}))) as LoginAnswer
  return { status: response.status, body }
}

/**
 * A sign-in past the proof of work the backend asks after five tries on
 * one address (adr/0044 §1, the F15 audit): the challenge solved in the
 * browser, the request made again with its answer, then the session
 * opened as the SDK's session mode does. Wrong credentials fail as they
 * would without it.
 */
export async function signInWithProof(credentials: Credentials): Promise<MfaChallenge | null> {
  let answer = await postLogin(credentials)
  const challenge = answer.status === 428 ? answer.body.challenge : undefined
  if (challenge) {
    const nonce = await solveChallenge(challenge)
    answer = await postLogin(credentials, challengeHeader(challenge.token, nonce))
  }
  const token = answer.body.token
  if (answer.status >= 400 || !token) {
    throw Object.assign(new Error(answer.body.message ?? ""), { status: answer.status })
  }
  await sdk.client.fetch("/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  return answer.body.mfa_challenge ?? null
}
