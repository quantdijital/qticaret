import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { FolderTree, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import { CategoryTable } from "@/features/categories/components/category-table"
import { NewCategoryDialog } from "@/features/categories/components/new-category-dialog"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/categories/")

/**
 * Categories (docs/06 §4), laid out as brands are: the tree as a list, a
 * search over it, and each category on its own page. `?selected=new` (the
 * command menu's "add a category") opens the new category's dialog.
 */
export function CategoriesPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const q = search.q ?? ""
  const tree = useQuery(categoryTreeQuery())
  const [adding, setAdding] = useState(false)
  const setQuery = (text: string) => {
    void navigate({
      to: "/categories",
      search: text === "" ? {} : { q: text },
      replace: true,
    })
  }
  const add = (
    <Button
      onClick={() => {
        setAdding(true)
      }}
    >
      <Plus />
      {t("categories.add")}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.categories")}
        description={t("categories.description")}
        action={add}
      />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <SearchInput value={q} placeholder={t("categories.search")} onChange={setQuery} />
        </div>
        {tree.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, tree.error)} onRetry={() => void tree.refetch()} />
          </div>
        ) : (
          <CategoryTable
            categories={tree.data}
            loading={tree.isPending}
            query={q}
            empty={
              <div className="flex flex-col items-center gap-3 text-center">
                <FolderTree className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="max-w-sm text-sm text-muted-foreground">
                  {q ? t("categories.noMatch") : t("categories.empty")}
                </p>
                {q ? null : add}
              </div>
            }
          />
        )}
      </section>
      <NewCategoryDialog
        open={adding || search.selected === "new"}
        onOpenChange={(open) => {
          setAdding(open)
          if (!open && search.selected) {
            void navigate({ to: "/categories", search: q ? { q } : {}, replace: true })
          }
        }}
      />
    </div>
  )
}
