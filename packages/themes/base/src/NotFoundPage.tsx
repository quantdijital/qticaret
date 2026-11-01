import type { Translate } from "@qticaret/ui"

/** A 404: says so, offers the way home; the status code is the storefront's. */
export function NotFoundPage({ t }: { t: Translate }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">{t("not_found.title")}</h1>
      <p className="text-muted-foreground">{t("not_found.body")}</p>
      <a
        href="/"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        {t("not_found.home")}
      </a>
    </div>
  )
}
