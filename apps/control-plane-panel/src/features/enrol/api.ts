import { useMutation } from "@tanstack/react-query"
import { api } from "@/lib/api"

/** A factor being set up: its secret, once, for the authenticator app. */
export interface StartedFactor {
  secret: string
  otpauth_url: string
}

/**
 * `POST /admin/cp/me/mfa` (adr/0061 Ek C4): a new TOTP factor, pending
 * until its first code; one left half-way is dropped by the API first.
 */
export function useStartFactor() {
  return useMutation({
    gcTime: 0,
    mutationFn: () => api<StartedFactor>("/admin/cp/me/mfa", { method: "POST", body: {} }),
  })
}

/**
 * `POST /admin/cp/me/mfa/verify`: the first code and the password (a
 * session alone must not put someone's app on the account); after an
 * owner's reset, the e-mailed link's token too. The first recovery codes
 * come back, this answer only.
 */
export function useConfirmFactor() {
  return useMutation({
    // Neither the password nor the codes stay in the mutation cache
    gcTime: 0,
    mutationFn: async (input: {
      code: string
      password: string
      enrolmentToken: string | null
    }): Promise<string[]> =>
      (
        await api<{ recovery_codes: string[] }>("/admin/cp/me/mfa/verify", {
          method: "POST",
          body: {
            code: input.code,
            password: input.password,
            ...(input.enrolmentToken ? { enrolment_token: input.enrolmentToken } : {}),
          },
        })
      ).recovery_codes,
  })
}
