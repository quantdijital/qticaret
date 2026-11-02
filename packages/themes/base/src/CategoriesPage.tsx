import { ArrowUpRight } from "lucide-react"
import type { CategoriesPageView, CategoryTreeView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"

/** The categories below one, each a link, the deeper ones nested under theirs. */
function Branch({ items }: { items: CategoryTreeView[] }) {
  if (items.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-col border-l pl-4">
      {items.map((item) => (
        <li key={item.path} className="min-w-0">
          <a
            href={item.path}
            className="inline-flex min-h-10 items-center py-1 text-sm break-words text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {item.label}
          </a>
          <Branch items={item.children} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Every category (`/kategoriler`): a card per top category, its name a
 * heading and a link, the categories below it as a tree. All in the first
 * HTML, nothing folded.
 */
export function CategoriesPage({ view, t }: { view: CategoriesPageView; t: Translate }) {
  return (
    <PageContainer className="flex flex-col gap-8">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <h1 className="text-4xl leading-tight lg:text-5xl">{view.title}</h1>
      {view.categories.length === 0 ? (
        <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
          {t("categories.empty")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {view.categories.map((top) => (
            <li
              key={top.path}
              className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-5"
            >
              <h2 className="font-heading text-2xl leading-tight">
                <a
                  href={top.path}
                  className="group inline-flex min-h-10 items-center gap-2 break-words hover:underline hover:underline-offset-4"
                >
                  {top.label}
                  <ArrowUpRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </h2>
              <Branch items={top.children} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
