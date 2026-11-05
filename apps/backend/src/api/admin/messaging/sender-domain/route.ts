import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { emailTransport } from "../../../../lib/messaging/email"
import {
  addSenderDomainWorkflow,
  currentSenderDomain,
  removeSenderDomain,
  resendDomains,
  senderAddress,
} from "../../../../workflows/messaging/sender-domain"
import type { AdminPostSenderDomainType } from "./validators"

/** Resend gives no DMARC record; this policy only reports, so nothing is lost while it is set up. */
const DMARC = { record: "DMARC", name: "_dmarc", type: "TXT", value: "v=DMARC1; p=none;" }

/**
 * Whether the shop's e-mail goes out and from which address; `available`,
 * whether the shop can verify its own domain here (through Resend only).
 */
export async function senderDomainView(container: MedusaContainer) {
  const domain = await currentSenderDomain(container)
  const sender = await senderAddress(container)
  return {
    sending: emailTransport() !== null && sender !== null,
    available: resendDomains() !== null,
    sender,
    domain: domain
      ? {
          name: domain.name,
          local_part: domain.local_part,
          status: domain.status,
          records: domain.records,
          checked_at: domain.checked_at,
          verified_at: domain.verified_at,
        }
      : null,
    dmarc: DMARC,
  }
}

/**
 * GET /admin/messaging/sender-domain (F9.6, adr/0036): the address the
 * shop's e-mail goes from, its own domain if it has one, and the DNS
 * records to publish until Resend sees them.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await senderDomainView(req.scope))
}

/** POST: adds the shop's domain at Resend; e-mail keeps the platform's address until verified. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostSenderDomainType>,
  res: MedusaResponse
): Promise<void> {
  await addSenderDomainWorkflow(req.scope).run({ input: req.validatedBody })
  res.status(201).json(await senderDomainView(req.scope))
}

/** DELETE: the shop's domain goes; e-mail goes from the platform's address again. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await removeSenderDomain(req.scope)
  res.json(await senderDomainView(req.scope))
}
