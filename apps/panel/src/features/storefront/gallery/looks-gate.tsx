import { useQuery } from "@tanstack/react-query"
import { LayoutTemplate } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { staffQuery } from "@/features/auth/api/staff"
import type { Capability } from "@/features/auth/api/staff"

const G = "storefront.gallery"

/**
 * Vitrin › Görünümler opens to the owner alone (the owner, 2026-11-23;
 * adr/0064): another role reached by its address is told so in one
 * sentence, and the gallery's queries are never sent. The API refuses
 * them anyway.
 */
export function LooksGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const staff = useQuery(staffQuery())
  if (staff.isPending) {
    return <LoadingRows rows={6} />
  }
  // An answer without `can` (an older backend, a stand-in) offers nothing rather than failing
  const can = staff.data?.can as Partial<Record<Capability, boolean>> | undefined
  if (can?.looks) {
    return children
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${G}.title`)} />
      <section className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center shadow-card">
        <LayoutTemplate className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-md text-sm text-muted-foreground">{t(`${G}.noAccess`)}</p>
      </section>
    </div>
  )
}
