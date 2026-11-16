import type { HttpClient } from "./http"
import { totp } from "./totp"

/**
 * What the panel's setup page does (adr/0040 §2, §3): a TOTP factor started,
 * confirmed with its first code and the password, then the first recovery
 * codes, proved with that same code.
 */
export async function setUpTotp(
  http: HttpClient,
  admin: { plain: Record<string, string>; headers: Record<string, string> }
): Promise<{ factorId: string; secret: string; codes: string[]; code: string }> {
  const started = await http.post<{ mfa_factor: { id: string }; secret: string }>(
    "/auth/mfa/factors",
    { provider: "totp", label: "Panel" },
    { headers: admin.plain }
  )
  const code = totp(started.data.secret)
  await http.post(
    `/auth/mfa/factors/${started.data.mfa_factor.id}/verify`,
    { code },
    { headers: admin.headers }
  )
  const codes = await http.post<{ recovery_codes: string[] }>(
    "/auth/mfa/recovery-codes",
    {},
    { headers: { ...admin.plain, "x-reauth-method": "totp", "x-reauth-secret": code } }
  )
  return {
    factorId: started.data.mfa_factor.id,
    secret: started.data.secret,
    codes: codes.data.recovery_codes,
    // Given twice already (verify and step-up): never taken again (api/http/reauth.ts)
    code,
  }
}
