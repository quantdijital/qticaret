import type { ContentPageView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"

/** A content page or a blog post: the backend's sanitised HTML in a readable column. */
export function ContentPage({ view, t }: { view: ContentPageView; t: Translate }) {
  return (
    <PageContainer>
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-5 border-b pb-8">
          <Breadcrumbs items={view.breadcrumbs} t={t} />
          <h1 className="text-4xl leading-[1.08] text-balance lg:text-5xl">{view.title}</h1>
        </header>
        <div
          className="flex flex-col gap-4 text-[17px] leading-[1.75] text-foreground/90 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:font-heading [&_blockquote]:text-xl [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-3xl [&_h2]:leading-tight [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold [&_li]:ml-5 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_strong]:font-semibold [&_strong]:text-foreground [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-1.5"
          // adr/0019: built by the backend from an allow-listed document schema
          dangerouslySetInnerHTML={{ __html: view.html }}
        />
      </article>
    </PageContainer>
  )
}
