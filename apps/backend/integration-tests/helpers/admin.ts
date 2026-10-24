import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
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

/** Registers an admin user through the auth API and returns bearer headers. */
export async function createAdminUser(
  http: HttpClient,
  container: MedusaContainer
): Promise<{ headers: Record<string, string> }> {
  const email = `admin-${randomUUID()}@example.com`
  // Throwaway credential for this test database only
  const password = randomUUID()

  const registration = await http.post<TokenResponse>("/auth/user/emailpass/register", {
    email,
    password,
  })
  await createUserAccountWorkflow(container).run({
    input: { authIdentityId: authIdentityIdOf(registration.data.token), userData: { email } },
  })
  const login = await http.post<TokenResponse>("/auth/user/emailpass", { email, password })
  return { headers: { authorization: `Bearer ${login.data.token}` } }
}
