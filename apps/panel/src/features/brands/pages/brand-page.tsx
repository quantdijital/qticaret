import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { MoreHorizontal, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { brandQuery, useDeleteBrand } from "@/features/brands/api/brands"
import { BrandGeneralCard } from "@/features/brands/components/brand-general-card"
import { BrandLogoCard } from "@/features/brands/components/brand-logo-card"
import { useBrandPathPrefix } from "@/features/brands/use-brand-path"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/brands/$id")

/** A brand (F3.11): its page's text and address, its logo and its search appearance. */
export function BrandPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const navigate = useNavigate()
  const brand = useQuery(brandQuery(id))
  const remove = useDeleteBrand()
  const prefix = useBrandPathPrefix()
  const [deleting, setDeleting] = useState(false)

  if (brand.isError) {
    return <ErrorState text={errorText(t, brand.error)} onRetry={() => void brand.refetch()} />
  }
  if (!brand.data) {
    return <LoadingRows rows={6} />
  }
  const data = brand.data
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        back={{ to: "/brands", label: t("nav.brands") }}
        title={data.name}
        description={t("brands.productCount", {
          count: data.product_count,
          products: formatCount(data.product_count),
        })}
        badge={
          <StatusBadge tone={data.is_active ? "success" : "neutral"}>
            {t(data.is_active ? "brands.active" : "brands.inactive")}
          </StatusBadge>
        }
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("common.actions")}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setDeleting(true)
                }}
              >
                <Trash2 />
                {t("brands.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <PageGrid>
        <PageColumn span={8}>
          <div id="brand-general" className="scroll-mt-20">
            <BrandGeneralCard brand={data} />
          </div>
          <div id="brand-seo" className="scroll-mt-20">
            <SeoCard
              type="brand"
              id={data.id}
              context={{
                path: `${prefix}${data.handle}`,
                tokens: { marka: data.name },
                fallbackDescription: excerpt(data.description, DESCRIPTION_EXCERPT),
              }}
            />
          </div>
        </PageColumn>
        <PageColumn span={4}>
          <AdvisorCard
            kind="brand"
            id={data.id}
            version={data.updated_at}
            targets={{
              edit_title: "brand-seo",
              edit_description: "brand-seo",
              edit_robots: "brand-seo",
              edit_body: "brand-general",
              edit_handle: "brand-general",
              add_logo: "brand-logo",
            }}
          />
          <div id="brand-logo" className="scroll-mt-20">
            <BrandLogoCard brand={data} />
          </div>
        </PageColumn>
      </PageGrid>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("brands.deleteTitle", { name: data.name })}
        description={t("brands.deleteText")}
        confirmLabel={t("brands.delete")}
        destructive
        onConfirm={() => {
          setDeleting(false)
          remove.mutate(data.id, {
            onSuccess: () => {
              toast.success(t("brands.deleted"))
              void navigate({ to: "/brands" })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </div>
  )
}
