import type { ReminderKind } from "@qticaret/types/control-plane"
import { escapeHtml } from "../mail/invite"
import { format } from "../mail/messages"
import type { MailMessageKey } from "../mail/messages"
import type { OutgoingEmail } from "../mail/transport"
import { addDays, daysBetween } from "./days"

/** A day as a Turkish reader writes it: `1 Aralık 2026`. */
export function turkishDate(day: string): string {
  const [year = "", month = "", date = ""] = day.split("-")
  const monthKey = `billing_reminder.month.${String(Number(month))}` as MailMessageKey
  return `${String(Number(date))} ${format(monthKey)} ${year}`
}

/** Kuruş as Turkish lira: `1.490,00 TL`. */
export function turkishLira(kurus: number): string {
  const lira = Math.floor(kurus / 100)
  const rest = String(kurus % 100).padStart(2, "0")
  return `${String(lira).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${rest} TL`
}

export interface ReminderFacts {
  kind: ReminderKind
  shop: string
  package: string
  /** The contact's name, when known. */
  name: string | null
  due_on: string
  period_start: string
  period_end: string
  amount: number
  grace_ends_on: string
  today: string
  instruction: string | null
}

const SUBJECTS: Record<ReminderKind, MailMessageKey> = {
  before_14: "billing_reminder.subject.before",
  before_7: "billing_reminder.subject.before",
  before_3: "billing_reminder.subject.before",
  before_1: "billing_reminder.subject.before",
  due: "billing_reminder.subject.due",
  overdue_3: "billing_reminder.subject.overdue",
  restricted: "billing_reminder.subject.restricted",
}

const BODIES: Record<ReminderKind, MailMessageKey> = {
  before_14: "billing_reminder.before",
  before_7: "billing_reminder.before",
  before_3: "billing_reminder.before",
  before_1: "billing_reminder.before",
  due: "billing_reminder.due",
  overdue_3: "billing_reminder.overdue",
  restricted: "billing_reminder.restricted",
}

/**
 * A payment reminder's e-mail (adr/0061 §7, Ek C16), in Turkish, to the
 * shop's billing contact: the day and amount as they stand (a reminder
 * sent late still says how many days are left), how to pay when the
 * platform has said so, and where the shop's panel shows it.
 */
export function reminderEmail(to: string, facts: ReminderFacts): OutgoingEmail {
  const values = {
    shop: facts.shop,
    package: facts.package,
    name: facts.name ?? "",
    date: turkishDate(facts.due_on),
    days: String(Math.max(daysBetween(facts.today, facts.due_on), 1)),
    period_start: turkishDate(facts.period_start),
    // The period's last day: its end is the next period's first
    period_end: turkishDate(addDays(facts.period_end, -1)),
    amount: turkishLira(facts.amount),
    grace_ends: turkishDate(facts.grace_ends_on),
  }
  const greeting = facts.name
    ? format("billing_reminder.greeting", values)
    : format("billing_reminder.greeting_plain")
  const body = format(BODIES[facts.kind], values)
  const instruction = facts.instruction
    ? [format("billing_reminder.instruction"), facts.instruction]
    : null
  const tail = [
    format("billing_reminder.panel"),
    format("billing_reminder.paid"),
    format("billing_reminder.sign"),
  ]
  const text = [greeting, body, ...(instruction ? [instruction.join("\n")] : []), ...tail].join(
    "\n\n"
  )
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(body)}</p>`,
    ...(instruction
      ? [
          `<p><strong>${escapeHtml(instruction[0] ?? "")}</strong><br>${escapeHtml(
            instruction[1] ?? ""
          ).replace(/\n/g, "<br>")}</p>`,
        ]
      : []),
    ...tail.map((line) => `<p>${escapeHtml(line)}</p>`),
  ].join("\n")
  return {
    to,
    subject: format(SUBJECTS[facts.kind], values),
    text,
    html,
    template: `cp.billing_${facts.kind}`,
  }
}
