import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { layoutQuery } from "@/features/storefront/api/layout"
import { errorText } from "@/lib/errors"
import { HintProvider } from "./shared/hint"
import { ThemeEditor } from "./theme-editor"
import { useDocumentTitle } from "@qticaret/admin-ui/hooks/use-document-title"

const E = "storefront.editor"

/** Storefront > Theme editor: the shop's design, read once, then held by the editor. */
export function ThemeEditorPage({
  open = null,
  content = null,
}: {
  open?: "preferences" | null
  /** The content page the address names (`?icerik=`, adr/0073 §5). */
  content?: string | null
}) {
  const { t } = useTranslation()
  useDocumentTitle(t(`${E}.title`))
  const query = useQuery(layoutQuery())
  if (query.data) {
    // One tooltip clock for the whole editor: the next hint along opens at once
    return (
      <HintProvider>
        <ThemeEditor layout={query.data} openAtFirst={open} content={content} />
      </HintProvider>
    )
  }
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 lg:gap-3 lg:px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/storefront/menus">
            <ArrowLeft />
            {t(`${E}.exit`)}
          </Link>
        </Button>
        <h1 className="text-sm font-semibold">{t(`${E}.title`)}</h1>
      </header>
      <main className="flex min-h-0 flex-1">
        {query.isError ? (
          <div className="p-6">
            <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <>
            {/* The page's parts as the editor will draw them; the preview's room beside */}
            <div
              aria-busy="true"
              className="flex w-full flex-col gap-2 bg-card px-3 py-4 lg:w-[clamp(22rem,36vw,26rem)] lg:border-r xl:w-[clamp(17rem,20vw,20rem)]"
            >
              <span className="sr-only">{t("common.loading")}</span>
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
            <div className="hidden flex-1 flex-col bg-muted lg:flex">
              <div className="h-12 shrink-0 border-b bg-card" />
              <div className="flex-1 p-4">
                <Skeleton className="h-full w-full rounded-md" />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
