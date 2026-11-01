import type { ContentPageView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"

/** A content page or a blog post: the backend's sanitised HTML in a readable column. */
export function ContentPage({ view, t }: { view: ContentPageView; t: Translate }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <h1 className="text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
        {view.title}
      </h1>
      <div
        className="flex flex-col gap-4 leading-relaxed text-foreground/90 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-1"
        // adr/0019: built by the backend from an allow-listed document schema
        dangerouslySetInnerHTML={{ __html: view.html }}
      />
    </article>
  )
}
