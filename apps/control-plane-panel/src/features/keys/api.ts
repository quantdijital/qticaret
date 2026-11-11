import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"

/** A signing key as the API shows it: never its private half. */
export interface SigningKey {
  kid: string
  public_key: string
  status: "next" | "active" | "previous" | "retired"
  created_at: string
  activated_at: string | null
  retired_at: string | null
}

export interface KekRow {
  /** The key's fingerprint, never the key. */
  kek_id: string
  state: "current" | "older" | "missing"
  records: { secret_record: number; tenant_company: number }
  total: number
}

export interface KekStatus {
  keks: KekRow[]
  pending: number
  stranded: number
  removable: string[]
}

export interface KeysOverview {
  signing_keys: SigningKey[]
  published: { keys: { kid: string; status: string }[]; env_value: string }
  keks: KekStatus
}

export const KEYS_KEY = ["keys"] as const

/** `GET /admin/cp/keys` (owner): key ids, public keys, fingerprints and counts. */
export const keysQuery = () =>
  queryOptions({
    queryKey: KEYS_KEY,
    queryFn: () => api<KeysOverview>("/admin/cp/keys"),
  })

/** A key change (owner, step-up): the overview read again afterwards, whatever came of it. */
function useKeyChange<O>(path: string) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: () => withStepUp((headers) => api<O>(path, { method: "POST", body: {}, headers })),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: KEYS_KEY })
    },
  })
}

export const useRewrap = () =>
  useKeyChange<{ rewrapped: number; failed: number; status: KekStatus }>("/admin/cp/keys/rewrap")

export const usePrepareSigningKey = () =>
  useKeyChange<{ signing_key: { kid: string; status: SigningKey["status"] } }>(
    "/admin/cp/keys/signing/prepare"
  )

export const useSwitchSigningKey = () =>
  useKeyChange<{ active: string; previous: string | null }>("/admin/cp/keys/signing/switch")

export const useRetireSigningKey = () =>
  useKeyChange<{ retired: string }>("/admin/cp/keys/signing/retire")
