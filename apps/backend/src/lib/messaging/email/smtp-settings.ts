import { z } from "@medusajs/framework/zod"
import { isLocalEnv, parseEnv } from "../../env"
import { MAX_SMTP_RATE, SMTP_PORTS, isLoopbackHost, isSmtpHost } from "./smtp-account"

/**
 * The SMTP account's settings as the panel saves them (adr/0036 Ek
 * 2026-11-10); the password is the one secret. Error messages are i18n keys.
 *
 * The server calls the host with the shop's password, so: mail ports only
 * (a typed host cannot reach a database or a cache on another port), and
 * plain text only to this machine. On a developer's machine and in tests a
 * local server may listen anywhere (Mailpit on 51025).
 */

// One line, nothing that could end a header
// (a constructor: a compiler may write U+2028 out as itself, which ends a regex literal)
const ONE_LINE = new RegExp("^[^\\p{Cc}\\u2028\\u2029]*$", "u")

export const smtpSettings = z
  .object({
    host: z
      .string()
      .trim()
      .toLowerCase()
      .refine((host) => isSmtpHost(host), "smtp.host_invalid"),
    port: z.number().int("smtp.port_invalid").min(1, "smtp.port_invalid").max(65535),
    security: z.enum(["tls", "starttls", "none"]),
    username: z.string().trim().max(256).regex(ONE_LINE, "smtp.username_invalid").optional(),
    from_email: z.email("smtp.from_email_invalid").max(254),
    from_name: z.string().trim().max(100).regex(ONE_LINE, "smtp.from_name_invalid").optional(),
    rate_per_minute: z
      .number()
      .int("smtp.rate_invalid")
      .min(1, "smtp.rate_invalid")
      .max(MAX_SMTP_RATE, "smtp.rate_invalid"),
  })
  .strict()
  .superRefine((settings, ctx) => {
    const local = isLoopbackHost(settings.host)
    if (settings.security === "none" && !local) {
      ctx.addIssue({ code: "custom", path: ["security"], message: "smtp.plain_remote" })
    }
    if (!SMTP_PORTS.includes(settings.port) && !(local && isLocalEnv(parseEnv()))) {
      ctx.addIssue({ code: "custom", path: ["port"], message: "smtp.port_invalid" })
    }
  })

export type SmtpSettings = z.infer<typeof smtpSettings>
