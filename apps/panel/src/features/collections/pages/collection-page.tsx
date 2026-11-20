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
import { collectionQuery, useDeleteCollection } from "@/features/collections/api/collections"
import { CollectionDescriptionCard } from "@/features/collections/components/collection-description-card"
import { CollectionGeneralCard } from "@/features/collections/components/collection-general-card"
import { CollectionImageCard } from "@/features/collections/components/collection-image-card"
import { CollectionProductsCard } from "@/features/collections/components/collection-products-card"
import { COLLECTION_PATH_PREFIX } from "@/features/collections/paths"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/collections/$id")

/**
 * A collection: its page's address, text, products and search appearance
 * in the main column; the SEO advisor and the picture beside them,
 * following the scroll (a long text leaves them in sight).
 */
export function CollectionPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const navigate = useNavigate()
  const collection = useQuery(collectionQuery(id))
  const remove = useDeleteCollection()
  const [deleting, setDeleting] = useState(false)

  if (collection.isError) {
    return (
      <ErrorState text={errorText(t, collection.error)} onRetry={() => void collection.refetch()} />
    )
  }
  if (!collection.data) {
    return <LoadingRows rows={6} />
  }
  const data = collection.data
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        back={{ to: "/collections", label: t("nav.collections") }}
        title={data.title}
        description={t("collections.productCount", {
          count: data.product_count,
          products: formatCount(data.product_count),
        })}
        badge={
          <StatusBadge tone={data.is_active ? "success" : "neutral"}>
            {t(data.is_active ? "collections.active" : "collections.inactive")}
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
                {t("collections.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <PageGrid>
        <PageColumn span={8}>
          <div id="collection-general" className="scroll-mt-20">
            <CollectionGeneralCard collection={data} />
          </div>
          <div id="collection-description" className="scroll-mt-20">
            <CollectionDescriptionCard key={data.id} collection={data} />
          </div>
          <CollectionProductsCard collection={data} />
          <div id="collection-seo" className="scroll-mt-20">
            <SeoCard
              type="collection"
              id={data.id}
              context={{
                path: `${COLLECTION_PATH_PREFIX}${data.handle}`,
                tokens: { kategori: data.title },
                fallbackDescription: excerpt(data.description, DESCRIPTION_EXCERPT),
              }}
            />
          </div>
        </PageColumn>
        <PageColumn span={4} sticky>
          <AdvisorCard
            kind="collection"
            id={data.id}
            version={data.updated_at}
            targets={{
              edit_title: "collection-seo",
              edit_description: "collection-seo",
              edit_robots: "collection-seo",
              edit_body: "collection-description",
              edit_handle: "collection-general",
            }}
          />
          <CollectionImageCard collection={data} />
        </PageColumn>
      </PageGrid>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("collections.deleteTitle", { name: data.title })}
        description={t("collections.deleteText")}
        confirmLabel={t("collections.delete")}
        destructive
        onConfirm={() => {
          setDeleting(false)
          remove.mutate(data.id, {
            onSuccess: () => {
              toast.success(t("collections.deleted"))
              void navigate({ to: "/collections" })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </div>
  )
}
