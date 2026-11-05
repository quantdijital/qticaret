import { Star } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { HomeSectionView, PlaceOrderResult, Translate } from "@qticaret/ui"
import { PostCard } from "../components/PostCard"
import { RatingSummary, ReviewPhotos } from "../components/ReviewExtras"
import { TrustStrip } from "../components/TrustStrip"
import { NewsletterForm } from "../layout/NewsletterForm"
import { newsletterWords } from "../layout/newsletter-words"
import { SectionHead, headingId } from "./SectionHead"

type Of<T extends HomeSectionView["type"]> = Extract<HomeSectionView, { type: T }>

export function PostsSection({ section }: { section: Of<"posts"> }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-8">
      <SectionHead id={id} title={section.title} more={section.more} />
      <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {section.posts.map((post) => (
          <li key={post.path}>
            <PostCard post={post} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The newest approved reviews, each with its product. */
export function ReviewsSection({ section, t }: { section: Of<"reviews">; t: Translate }) {
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-8">
      <SectionHead id={id} title={section.title} more={section.more} />
      {section.summary && <RatingSummary summary={section.summary} t={t} />}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.reviews.map((review, index) => (
          <li
            key={`${review.author}-${review.date}-${String(index)}`}
            className="flex flex-col gap-3 rounded-2xl border bg-card p-6"
          >
            <p className="flex gap-0.5" aria-label={t("reviews.stars", { rating: review.rating })}>
              {Array.from({ length: 5 }, (_, star) => (
                <Star
                  key={star}
                  aria-hidden="true"
                  className={
                    star < review.rating
                      ? "size-4 fill-current text-primary"
                      : "size-4 text-muted-foreground"
                  }
                />
              ))}
            </p>
            {review.title && <p className="font-semibold">{review.title}</p>}
            <p className="line-clamp-5 text-sm text-foreground/85">{review.body}</p>
            <ReviewPhotos photos={review.photos ?? []} label={t("reviews.photos")} />
            <p className="mt-auto text-xs text-muted-foreground">
              {review.author} · {review.date}
              {review.product && (
                <>
                  {" · "}
                  <a href={review.product.path} className="underline underline-offset-4">
                    {review.product.label}
                  </a>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      {section.photos && section.photos.length > 0 && (
        <CustomerPhotos photos={section.photos} title={t("reviews.customer_photos")} />
      )}
    </section>
  )
}

/**
 * The newest photos customers put on their approved reviews (adr/0046 Ek
 * 2026-11-04): a row of squares, each at its product's page.
 */
function CustomerPhotos({
  photos,
  title,
}: {
  photos: NonNullable<Of<"reviews">["photos"]>
  title: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {photos.map((photo) => {
          const image = (
            <ResponsiveImage
              image={photo.image}
              sizes="(min-width: 1024px) 12vw, (min-width: 640px) 16vw, 25vw"
              className="size-full object-cover"
            />
          )
          return (
            <li key={photo.image.src} className="aspect-square overflow-hidden rounded-xl bg-muted">
              {photo.product ? (
                <a href={photo.product.path} className="block size-full">
                  {image}
                </a>
              ) : (
                image
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The shop's own text: the backend's HTML from its allow-listed document (adr/0019). */
export function RichTextSection({ section }: { section: Of<"rich_text"> }) {
  const id = headingId(section.id)
  return (
    <section
      aria-labelledby={section.title ? id : undefined}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      {section.title && (
        <h2 id={id} className="text-3xl leading-tight lg:text-4xl">
          {section.title}
        </h2>
      )}
      <div
        className="flex flex-col gap-4 text-[17px] leading-[1.75] text-foreground/90 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-heading [&_h2]:text-2xl [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: section.html }}
      />
    </section>
  )
}

export function TrustSection({ section, t }: { section: Of<"trust_badges">; t: Translate }) {
  return <TrustStrip badges={section.badges} label={t("footer.trust")} />
}

export function NewsletterSection({
  section,
  t,
  subscribe,
}: {
  section: Of<"newsletter">
  t: Translate
  subscribe: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
}) {
  return (
    <div className="rounded-3xl bg-ink px-6 py-10 text-ink-foreground sm:px-10 lg:px-14">
      <NewsletterForm
        id={headingId(section.id)}
        action={subscribe}
        privacyPath={section.privacyPath}
        words={newsletterWords(t, section.title, section.text)}
      />
    </div>
  )
}
