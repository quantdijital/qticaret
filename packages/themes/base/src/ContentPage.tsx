import type { ContentPageView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"

/** A content page or a blog post: the backend's sanitised HTML in a readable column. */
export function ContentPage({ view, t }: { view: ContentPageView; t: Translate }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <h1 className="text-3xl font-semibold">{view.title}</h1>
      <div
        className="content flex flex-col gap-4 leading-relaxed [&_a]:underline [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
        // adr/0019: built by the backend from an allow-listed document schema
        dangerouslySetInnerHTML={{ __html: view.html }}
      />
    </article>
  )
}
