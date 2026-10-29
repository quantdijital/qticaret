import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { openApiDocument } from "../../../lib/api-access"
import { parseEnv } from "../../../lib/env"

/** GET /admin/openapi.json (F11.6): what an API key can reach, for the shop's integrators. */
export function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): void {
  const server = parseEnv().BACKEND_URL ?? `${req.protocol}://${req.get("host") ?? "localhost"}`
  res.json(openApiDocument(server))
}
