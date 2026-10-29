import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { sdk } from "@/lib/sdk"

/** A factor being set up: its secret, once, for the authenticator app (F12.6, adr/0040 §2). */
export interface StartedFactor {
  id: string
  secret: string
  otpauthUrl: string
}

export interface MfaFactor {
  id: string
  provider: string
  status: string
}

export const factorsQuery = () =>
  queryOptions({
    queryKey: ["auth", "mfa", "factors"],
    queryFn: async () =>
      ((await sdk.auth.mfa.list()) as unknown as { mfa_factors: MfaFactor[] }).mfa_factors,
  })

/**
 * A TOTP factor started: named after the address, the panel's host as its
 * issuer. Medusa keeps one TOTP factor at a time, a pending one included: a
 * setup left half-way (the page closed before its first code) is dropped
 * first, so the page can always start again.
 */
export function useStartFactor() {
  return useMutation({
    mutationFn: async (label: string): Promise<StartedFactor> => {
      const { mfa_factors: factors } = (await sdk.auth.mfa.list()) as unknown as {
        mfa_factors: MfaFactor[]
      }
      for (const factor of factors.filter((each) => each.status === "pending")) {
        await sdk.auth.mfa.disable(factor.id)
      }
      const started = (await sdk.auth.mfa.start({
        provider: "totp",
        label,
        issuer: window.location.host,
      })) as unknown as { mfa_factor: { id: string }; secret: string; otpauth_url: string }
      return {
        id: started.mfa_factor.id,
        secret: started.secret,
        otpauthUrl: started.otpauth_url,
      }
    },
  })
}

/** The factor confirmed with the app's first code: it is on from here. */
export function useConfirmFactor() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; code: string }) => {
      await sdk.auth.mfa.verify(input.id, { code: input.code })
    },
    onSuccess: () => client.invalidateQueries({ queryKey: STAFF_KEY }),
  })
}

/** New recovery codes, shown once; the earlier ones stop working. */
export function useRecoveryCodes() {
  return useMutation({
    mutationFn: async (): Promise<string[]> =>
      (await sdk.auth.mfa.generateRecoveryCodes({})).recovery_codes,
  })
}

/** The factor turned off with its current code, to set a new phone up. */
export function useDisableFactor() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; code: string }) => {
      await sdk.auth.mfa.disable(input.id, { method: "totp", code: input.code })
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["auth"] }),
  })
}
