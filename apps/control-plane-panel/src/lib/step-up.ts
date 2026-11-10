import { api, codeOf, statusOf } from "./api"

/**
 * Proving oneself again for a sensitive change (adr/0061 §3.5, Ek C4): the
 * control plane answers 428 (`cp.step_up_required`, or `cp.step_up_invalid`
 * for a proof that ran out) until the request carries a short-lived proof
 * in `x-cp-step-up`. The dialog (`StepUpHost`) asks for the app's code or
 * a recovery code, `POST /admin/cp/me/step-up` turns it into a proof for
 * five minutes, and the request is made again with it. The proof is kept
 * in memory only, for the next changes within its life (a role change and
 * a deactivation in a row ask once), and forgotten on sign-out.
 */

export const STEP_UP_HEADER = "x-cp-step-up"

export type StepUpMethod = "totp" | "recovery_code"

export interface StepUpProof {
  method: StepUpMethod
  code: string
}

export interface StepUpAsk {
  /** The last code was wrong: say so, ask again. */
  failed: boolean
  answer: (proof: StepUpProof | null) => void
}

/** The person closed the dialog: the change is not made, nothing to report. */
export class StepUpCancelled extends Error {
  readonly cancelled = true
  constructor() {
    super("step_up_cancelled")
  }
}

export const isStepUpCancelled = (error: unknown): boolean =>
  (error as { cancelled?: unknown } | null)?.cancelled === true

interface HeldProof {
  token: string
  expiresAt: number
}

// A proof this close to its end is not sent: it could run out on the way
const MARGIN_MS = 20_000

let asker: ((ask: StepUpAsk) => void) | null = null
let held: HeldProof | null = null

/** The dialog registers here; one at a time. */
export function setStepUpAsker(next: ((ask: StepUpAsk) => void) | null): void {
  asker = next
}

/** Sign-out (or a session ended): the proof was this session's. */
export function forgetStepUp(): void {
  held = null
}

function heldHeaders(now: number = Date.now()): Record<string, string> {
  if (held && held.expiresAt - MARGIN_MS > now) {
    return { [STEP_UP_HEADER]: held.token }
  }
  held = null
  return {}
}

/** The code turned into a proof; a wrong one throws `cp.step_up_failed`. */
async function prove(proof: StepUpProof): Promise<HeldProof> {
  const answer = await api<{ step_up: { token: string; expires_at: string } }>(
    "/admin/cp/me/step-up",
    { method: "POST", body: { method: proof.method, code: proof.code } }
  )
  return { token: answer.step_up.token, expiresAt: new Date(answer.step_up.expires_at).getTime() }
}

const ask = (registered: (ask: StepUpAsk) => void, failed: boolean) =>
  new Promise<StepUpProof | null>((resolve) => {
    registered({ failed, answer: resolve })
  })

/**
 * A call that may need a fresh proof: asked on a 428, made again with it.
 * `call` gets the headers to send: a proof still held, or none.
 */
export async function withStepUp<T>(
  call: (headers: Record<string, string>) => Promise<T>
): Promise<T> {
  try {
    return await call(heldHeaders())
  } catch (error) {
    if (statusOf(error) !== 428 || !asker) {
      throw error
    }
    held = null
  }
  // The dialog of the panel's shell, mounted while the person is signed in
  const registered = asker
  let failed = false
  for (;;) {
    const proof = await ask(registered, failed)
    if (!proof) {
      throw new StepUpCancelled()
    }
    try {
      held = await prove(proof)
    } catch (error) {
      if (codeOf(error) !== "cp.step_up_failed") {
        throw error
      }
      failed = true
      continue
    }
    try {
      return await call(heldHeaders())
    } catch (error) {
      if (statusOf(error) !== 428) {
        throw error
      }
      held = null
      failed = false
    }
  }
}
