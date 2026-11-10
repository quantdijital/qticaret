import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

/** The member a `:id` route names: a user who exists, else 404. */
export async function memberParam(req: AuthenticatedMedusaRequest): Promise<string> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id }, { select: ["id"], take: 1 })
  if (!user) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.member_unknown")
  }
  return user.id
}
