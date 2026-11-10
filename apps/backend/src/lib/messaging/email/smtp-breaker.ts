/**
 * A brake on suppressing addresses the shop's own mail server refuses
 * (adr/0036 Ek 2026-11-10, security review M2). One customer's "no such
 * mailbox" is that customer's; a server refusing half of what it is given
 * is the server's (a broken relay rule, a full disk read as 5.1.1), and its
 * refusals must not put real customers on the list.
 *
 * Within a 10-minute window, once at least 5 SMTP sends were refused as
 * `recipient_rejected` and those are at least half of the window's SMTP
 * sends, the brake trips: for an hour nothing more is suppressed, the
 * suppressions the window made are taken back, and the shop is told once
 * (`messaging.smtp_rejections_tripped`, the bell and the staff e-mail).
 * Counted per process: a worker and a server each count their own sends;
 * the thresholds hold either way.
 */

export const BREAKER = {
  windowMs: 10 * 60 * 1000,
  minRejections: 5,
  share: 0.5,
  holdMs: 60 * 60 * 1000,
} as const

export type SendOutcome = "sent" | "rejected" | "failed"

export interface BreakerVerdict {
  /** Whether this refusal may go on the suppression list. */
  suppress: boolean
  /** True once, when the brake trips: undo the window's suppressions, tell the shop. */
  tripped: boolean
  /** The window's numbers when it tripped. */
  rejections: number
  sends: number
  /** Suppressions made within the window, to take back when it trips. */
  undo: string[]
}

export interface SmtpBreaker {
  /** Records one SMTP send's outcome; for a refusal, says whether to suppress. */
  record: (outcome: SendOutcome, now?: number) => BreakerVerdict
  /** A suppression this window made, by its id, in case the brake trips. */
  noteSuppression: (id: string, now?: number) => void
  isOpen: (now?: number) => boolean
}

export function createSmtpBreaker(options: typeof BREAKER = BREAKER): SmtpBreaker {
  let sends: { at: number; rejected: boolean }[] = []
  let suppressions: { at: number; id: string }[] = []
  let heldUntil = 0
  const prune = (now: number) => {
    const since = now - options.windowMs
    sends = sends.filter((each) => each.at > since)
    suppressions = suppressions.filter((each) => each.at > since)
  }
  const isOpen = (now = Date.now()) => now < heldUntil
  return {
    isOpen,
    noteSuppression: (id, now = Date.now()) => {
      suppressions.push({ at: now, id })
    },
    record: (outcome, now = Date.now()) => {
      prune(now)
      sends.push({ at: now, rejected: outcome === "rejected" })
      // A burst cannot grow memory without bound: the window keeps its last 10 000
      if (sends.length > 10_000) {
        sends = sends.slice(-10_000)
      }
      const rejections = sends.filter((each) => each.rejected).length
      const verdict = { rejections, sends: sends.length, undo: [] as string[] }
      if (outcome !== "rejected") {
        return { ...verdict, suppress: false, tripped: false }
      }
      if (isOpen(now)) {
        return { ...verdict, suppress: false, tripped: false }
      }
      if (rejections >= options.minRejections && rejections / sends.length >= options.share) {
        heldUntil = now + options.holdMs
        const undo = suppressions.map((each) => each.id)
        suppressions = []
        return { ...verdict, suppress: false, tripped: true, undo }
      }
      return { ...verdict, suppress: true, tripped: false }
    },
  }
}

/** The instance's brake, shared by every SMTP send of this process. */
export const smtpBreaker: SmtpBreaker = createSmtpBreaker()
