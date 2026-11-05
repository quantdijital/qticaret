import { ResponsiveImage } from "@qticaret/ui"
import type { ContentPageView, PostMetaView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { ProductCard } from "../parts/ProductCard"
import { Trail } from "../parts/Trail"
import { hasOutline, OutlineAside, OutlineWell } from "./Outline"
import { Notice } from "./PageHead"
import { PostCard } from "./PostCard"
import { Prose } from "./Prose"
import { readingGrid } from "./reading"

/** Who wrote the post, when, and how long it reads: side by side, never joined by a dot. */
function Facts({ meta, t }: { meta: PostMetaView; t: Translate }) {
  return (
    <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-2">
      {meta.author && <span>{t("blog.author", { author: meta.author })}</span>}
      {meta.date && meta.dateTime && <time dateTime={meta.dateTime}>{meta.date}</time>}
      <span>{meta.reading}</span>
    </p>
  )
}

/** Under the text: the post's tags as pills to their archives, and its share links. */
function Closing({ view, t }: { view: ContentPageView; t: Translate }) {
  const tags = view.tags ?? []
  const share = view.share ?? []
  if (tags.length === 0 && share.length === 0) {
    return null
  }
  return (
    <div className="mt-12 flex flex-col gap-8 border-t border-rule pt-8">
      {tags.length > 0 && (
        <section aria-labelledby="etiketler" className="flex flex-col gap-3">
          <h2 id="etiketler" className="text-md tracking-normal">
            {t("blog.tags")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.path}>
                <a href={tag.path} className="gf-chip">
                  {tag.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {share.length > 0 && (
        <section aria-labelledby="paylas" className="flex flex-col gap-3">
          <h2 id="paylas" className="text-md tracking-normal">
            {t("blog.share")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {share.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener"
                  aria-label={t("blog.share_on", { network: link.label })}
                  className="gf-btn gf-btn--quiet gf-btn--small"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * A blog post (adr/0019, adr/0046 Ek 2026-11-05 içerik sayfaları): the
 * category as a pill, the title, who wrote it, when and how long it
 * reads, and the cover, all in the one reading column (owner 2026-11-05:
 * the title flush with the text, nothing across the page); the text in
 * that column's measure with its contents beside it from 1024 px (a
 * closed well on a phone) when it is long; its tags and share links; then
 * the products its text names as the shop's cards, and three posts to
 * read next.
 */
export function PostPage({ view, t }: { view: ContentPageView; t: Translate }) {
  const meta = view.post ?? null
  const outline = hasOutline(view.outline) ? (view.outline ?? []) : []
  const products = view.products ?? []
  const related = view.related ?? []
  const image = view.image ?? null
  const reading = readingGrid({ outline: outline.length > 0, tablet: true })
  return (
    <div>
      <Container className="flex flex-col gap-6 pt-6 lg:pt-10">
        <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} compact />
        <Notice text={view.notice} />
      </Container>
      <Container className={`mt-6 grid gap-6 sm:gap-8 ${reading.grid}`}>
        <header className={`flex min-w-0 flex-col items-start gap-4 ${reading.column}`}>
          {view.category && (
            <a href={view.category.path} className="gf-chip">
              {view.category.label}
            </a>
          )}
          <h1 className="max-w-[22ch] text-section leading-[1.12]">{view.title}</h1>
          {meta && <Facts meta={meta} t={t} />}
        </header>
        {image && (
          <div
            className={`gf-stage relative aspect-[16/10] overflow-hidden rounded-tile sm:aspect-[2/1] lg:aspect-[21/9] ${reading.column}`}
          >
            <ResponsiveImage
              image={{ ...image, alt: "" }}
              sizes="(min-width: 1024px) 544px, (min-width: 640px) 512px, 100vw"
              priority
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}
        {outline.length > 0 && (
          <>
            <OutlineWell outline={outline} t={t} className={reading.column} />
            {/* Beside the title, the cover and the text alike: the left of the first screen is never empty */}
            <OutlineAside
              id="icindekiler"
              outline={outline}
              t={t}
              className={`${reading.side} ${image ? "lg:row-span-3" : "lg:row-span-2"}`}
            />
          </>
        )}
        <article className={`min-w-0 ${reading.column}`}>
          <Prose html={view.html} tableLabel={(n) => t("content.table", { n })} />
          <Closing view={view} t={t} />
        </article>
      </Container>
      {products.length > 0 && (
        <section aria-labelledby="yazidaki-urunler" className="pt-(--section-gap-s)">
          <Container className="flex flex-col gap-6 lg:gap-8">
            <h2 id="yazidaki-urunler">{t("blog.products")}</h2>
            <ul className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-(--gap-columns) lg:grid-cols-[repeat(4,minmax(0,1fr))]">
              {products.map((product) => (
                <li key={product.path} className="min-w-0">
                  <ProductCard product={product} t={t} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}
      {related.length > 0 && (
        <section aria-labelledby="ilgili-yazilar" className="pt-(--section-gap-s)">
          <Container className="flex flex-col gap-6 lg:gap-8">
            <h2 id="ilgili-yazilar">{t("blog.related")}</h2>
            <ul className="grid gap-x-(--gap-columns) gap-y-10 md:grid-cols-[repeat(3,minmax(0,1fr))]">
              {related.map((post) => (
                <li key={post.path} className="min-w-0">
                  <PostCard post={post} level="h3" />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}
    </div>
  )
}
