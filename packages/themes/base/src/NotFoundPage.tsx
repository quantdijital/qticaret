import { SearchX } from "lucide-react"
import type { Translate } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"

/** A 404: says so, offers the way home; the status code is the storefront's. */
export function NotFoundPage({ t }: { t: Translate }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-7 text-muted-foreground" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{t("not_found.title")}</h1>
      <p className="text-muted-foreground">{t("not_found.body")}</p>
      <Button asChild size="lg" className="rounded-full px-7">
        <a href="/">{t("not_found.home")}</a>
      </Button>
    </div>
  )
}
