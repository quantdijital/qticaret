import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { LimitKey } from "@qticaret/types/control-plane"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"
import { TENANTS_KEY, tenantKey, tenantPath } from "./api"
import type { CompanyKind, ContactRole } from "./api"

/** A change to one shop: its page and the list are read again once it settles. */
function useShopChange<I, O>(id: string, call: (input: I) => Promise<O>) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: call,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: tenantKey(id) })
      await client.invalidateQueries({ queryKey: [...TENANTS_KEY, "list"] })
    },
  })
}

const post = <O = unknown>(path: string, body: unknown, headers?: Record<string, string>) =>
  api<O>(path, { method: "POST", body, ...(headers ? { headers } : {}) })

export interface NewTenant {
  name: string
  slug: string
  package_id: string | null
}

/**
 * A new shop as a record (owner, operator): `provisioning`, set up later
 * (C10, C11). A step-up: the record may name its package, what it pays.
 */
export function useCreateTenant() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTenant) =>
      withStepUp((headers) =>
        post<{ tenant: { id: string; slug: string } }>("/admin/cp/tenants", input, headers)
      ),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: TENANTS_KEY })
    },
  })
}

export const useRenameTenant = (id: string) =>
  useShopChange(id, (name: string) => post(tenantPath(id), { name }))

export interface CompanyInput {
  kind: CompanyKind
  legal_name: string
  tax_office: string
  tax_number: string
  /** Absent: unchanged; blank: removed. Sent for a sole proprietor only. */
  tckn?: string
  address_line: string
  district: string
  city: string
  postal_code: string
}

export const useSaveCompany = (id: string) =>
  useShopChange(id, (input: CompanyInput) => post(tenantPath(id, "/company"), input))

/** A sole proprietor's TCKN in the clear, once (step-up; recorded before it is shown). */
export const revealTckn = (id: string) =>
  withStepUp((headers) => post<{ tckn: string }>(tenantPath(id, "/reveal-tckn"), {}, headers))

export interface ContactInput {
  name: string
  role: ContactRole
  email: string
  phone: string
  is_primary_billing: boolean
}

export const useSaveContact = (id: string) =>
  useShopChange(id, ({ contactId, ...input }: ContactInput & { contactId: string | null }) =>
    post(
      tenantPath(id, contactId ? `/contacts/${encodeURIComponent(contactId)}` : "/contacts"),
      input
    )
  )

export const useRemoveContact = (id: string) =>
  useShopChange(id, (contactId: string) =>
    api(tenantPath(id, `/contacts/${encodeURIComponent(contactId)}`), { method: "DELETE" })
  )

export const useAddDomain = (id: string) =>
  useShopChange(id, (hostname: string) => post(tenantPath(id, "/domains"), { hostname }))

export const useRemoveDomain = (id: string) =>
  useShopChange(id, (domainId: string) =>
    api(tenantPath(id, `/domains/${encodeURIComponent(domainId)}`), { method: "DELETE" })
  )

export const usePrimaryDomain = (id: string) =>
  useShopChange(id, (domainId: string) =>
    post(tenantPath(id, `/domains/${encodeURIComponent(domainId)}/primary`), {})
  )

export const useSaveNote = (id: string) =>
  useShopChange(
    id,
    ({ noteId, ...input }: { noteId: string | null; body?: string; pinned?: boolean }) =>
      post(tenantPath(id, noteId ? `/notes/${encodeURIComponent(noteId)}` : "/notes"), input)
  )

export const useRemoveNote = (id: string) =>
  useShopChange(id, (noteId: string) =>
    api(tenantPath(id, `/notes/${encodeURIComponent(noteId)}`), { method: "DELETE" })
  )

/** The shop's package: what it pays, so a step-up as a price change. */
export const useAssignPlan = (id: string) =>
  useShopChange(id, (packageId: string | null) =>
    withStepUp((headers) => post(tenantPath(id, "/plan"), { package_id: packageId }, headers))
  )

export interface OverrideInput {
  key: LimitKey
  value: number | null
  reason: string
  expires_at: string | null
}

export const useSetOverride = (id: string) =>
  useShopChange(id, (input: OverrideInput) => post(tenantPath(id, "/overrides"), input))

export const useRemoveOverride = (id: string) =>
  useShopChange(id, (key: LimitKey) =>
    api(tenantPath(id, `/overrides/${encodeURIComponent(key)}`), { method: "DELETE" })
  )

export interface FeatureOverrideInput {
  key: string
  enabled: boolean
  reason: string
  expires_at: string | null
}

/** A shop's own value for a platform flag (Ek C9), beside the limits' exceptions. */
export const useSetFeatureOverride = (id: string) =>
  useShopChange(id, (input: FeatureOverrideInput) =>
    post(tenantPath(id, "/feature-overrides"), input)
  )

export const useRemoveFeatureOverride = (id: string) =>
  useShopChange(id, (key: string) =>
    api(tenantPath(id, `/feature-overrides/${encodeURIComponent(key)}`), { method: "DELETE" })
  )
