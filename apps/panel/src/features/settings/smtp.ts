import { z } from "zod"
import type { AccountSave, SmtpAccount, SmtpSecurity } from "@/features/settings/api/payments"
import { nothingStored } from "@/features/settings/payments"

/**
 * The shop's own mail server's form (adr/0036 Ek 2026-11-10): the server
 * and how it is secured, the login (the password written once), the
 * address mail goes from, and the campaign pace. The server checks it all
 * again and signs in before anything is saved.
 */

const S = "settings.notifications.smtp"

export const SMTP_PORTS = [25, 465, 587, 2525] as const
export const DEFAULT_RATE = 30
const MAX_RATE = 300

/** The port each security usually listens on: chosen with it, changeable. */
export const PORT_OF: Record<SmtpSecurity, number> = { tls: 465, starttls: 587, none: 25 }

// A full name with a dot, its last label starting with a letter, as the server asks
// (security review M1): `2130706433`, `127.1` and the like are no host
const HOST =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Any printable characters, spaces too; nothing that ends a line
const PASSWORD = /^[^\p{Cc}]{1,256}$/u
// One line, no invisible format character (bidi, zero-width) but the emoji joiner
const ONE_LINE = /^(?:(?![\p{Cc}\p{Cf}])[^]|‍)*$/u

/** This machine itself: only there may mail go without TLS (a local Postfix). */
export const isLoopback = (host: string): boolean =>
  /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1)$/.test(host.trim().toLowerCase())

export interface SmtpFormValues {
  host: string
  port: string
  security: SmtpSecurity
  username: string
  password: string
  fromEmail: string
  fromName: string
  rate: string
}

export const smtpFormValues = (account: SmtpAccount | undefined): SmtpFormValues => {
  const settings = account?.settings
  return {
    host: settings?.host ?? "",
    port: String(settings?.port ?? PORT_OF.starttls),
    security: settings?.security ?? "starttls",
    username: settings?.username ?? "",
    password: "",
    fromEmail: settings?.from_email ?? "",
    fromName: settings?.from_name ?? "",
    rate: String(settings?.rate_per_minute ?? DEFAULT_RATE),
  }
}

/** The password is asked for with a login, unless one is kept for this server and login. */
export function smtpFormSchema(account: SmtpAccount | undefined) {
  return z
    .object({
      host: z
        .string()
        .trim()
        .toLowerCase()
        .refine(
          (host) => host === "localhost" || HOST.test(host) || IPV4.test(host) || host === "::1",
          `${S}.hostInvalid`
        ),
      port: z
        .string()
        .trim()
        .regex(/^\d{1,5}$/, `${S}.portInvalid`),
      security: z.enum(["tls", "starttls", "none"]),
      username: z.string().trim().max(256).regex(ONE_LINE, `${S}.usernameInvalid`),
      password: z.string(),
      fromEmail: z.string().trim().max(254).regex(EMAIL, `${S}.fromEmailInvalid`),
      fromName: z.string().trim().max(100).regex(ONE_LINE, `${S}.fromNameInvalid`),
      rate: z
        .string()
        .trim()
        .refine((value) => {
          const rate = Number(value)
          return Number.isInteger(rate) && rate >= 1 && rate <= MAX_RATE
        }, `${S}.rateInvalid`),
    })
    .superRefine((values, ctx) => {
      if (values.security === "none" && !isLoopback(values.host)) {
        ctx.addIssue({ code: "custom", path: ["security"], message: `${S}.plainRemote` })
      }
      if (values.password !== "" && !PASSWORD.test(values.password)) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "settings.payments.account.secretFormat",
        })
      }
      // Another server, port, security or login: the stored password does not go to it
      const sameAccount =
        !nothingStored(account) &&
        account?.settings?.host === values.host.trim().toLowerCase() &&
        account.settings.port === Number(values.port) &&
        account.settings.security === values.security &&
        (account.settings.username ?? "") === values.username.trim()
      const kept = sameAccount && account.secrets["password"] === true
      if (values.username.trim() !== "" && values.password === "" && !kept) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "settings.payments.account.secretRequired",
        })
      }
    })
}

export const smtpSaveBody = (values: SmtpFormValues): AccountSave => ({
  settings: {
    host: values.host.trim().toLowerCase(),
    port: Number(values.port),
    security: values.security,
    ...(values.username.trim() ? { username: values.username.trim() } : {}),
    from_email: values.fromEmail.trim(),
    ...(values.fromName.trim() ? { from_name: values.fromName.trim() } : {}),
    rate_per_minute: Number(values.rate),
  },
  // Not trimmed: a password may begin or end with a space
  ...(values.password !== "" ? { secrets: { password: values.password } } : {}),
})
