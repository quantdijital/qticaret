import type { LegalPageView, Translate } from "@qticaret/ui"
import { ContentPage } from "./ContentPage"

/** A legal text in this theme's reading column, as its content pages show text. */
export function LegalPage({ view, t }: { view: LegalPageView; t: Translate }) {
  return (
    <ContentPage
      t={t}
      view={{
        title: view.title,
        breadcrumbs: view.breadcrumbs,
        html: view.html,
        publishedAt: view.updated?.dateTime ?? null,
      }}
    />
  )
}
