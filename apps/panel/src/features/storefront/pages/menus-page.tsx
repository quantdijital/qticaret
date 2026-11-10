import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { ListTree, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { menusQuery } from "@/features/storefront/api/menus"
import { MenuEditor } from "@/features/storefront/components/menu-editor"
import { MenuListCard } from "@/features/storefront/components/menu-list-card"
import { NewMenuDialog } from "@/features/storefront/components/new-menu-dialog"
import { errorText } from "@/lib/errors"

const M = "storefront.menus"
const route = getRouteApi("/_auth/storefront/menus")

/**
 * Storefront > Menus (adr/0049): the menus by where they show on the left,
 * the chosen one's links on the right, as Shopify's navigation. The choice
 * lives in the URL, so a link opens it; with none, the first menu opens.
 */
export function MenusPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { menu: selected } = route.useSearch()
  const query = useQuery(menusQuery())
  const [adding, setAdding] = useState(false)
  const menus = query.data ?? []
  const current = menus.find((menu) => menu.id === selected) ?? menus[0] ?? null
  const select = (id: string | undefined, ignoreBlocker = false) => {
    void navigate({
      to: "/storefront/menus",
      search: id ? { menu: id } : {},
      replace: true,
      ignoreBlocker,
    })
  }
  const add = (
    <Button
      onClick={() => {
        setAdding(true)
      }}
    >
      <Plus />
      {t(`${M}.add`)}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.menus")} description={t(`${M}.description`)} action={add} />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
          <Skeleton className="h-96 rounded-lg xl:col-span-4" />
          <Skeleton className="h-96 rounded-lg xl:col-span-8" />
        </div>
      ) : (
        <PageGrid>
          <PageColumn span={4}>
            <MenuListCard
              menus={menus}
              selectedId={current?.id ?? null}
              onSelect={(id) => {
                select(id)
              }}
            />
          </PageColumn>
          <PageColumn span={8}>
            {current ? (
              <MenuEditor
                key={current.id}
                menu={current}
                onDeleted={() => {
                  // The menu is gone: its changes with it, nothing to ask about
                  select(undefined, true)
                }}
              />
            ) : (
              <SectionCard title={t(`${M}.emptyTitle`)}>
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                  <ListTree className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="max-w-md text-sm text-muted-foreground">{t(`${M}.empty`)}</p>
                  {add}
                </div>
              </SectionCard>
            )}
          </PageColumn>
        </PageGrid>
      )}
      {adding ? (
        <NewMenuDialog
          menus={menus}
          onClose={() => {
            setAdding(false)
          }}
          onCreated={(id) => {
            setAdding(false)
            select(id)
          }}
        />
      ) : null}
    </div>
  )
}
