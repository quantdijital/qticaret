import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { MoreHorizontal, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { brandQuery, useDeleteBrand } from "@/features/brands/api/brands"
import { BrandGeneralCard } from "@/features/brands/components/brand-general-card"
import { BrandLogoCard } from "@/features/brands/components/brand-logo-card"
import { useBrandPathPrefix } from "@/features/brands/use-brand-path"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

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
      <div className="grid grid-cols-1 items-start gap-[var(--grid-gap)] xl:grid-cols-12">
        <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-8">
          <BrandGeneralCard brand={data} />
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
        <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-4">
          <BrandLogoCard brand={data} />
        </div>
      </div>
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
