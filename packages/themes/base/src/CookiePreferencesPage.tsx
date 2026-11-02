import type { CookiePreferencesPageView, Translate } from "@qticaret/ui"
import { PageContainer } from "./components/Container"
import { CookieForm } from "./layout/CookieForm"

/**
 * `/cerez-tercihleri` (D9): the banner's form on a page of its own, the
 * answer in force ticked. Where the footer's link leads without script.
 */
export function CookiePreferencesPage({
  view,
  t,
  save,
}: {
  view: CookiePreferencesPageView
  t: Translate
  save: (form: FormData) => Promise<void>
}) {
  return (
    <PageContainer>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
        <h1 className="text-3xl">{view.title}</h1>
        {view.notice && (
          <p role="status" className="rounded-xl border bg-card p-3 text-sm">
            {view.notice}
          </p>
        )}
        <div className="rounded-3xl border bg-card p-5 sm:p-6">
          <CookieForm
            banner={view.banner}
            save={save}
            t={t}
            headingId="cerez-tercihleri-baslik"
            onPage
          />
        </div>
      </div>
    </PageContainer>
  )
}
