import type { BlogIndexPageView, BlogTermLinkView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"
import { Pages } from "./components/Pages"
import { PostCard } from "./components/PostCard"

/** The blog's categories as a row of links, the page shown marked; scrolls sideways on phones. */
function TermBar({ terms, t }: { terms: BlogTermLinkView[]; t: Translate }) {
  return (
    <nav aria-label={t("blog.categories")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 pb-1">
        {terms.map((term) => (
          <li key={term.path}>
            <a
              href={term.path}
              aria-current={term.current ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-button border bg-card px-5 text-sm font-medium whitespace-nowrap transition-colors hover:border-foreground",
                term.current && "border-foreground bg-foreground text-background"
              )}
            >
              {term.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * The blog's posts, newest first, or one category's or tag's (an
 * archive): the categories as a bar above, a card per post, one link to it.
 */
export function BlogIndexPage({ view, t }: { view: BlogIndexPageView; t: Translate }) {
  const terms = view.terms ?? []
  const archive = view.activeTerm ?? null
  // An author's page (adr/0060): their title and bio under the name
  const author = view.activeAuthor ?? null
  return (
    <PageContainer className="flex flex-col gap-8">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <header className="flex flex-col gap-3">
        {archive && (
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t(archive.kind === "tag" ? "blog.tag" : "blog.category")}
          </p>
        )}
        <h1 className="text-4xl leading-tight break-words lg:text-5xl">{view.title}</h1>
        {author?.jobTitle && <p className="text-lg text-muted-foreground">{author.jobTitle}</p>}
        {(author?.bio ?? archive?.description ?? []).map((paragraph, index) => (
          <p key={String(index)} className="max-w-3xl text-lg text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </header>
      {terms.length > 0 && <TermBar terms={terms} t={t} />}
      {view.posts.length === 0 ? (
        <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
          {t(author ? "blog.author_empty" : archive ? "blog.archive_empty" : "blog.empty")}
        </p>
      ) : (
        <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {view.posts.map((post, index) => (
            <li key={post.path}>
              <PostCard post={post} priority={index < 3 && view.pagination.page === 1} />
            </li>
          ))}
        </ul>
      )}
      <Pages pagination={view.pagination} t={t} />
    </PageContainer>
  )
}
