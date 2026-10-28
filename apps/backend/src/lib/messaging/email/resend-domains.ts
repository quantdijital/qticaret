import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClientOptions } from "../../clients"
import { RESEND_URL } from "./transports"

/**
 * Resend's domains (adr/0036 §6): the shop's sender domain is added to the
 * platform's Resend account, and the DNS records Resend wants (DKIM, SPF)
 * are shown to the shop until Resend sees them.
 */

const record = z
  .object({
    record: z.string().max(40),
    name: z.string().max(255),
    type: z.string().max(10),
    value: z.string().max(4096),
    status: z.string().max(40).optional(),
    priority: z.number().int().optional(),
  })
  .loose()

const domain = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().max(255),
    status: z.string().max(40),
    records: z.array(record).max(20).optional(),
  })
  .loose()

export type ResendDomain = z.infer<typeof domain>
export type ResendRecord = z.infer<typeof record>

const resendErrorCode = (body: unknown): string | undefined => {
  const name = (body as { name?: unknown } | null)?.name
  return typeof name === "string" && /^[a-z_]{1,40}$/.test(name) ? name : undefined
}

export function createResendDomains(
  apiKey: string,
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> & { baseUrl?: string } = {}
) {
  const client = createHttpClient({
    ...options,
    baseUrl: options.baseUrl ?? RESEND_URL,
    provider: "resend",
    defaultHeaders: { authorization: `Bearer ${apiKey}` },
    errorCode: resendErrorCode,
  })
  return {
    /** Adds the domain; Resend answers with the records to publish. */
    create: (name: string) =>
      client.request({ method: "POST", path: "/domains", json: { name }, schema: domain }),
    get: (id: string) => client.request({ path: ["domains", id], schema: domain }),
    /** Asks Resend to look at the DNS again; the domain's status follows. */
    verify: (id: string) =>
      client.request({
        method: "POST",
        path: ["domains", id, "verify"],
        idempotent: true,
        schema: z.object({ id: z.string() }).loose(),
      }),
    remove: (id: string) =>
      client.request({
        method: "DELETE",
        path: ["domains", id],
        schema: z.object({ id: z.string() }).loose(),
      }),
  }
}

export type ResendDomains = ReturnType<typeof createResendDomains>
