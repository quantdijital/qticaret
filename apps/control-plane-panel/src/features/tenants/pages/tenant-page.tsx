import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageGrid, PageColumn } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { PageTabs } from "@qticaret/admin-ui/patterns/page-tabs"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import type { PageTab } from "@qticaret/admin-ui/patterns/page-tabs"
import { useMe } from "@/features/auth/api"
import { SubscriptionTab } from "@/features/billing/components/subscription-tab"
import { UsageHealthTab } from "@/features/monitoring/components/usage-health-tab"
import { SetupTab } from "@/features/provisioning/components/setup-tab"
import { tenantQuery } from "@/features/tenants/api"
import type { TenantDetail } from "@/features/tenants/api"
import { ActivityCard } from "@/features/tenants/components/activity-card"
import { AttentionNote } from "@/features/tenants/components/attention-note"
import { CompanyCard } from "@/features/tenants/components/company-card"
import { ContactsCard } from "@/features/tenants/components/contacts-card"
import { DocumentCard } from "@/features/tenants/components/document-card"
import { DomainsCard } from "@/features/tenants/components/domains-card"
import { FlagsCard } from "@/features/tenants/components/flags-card"
import { NotesCard } from "@/features/tenants/components/notes-card"
import { PlanCard } from "@/features/tenants/components/plan-card"
import { SummaryCard } from "@/features/tenants/components/summary-card"
import { StatusActions } from "@/features/tenants/components/status-actions"
import { TenantStatusBadge } from "@/features/tenants/components/tenant-status"
import { canManageShops } from "@/features/tenants/permissions"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_app/tenants/$id")

/**
 * The shop's people, addresses, package, usage and health (Ek C13), setup
 * and history: one card a tab. The setup ("Kurulum", C11) is the owner's and the operator's (the
 * control plane answers no one else); it keeps one place, so the tabs do
 * not move when the shop turns `active` (the wizard opens it by `?part=`).
 */
function TenantTabs({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const setup: PageTab[] = canManageShops(me?.role)
    ? [{ key: "setup", label: t("setup.title"), content: <SetupTab shop={shop} /> }]
    : []
  return (
    <PageTabs
      label={t("tenants.detail.tabs")}
      tabs={[
        {
          key: "contacts",
          label: t("contacts.title"),
          count: shop.contacts.length,
          content: <ContactsCard shop={shop} />,
        },
        {
          key: "domains",
          label: t("domains.title"),
          count: shop.domains.length,
          content: <DomainsCard shop={shop} />,
        },
        {
          key: "plan",
          label: t("plan.title"),
          // Its limits, its platform flags and what its document last said (Ek C9)
          content: (
            <div className="flex flex-col gap-4">
              <PlanCard shop={shop} />
              <FlagsCard shop={shop} />
              {shop.plan_document ? <DocumentCard state={shop.plan_document} /> : null}
            </div>
          ),
        },
        // Ek C16: its subscription, charges and reminders, every role's (the actions by role)
        {
          key: "subscription",
          label: t("billing.tab"),
          content: <SubscriptionTab tenantId={shop.tenant.id} />,
        },
        // Ek C13: its usage against its limits and its health, every role's
        { key: "usage", label: t("usage.tab"), content: <UsageHealthTab shop={shop} /> },
        ...setup,
        {
          key: "notes",
          label: t("notes.title"),
          count: shop.notes.length,
          content: <NotesCard shop={shop} />,
        },
        {
          key: "activity",
          label: t("activity.title"),
          content: <ActivityCard id={shop.tenant.id} />,
        },
      ]}
    />
  )
}

/**
 * One shop (docs/06 "Detay sayfası düzeni"): its name and status on top,
 * what needs attention, the company on the left and the short facts on
 * the right, then its contacts, domains, package and limits, notes and
 * activity, one tab each (notes in a tab rather than the right column:
 * a long list there left the company card with an empty half). Every
 * role reads it (the read is recorded); the changes follow the role.
 */
export function TenantPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const query = useQuery(tenantQuery(id))
  const shop = query.data
  const back = { to: "/tenants", label: t("nav.shops") }
  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("tenants.detail.title")} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  if (!shop) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("common.loading")} back={back} />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }
  const primary = shop.domains.find((domain) => domain.is_primary)?.hostname ?? shop.tenant.slug
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={shop.tenant.name}
        badge={<TenantStatusBadge status={shop.tenant.status} />}
        action={<StatusActions tenantId={shop.tenant.id} status={shop.tenant.status} />}
        description={t("tenants.detail.line", {
          address: primary,
          date: formatDate(shop.tenant.created_at),
        })}
        back={back}
      />
      <AttentionNote shop={shop} />
      <PageGrid>
        <PageColumn span={8}>
          <CompanyCard shop={shop} />
        </PageColumn>
        <PageColumn span={4}>
          <SummaryCard shop={shop} />
        </PageColumn>
      </PageGrid>
      <TenantTabs shop={shop} />
    </div>
  )
}
