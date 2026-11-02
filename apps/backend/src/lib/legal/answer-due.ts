/** The days KVKK md. 13 gives to answer a person's data request (adr/0041 §6). */
export const PRIVACY_ANSWER_DAYS = 30

const DAY_MS = 86_400_000

/** When the answer to a data request that came at `received` is due. */
export const privacyAnswerDue = (received: Date): Date =>
  new Date(received.getTime() + PRIVACY_ANSWER_DAYS * DAY_MS)

/** That day as the shop's staff read it ("2 Aralık 2026"), in the shop's time zone. */
export const privacyAnswerDueText = (received: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone }).format(
    privacyAnswerDue(received)
  )
