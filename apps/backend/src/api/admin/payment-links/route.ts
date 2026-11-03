import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PAYMENT_LINKS_MODULE } from "../../../modules/payment-links"
import type PaymentLinksModuleService from "../../../modules/payment-links/service"
import { createPaymentLinkWorkflow } from "../../../workflows/payment-links/create"
import { linkById } from "../../../workflows/payment-links/manage"
import { linkShare } from "../../../workflows/payment-links/share"
import { linkDetail, linkSummary } from "../../../workflows/payment-links/views"
import type { LinkRow } from "../../../workflows/payment-links/views"
import type { AdminGetPaymentLinksType, AdminPostPaymentLinkType } from "./validators"

/**
 * GET /admin/payment-links (adr/0051 §13): Siparişler > "Ödeme
 * bağlantıları", newest first, the customer masked; by status, by who made
 * it, or only those with a discount (§10). A recorded read.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetPaymentLinksType>,
  res: MedusaResponse
): Promise<void> {
  const { status, discounted, created_by, limit, offset } =
    req.validatedQuery as unknown as AdminGetPaymentLinksType
  const [links, count] = await req.scope
    .resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
    .listAndCountPaymentLinks(
      {
        ...(status ? { status } : {}),
        ...(created_by ? { created_by } : {}),
        ...(discounted === "true" ? { discount_total: { $gt: 0 } } : {}),
        ...(discounted === "false" ? { discount_total: 0 } : {}),
      },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )
  res.json({
    payment_links: links.map((link) => linkSummary(req.scope, link as unknown as LinkRow)),
    count,
    limit,
    offset,
  })
}

/**
 * POST /admin/payment-links (adr/0051 §1–§3): a link for a customer, priced
 * by the catalog; the person proves themselves again. The answer carries
 * the link and its share texts; sending it is `/resend`.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostPaymentLinkType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const { result } = await createPaymentLinkWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      customer_id: body.customer_id ?? null,
      guest: body.guest
        ? {
            first_name: body.guest.first_name,
            last_name: body.guest.last_name,
            email: body.guest.email,
            phone: body.guest.phone ?? null,
          }
        : null,
      address: body.address
        ? {
            ...body.address,
            phone: body.address.phone ?? null,
            address_2: body.address.address_2 ?? null,
            postal_code: body.address.postal_code ?? null,
          }
        : null,
      lines: body.lines,
      discount: body.discount ?? null,
      shipping_option_id: body.shipping_option_id ?? null,
      note: body.note ?? null,
      hours: body.expires_in_hours,
    },
  })
  const link = await linkById(req.scope, result.id)
  res.status(201).json({
    payment_link: linkDetail(req.scope, link),
    share: await linkShare(req.scope, link),
  })
}
