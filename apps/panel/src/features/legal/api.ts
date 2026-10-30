import type { JSONContent } from "@tiptap/react"
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The shop's legal texts (F13.1, adr/0041 §1), in the order the panel lists them. */
export const LEGAL_KINDS = [
  "distance_sales",
  "pre_information",
  "return_policy",
  "shipping_policy",
  "cookie_policy",
  "privacy_notice",
  "membership",
] as const
export type LegalKind = (typeof LEGAL_KINDS)[number]

export const isLegalKind = (value: string): value is LegalKind =>
  (LEGAL_KINDS as readonly string[]).includes(value)

/** The contracts made with an order: they take an order's tokens too. */
export const ORDER_KINDS: ReadonlySet<LegalKind> = new Set(["distance_sales", "pre_information"])

export interface LegalVersion {
  id: string
  version: number
  title: string
  updated_at: string
  published_at: string | null
}

export interface LegalOverviewRow {
  kind: LegalKind
  published: LegalVersion | null
  draft: LegalVersion | null
}

export interface LegalDetail {
  kind: LegalKind
  published: (LegalVersion & { body: JSONContent }) | null
  draft: (LegalVersion & { body: JSONContent }) | null
  history: (LegalVersion & { status: "published" | "retired"; published_by: string | null })[]
}

const KEY = ["legal"] as const
const pathOf = (kind: LegalKind) => `/admin/legal-documents/${encodeURIComponent(kind)}`

export const legalOverviewQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: async () =>
      (await sdk.client.fetch<{ documents: LegalOverviewRow[] }>("/admin/legal-documents"))
        .documents,
  })

export const legalKindQuery = (kind: LegalKind) =>
  queryOptions({
    queryKey: [...KEY, kind],
    queryFn: async () => (await sdk.client.fetch<{ document: LegalDetail }>(pathOf(kind))).document,
  })

export const legalStarterQuery = (kind: LegalKind) =>
  queryOptions({
    queryKey: [...KEY, kind, "starter"],
    queryFn: () =>
      sdk.client.fetch<{ starter: { title: string; body: JSONContent }; tokens: string[] }>(
        `${pathOf(kind)}/starter`
      ),
    staleTime: Infinity,
  })

function useLegalMutation<T>(kind: LegalKind, run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

export const useSaveLegalDraft = (kind: LegalKind) =>
  useLegalMutation(kind, (body: { title: string; body: JSONContent }) =>
    sdk.client.fetch(`${pathOf(kind)}/draft`, { method: "POST", body })
  )

export const usePublishLegal = (kind: LegalKind) =>
  useLegalMutation(kind, () =>
    sdk.client.fetch(`${pathOf(kind)}/publish`, { method: "POST", body: {} })
  )

export const useDiscardLegalDraft = (kind: LegalKind) =>
  useLegalMutation(kind, () => sdk.client.fetch(`${pathOf(kind)}/draft`, { method: "DELETE" }))

/** The text as customers will read it; nothing is saved. */
export const usePreviewLegal = (kind: LegalKind) =>
  useMutation({
    mutationFn: async (body: JSONContent) =>
      (
        await sdk.client.fetch<{ html: string }>(`${pathOf(kind)}/preview`, {
          method: "POST",
          body: { body },
        })
      ).html,
  })
