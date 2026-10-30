import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ConflictError, ValidationError } from "../../../../../lib/errors"
import { readClaimToken } from "../../../../../lib/migration/claim"
import { MIGRATION_MODULE } from "../../../../../modules/migration"
import type MigrationModuleService from "../../../../../modules/migration/service"
import { adoptMigratedWorkflow } from "../../../../../workflows/migration/adopt"
import { loginEmailOf } from "../../../../http/account-routes"
import type { StorePostMigrationClaimType } from "./validators"

/**
 * `POST /store/customers/me/migration-claim` (F14.5): the signed-in
 * account takes its moved record from the old platform with the key its
 * invitation carried. The key opens one record; that record's address
 * must be the account's own login, and it is taken once.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostMigrationClaimType>,
  res: MedusaResponse
): Promise<void> {
  const movedId = readClaimToken(req.validatedBody.token)
  if (!movedId) {
    throw new ValidationError("migration.claim_invalid", { field: "token" })
  }
  const identity = await req.scope
    .resolve(Modules.AUTH)
    .retrieveAuthIdentity(req.auth_context.auth_identity_id, {
      relations: ["provider_identities"],
    })
  const login = loginEmailOf(identity.provider_identities ?? [])
  const [moved] = await req.scope
    .resolve<ICustomerModuleService>(Modules.CUSTOMER)
    .listCustomers({ id: movedId, has_account: false }, { take: 1, select: ["id", "email"] })
  if (!moved?.email || !login || moved.email.trim().toLowerCase() !== login) {
    throw new ValidationError("migration.claim_not_yours", { field: "token" })
  }
  const [item] = await req.scope
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .listMigrationItems(
      { kind: "customer", status: "done", target_id: movedId },
      { take: 1, select: ["id", "adopted_at"] }
    )
  if (!item) {
    throw new ValidationError("migration.claim_invalid", { field: "token" })
  }
  if (item.adopted_at) {
    throw new ConflictError("migration.claim_used")
  }
  const { result } = await adoptMigratedWorkflow(req.scope).run({
    input: { customer_id: req.auth_context.actor_id, moved_id: movedId },
  })
  res.json({ claimed: result ?? { orders: 0, reviews: 0, addresses: 0 } })
}
