import { ResponsiveImage } from "@qticaret/ui"
import type { BlogIndexPageView, BlogTermLinkView, PostCardView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Trail } from "../parts/Trail"
import { Pager } from "../listing/Pager"
import { PostCard, PostFacts } from "./PostCard"

/** The blog's categories as pills (blog terms, not the shop's product aisles), the page shown dark. */
function Terms({ terms, t }: { terms: readonly BlogTermLinkView[]; t: Translate }) {
  return (
    <nav aria-label={t("blog.categories")} className="min-w-0">
      <ul className="gf-rail -mx-(--gutter) flex scroll-px-(--gutter) gap-2 overflow-x-auto px-(--gutter) py-1 lg:scroll-px-0 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        {terms.map((term) => (
          <li key={term.path} className="shrink-0">
            <a
              href={term.path}
              aria-current={term.current ? "page" : undefined}
              className="gf-chip"
            >
              {term.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** How many posts go half wide under the lead so the rest fill rows of three: 0, 2 or 4. */
export function pairCount(count: number): number {
  const rest = count % 3
  return rest === 2 ? 2 : rest === 1 && count >= 4 ? 4 : 0
}

/**
 * The newest post on the list's first page, on a graphite stage: its
 * cover on the right merging into the graphite, the category, the title
 * large, its opening and facts on the left; the whole stage one link.
 */
function Lead({ post }: { post: PostCardView }) {
  return (
    <article className="gf-stage group relative grid overflow-hidden rounded-tile lg:min-h-[28rem] lg:grid-cols-12">
      {post.image && (
        <div className="relative aspect-[16/10] after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:via-stage/0 after:via-40% lg:order-2 lg:col-span-7 lg:aspect-auto lg:after:bg-linear-to-r lg:after:via-45%">
          <ResponsiveImage
            image={{ ...post.image, alt: "" }}
            sizes="(min-width: 1440px) 820px, (min-width: 1024px) 58vw, 100vw"
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}
      <div
        className={
          post.image
            ? "flex flex-col justify-end gap-4 p-6 pt-2 sm:p-8 lg:col-span-5 lg:p-12"
            : "flex flex-col justify-end gap-4 p-6 sm:p-8 lg:col-span-12 lg:p-12"
        }
      >
        {post.category && (
          <p className="text-sm font-semibold text-stage-text-2">{post.category.label}</p>
        )}
        <h2 className="text-display">
          <a
            href={post.path}
            className="no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </a>
        </h2>
        {post.excerpt && (
          <p className="line-clamp-3 max-w-[56ch] text-stage-text-2 lg:text-lead">{post.excerpt}</p>
        )}
        <PostFacts post={post} className="text-stage-text-2" />
      </div>
    </article>
  )
}

/**
 * The blog (`/blog`) and a category's or tag's archive (adr/0019 ek
 * 2026-11-03): the title (and the term's own words on its first page),
 * the categories as pills, the newest post large on a graphite stage on
 * the first page (the next two or four half wide, so the rows below come
 * out full), then the rest as cards three across, and the pages.
 */
export function BlogIndexPage({ view, t }: { view: BlogIndexPageView; t: Translate }) {
  const terms = view.terms ?? []
  const archive = view.activeTerm ?? null
  const first = view.pagination.page === 1
  const [lead, ...rest] = view.posts
  const cards = first && lead ? rest : view.posts
  // Under the lead, two (or four) posts half wide, so the rows of three come out full
  const pair = first && lead ? pairCount(cards.length) : 0
  return (
    <Container className="flex flex-col gap-8 pt-6 lg:gap-10 lg:pt-10">
      <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} />
      <header className="flex flex-col gap-4">
        <h1>{view.title}</h1>
        {archive?.description.map((paragraph, index) => (
          <p key={String(index)} className="max-w-[60ch] text-lead text-text-2">
            {paragraph}
          </p>
        ))}
      </header>
      {terms.length > 0 && <Terms terms={terms} t={t} />}
      {view.posts.length === 0 ? (
        <p className="rounded-tile bg-paper-2 px-6 py-12 text-center text-text-2">
          {t(archive ? "blog.archive_empty" : "blog.empty")}
        </p>
      ) : (
        <>
          {first && lead && <Lead post={lead} />}
          {pair > 0 && (
            <ul className="grid gap-x-(--gap-columns) gap-y-12 md:grid-cols-[repeat(2,minmax(0,1fr))]">
              {cards.slice(0, pair).map((post) => (
                <li key={post.path} className="min-w-0">
                  <PostCard post={post} wide />
                </li>
              ))}
            </ul>
          )}
          {cards.length > pair && (
            <ul className="grid gap-x-(--gap-columns) gap-y-12 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
              {cards.slice(pair).map((post, index) => (
                <li key={post.path} className="min-w-0">
                  <PostCard post={post} priority={!first && index < 3} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Pager pagination={view.pagination} t={t} />
    </Container>
  )
}
