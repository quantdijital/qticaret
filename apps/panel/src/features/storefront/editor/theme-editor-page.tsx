import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { layoutQuery } from "@/features/storefront/api/layout"
import { errorText } from "@/lib/errors"
import { ThemeEditor } from "./theme-editor"

const E = "storefront.editor"

/** Storefront > Theme editor: the shop's design, read once, then held by the editor. */
export function ThemeEditorPage() {
  const { t } = useTranslation()
  const query = useQuery(layoutQuery())
  if (query.data) {
    return <ThemeEditor layout={query.data} />
  }
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/storefront/menus">
            <ArrowLeft />
            {t(`${E}.exit`)}
          </Link>
        </Button>
        <h1 className="text-sm font-semibold">{t(`${E}.title`)}</h1>
      </header>
      <main className="flex flex-1 flex-col lg:flex-row">
        {query.isError ? (
          <div className="p-6">
            <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <>
            <div
              aria-busy="true"
              aria-label={t("common.loading")}
              className="flex flex-col gap-2 border-b bg-card p-3 lg:w-[340px] lg:border-r lg:border-b-0"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
            <div className="flex-1 bg-muted p-4">
              <Skeleton className="h-full min-h-96 w-full rounded-md" />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
