import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import type { StaffRole } from "../../src/lib/staff"
import { STAFF_ROLES_MODULE } from "../../src/modules/staff-roles"
import type StaffRolesModuleService from "../../src/modules/staff-roles/service"
import type { HttpClient } from "./http"

interface TokenResponse {
  token: string
}

function authIdentityIdOf(token: string): string {
  const payload: unknown = JSON.parse(
    Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
  )
  const id = (payload as { auth_identity_id?: unknown }).auth_identity_id
  if (typeof id !== "string") {
    throw new Error("registration token carries no auth identity")
  }
  return id
}

/**
 * Registers a staff member through the auth API and returns bearer headers.
 * The shop's owner unless another role is asked for (adr/0040).
 */
export async function createAdminUser(
  http: HttpClient,
  container: MedusaContainer,
  role: StaffRole = "owner"
): Promise<{ headers: Record<string, string>; userId: string }> {
  const email = `admin-${randomUUID()}@example.com`
  // Throwaway credential for this test database only
  const password = randomUUID()

  const registration = await http.post<TokenResponse>("/auth/user/emailpass/register", {
    email,
    password,
  })
  const { result: user } = await createUserAccountWorkflow(container).run({
    input: { authIdentityId: authIdentityIdOf(registration.data.token), userData: { email } },
  })
  await container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).setRole(user.id, role, null)
  const login = await http.post<TokenResponse>("/auth/user/emailpass", { email, password })
  return { headers: { authorization: `Bearer ${login.data.token}` }, userId: user.id }
}
