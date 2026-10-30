import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { FolderPlus, MousePointerClick } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import { CategoryEditor } from "@/features/categories/components/category-editor"
import { CategoryRestrictionCard } from "@/features/categories/components/category-restriction-card"
import { CategorySeoCard } from "@/features/categories/components/category-seo-card"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { CategoryTreeCard } from "@/features/categories/components/category-tree-card"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/categories")

/**
 * Categories (docs/06 §4): the tree on the left, the chosen one (or a new
 * one) on the right. The choice lives in the URL, so a link opens it.
 */
export function CategoriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selected } = route.useSearch()
  const tree = useQuery(categoryTreeQuery())
  const categories = tree.data ?? []
  const current = categories.find((category) => category.id === selected) ?? null
  const select = (id: string | undefined) => {
    void navigate({ to: "/categories", search: id ? { selected: id } : {}, replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.categories")}
        description={t("categories.description")}
        action={
          <Button
            onClick={() => {
              select("new")
            }}
          >
            <FolderPlus />
            {t("categories.add")}
          </Button>
        }
      />
      {tree.isError ? (
        <ErrorState text={errorText(t, tree.error)} onRetry={() => void tree.refetch()} />
      ) : tree.isPending ? (
        <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
          <Skeleton className="h-96 rounded-lg xl:col-span-5" />
          <Skeleton className="h-96 rounded-lg xl:col-span-7" />
        </div>
      ) : (
        <PageGrid>
          <PageColumn span={5}>
            <CategoryTreeCard
              categories={categories}
              selectedId={current?.id ?? null}
              onSelect={select}
            />
          </PageColumn>
          <PageColumn span={7}>
            {selected === "new" || current ? (
              <>
                <CategoryEditor
                  key={current?.id ?? "new"}
                  categories={categories}
                  category={current}
                  onSaved={select}
                  onDeleted={() => {
                    select(undefined)
                  }}
                />
                {current ? (
                  <>
                    <AdvisorCard
                      key={`advisor-${current.id}`}
                      kind="category"
                      id={current.id}
                      version={current.updated_at}
                      targets={{
                        edit_title: "category-seo",
                        edit_description: "category-seo",
                        edit_robots: "category-seo",
                      }}
                    />
                    <div id="category-seo" className="scroll-mt-20">
                      <CategorySeoCard
                        key={`seo-${current.id}`}
                        category={current}
                        categories={categories}
                      />
                    </div>
                    <CategoryRestrictionCard categoryId={current.id} />
                  </>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
                <MousePointerClick className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="max-w-sm text-sm text-muted-foreground">{t("categories.pick")}</p>
              </div>
            )}
          </PageColumn>
        </PageGrid>
      )}
    </div>
  )
}
