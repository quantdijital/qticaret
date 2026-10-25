import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { SEO_ENTITIES, SEO_FIELDS, isSeoEntityType } from "../../../../../workflows/seo/entities"
import type { SeoEntityType } from "../../../../../workflows/seo/entities"
import { upsertSeoMetaWorkflow } from "../../../../../workflows/seo/upsert-seo-meta"
import type { AdminPutSeoMetaType } from "./validators"

function target(req: AuthenticatedMedusaRequest): { type: SeoEntityType; id: string } {
  const type = req.params["entity_type"] ?? ""
  if (!isSeoEntityType(type)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.entity_type_unknown")
  }
  return { type, id: req.params["entity_id"] ?? "" }
}

/** The page's own SEO fields, or null fields when it has none (the templates apply). */
async function readSeo(req: AuthenticatedMedusaRequest, type: SeoEntityType, id: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: SEO_ENTITIES[type].entity,
    fields: ["id", ...SEO_FIELDS.map((field) => `seo_meta.${field}`)],
    filters: { id },
  })
  const row = data[0] as { seo_meta?: Record<string, string | null> | null } | undefined
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.entity_unknown")
  }
  return Object.fromEntries(SEO_FIELDS.map((field) => [field, row.seo_meta?.[field] ?? null]))
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { type, id } = target(req)
  res.json({ seo: await readSeo(req, type, id) })
}

/** Saves the fields sent (adr/0015); duplicate titles or descriptions come back as a warning. */
export async function PUT(
  req: AuthenticatedMedusaRequest<AdminPutSeoMetaType>,
  res: MedusaResponse
): Promise<void> {
  const { type, id } = target(req)
  const { result } = await upsertSeoMetaWorkflow(req.scope).run({
    input: { entity_type: type, entity_id: id, values: req.validatedBody },
  })
  res.json({ seo: await readSeo(req, type, id), duplicates: result.duplicates })
}
