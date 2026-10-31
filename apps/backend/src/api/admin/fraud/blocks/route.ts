import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseKey } from "../../../../lib/crypto/pii"
import { parseEnv } from "../../../../lib/env"
import { ValidationError } from "../../../../lib/errors"
import { blockEntryOf } from "../../../../lib/fraud/block"
import { FRAUD_GUARD_MODULE } from "../../../../modules/fraud-guard"
import type FraudGuardModuleService from "../../../../modules/fraud-guard/service"
import { addBlockWorkflow } from "../../../../workflows/fraud/blocks"
import type { AdminGetFraudBlocksType, AdminPostFraudBlockType } from "../validators"

const FIELDS = [
  "id",
  "kind",
  "display",
  "reason",
  "created_by",
  "expires_at",
  "created_at",
] as const
// An IP address is personal data: on the list a year at most (adr/0044 §4)
const IP_DAYS = 365
const DAY_MS = 24 * 60 * 60 * 1000

/** GET /admin/fraud/blocks (adr/0044 §4): the shop's block list, as staff see it (masked). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { kind, limit, offset } = req.validatedQuery as AdminGetFraudBlocksType
  const [blocks, count] = await req.scope
    .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
    .listAndCountFraudBlocks(kind ? { kind } : {}, {
      select: [...FIELDS],
      order: { created_at: "DESC", id: "DESC" },
      skip: offset,
      take: limit,
    })
  res.json({ blocks, count, limit, offset })
}

/**
 * POST /admin/fraud/blocks: an e-mail, a domain, a phone or an IP address
 * stops registration, sign-in and checkout. An e-mail or a phone is kept
 * only as its keyed hash, shown masked.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostFraudBlockType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const entry = blockEntryOf(
    body.kind,
    body.value,
    parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")
  )
  if (!entry) {
    throw new ValidationError(`fraud.block_invalid_${body.kind}`, { field: "value" })
  }
  const latest = new Date(Date.now() + IP_DAYS * DAY_MS)
  const expiresAt =
    entry.kind === "ip" && (!body.expires_at || body.expires_at > latest)
      ? latest
      : (body.expires_at ?? null)
  const { result } = await addBlockWorkflow(req.scope).run({
    input: {
      ...entry,
      reason: body.reason ?? null,
      created_by: req.auth_context.actor_id || null,
      expires_at: expiresAt,
    },
  })
  res.status(201).json({ block: { id: result.id, kind: entry.kind, display: entry.display } })
}
