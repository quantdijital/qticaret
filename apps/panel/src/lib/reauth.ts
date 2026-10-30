/**
 * Proving oneself again for a sensitive change (F12.6, adr/0040 §3): the
 * API answers 428 until the request carries a proof in its headers; the
 * dialog (`ReauthHost`) asks for it and the call is made again with it.
 */

export type ReauthMethod = "totp" | "recovery_code" | "password"

export interface ReauthProof {
  method: ReauthMethod
  secret: string
}

export interface ReauthAsk {
  /** The last proof was refused: say so, ask again. */
  failed: boolean
  answer: (proof: ReauthProof | null) => void
}

/** The person closed the dialog: the change is not made, nothing to report. */
export class ReauthCancelled extends Error {
  readonly cancelled = true
  constructor() {
    super("reauth_cancelled")
  }
}

let asker: ((ask: ReauthAsk) => void) | null = null

/** The dialog registers here; one at a time. */
export function setReauthAsker(next: ((ask: ReauthAsk) => void) | null): void {
  asker = next
}

const statusOf = (error: unknown) => (error as { status?: unknown } | null)?.status

/** The headers that carry a proof; the secret percent-encoded, as a password may hold "ş". */
export const reauthHeaders = (proof: ReauthProof): Record<string, string> => ({
  "x-reauth-method": proof.method,
  "x-reauth-secret": encodeURIComponent(proof.secret),
})

/**
 * A call that may need the person to prove themselves: asked on a 428,
 * made again with the proof. `extra` goes into the request's options:
 * nothing the first time, the proof's headers after.
 */
export async function withReauth<T>(
  call: (extra: { headers?: Record<string, string> }) => Promise<T>
): Promise<T> {
  try {
    // No proof the first time: most changes need none
    return await call({})
  } catch (error) {
    if (statusOf(error) !== 428 || !asker) {
      throw error
    }
  }
  // The dialog of the panel's shell, mounted while the person is signed in
  const ask = asker
  let failed = false
  for (;;) {
    const proof = await new Promise<ReauthProof | null>((resolve) => {
      ask({ failed, answer: resolve })
    })
    if (!proof) {
      throw new ReauthCancelled()
    }
    try {
      return await call({ headers: reauthHeaders(proof) })
    } catch (error) {
      if (statusOf(error) !== 428) {
        throw error
      }
      failed = true
    }
  }
}

export const isReauthCancelled = (error: unknown): boolean =>
  (error as { cancelled?: unknown } | null)?.cancelled === true
