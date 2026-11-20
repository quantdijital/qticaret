import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { EmptyState, ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import { CategoryEditor } from "@/features/categories/components/category-editor"
import { CategoryImageCard } from "@/features/categories/components/category-image-card"
import { CategoryRestrictionCard } from "@/features/categories/components/category-restriction-card"
import { CategorySeoCard } from "@/features/categories/components/category-seo-card"
import { ancestorNames } from "@/features/categories/tree"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/categories/$id")

/**
 * A category (brands' layout): its name, address, place in the tree and
 * visibility, its picture and search appearance in the main column; the
 * SEO advisor and the age limit beside them. Each card saves on its own.
 */
export function CategoryPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const navigate = useNavigate()
  const tree = useQuery(categoryTreeQuery())
  const back = { to: "/categories", label: t("nav.categories") }

  if (tree.isError) {
    return <ErrorState text={errorText(t, tree.error)} onRetry={() => void tree.refetch()} />
  }
  if (!tree.data) {
    return <LoadingRows rows={6} />
  }
  const categories = tree.data
  const category = categories.find((item) => item.id === id)
  if (!category) {
    return (
      <div className="flex flex-col gap-[var(--grid-gap)]">
        <PageHeader back={back} title={t("nav.categories")} />
        <EmptyState text={t("categories.notFound")} />
      </div>
    )
  }
  const parents = ancestorNames(categories, category)
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        back={back}
        title={category.name}
        description={parents.length > 0 ? parents.join(" › ") : t("categories.topLevel")}
        badge={
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={category.is_active ? "success" : "neutral"}>
              {t(category.is_active ? "categories.active" : "categories.inactive")}
            </StatusBadge>
            {category.is_internal ? (
              <StatusBadge tone="neutral">{t("categories.internal")}</StatusBadge>
            ) : null}
          </span>
        }
      />
      <PageGrid>
        <PageColumn span={8}>
          <div id="category-general" className="scroll-mt-20">
            <CategoryEditor
              key={category.id}
              categories={categories}
              category={category}
              onDeleted={() => {
                void navigate({ to: "/categories" })
              }}
            />
          </div>
          <div id="category-image" className="scroll-mt-20">
            <CategoryImageCard categoryId={category.id} />
          </div>
          <div id="category-seo" className="scroll-mt-20">
            <CategorySeoCard key={category.id} category={category} categories={categories} />
          </div>
        </PageColumn>
        <PageColumn span={4}>
          <AdvisorCard
            key={category.id}
            kind="category"
            id={category.id}
            version={category.updated_at}
            targets={{
              edit_title: "category-seo",
              edit_description: "category-seo",
              edit_robots: "category-seo",
              edit_body: "category-general",
              edit_handle: "category-general",
              add_image: "category-image",
            }}
          />
          <CategoryRestrictionCard categoryId={category.id} />
        </PageColumn>
      </PageGrid>
    </div>
  )
}
