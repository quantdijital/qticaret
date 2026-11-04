import { Star } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { PostCardView, Translate } from "@qticaret/ui"
import { Container } from "../components/Container"
import { headingId } from "./Opening"
import type { Of } from "./plan"
import { SectionHead } from "./SectionHead"

function PostRow({ post }: { post: PostCardView }) {
  return (
    <li className="relative grid gap-2 border-b border-rule py-6 md:grid-cols-12 md:gap-(--gap-columns)">
      <p className="flex flex-col text-sm text-text-3 md:col-span-3">
        {post.category && (
          <a
            href={post.category.path}
            className="at-row-link relative z-(--z-raised) self-start font-medium text-text-2"
          >
            {post.category.label}
          </a>
        )}
        {post.date && post.dateTime && <time dateTime={post.dateTime}>{post.date}</time>}
        <span>{post.reading}</span>
      </p>
      <div className="flex flex-col gap-2 md:col-span-9 lg:col-span-7">
        <h3 className="max-w-none">
          <a
            href={post.path}
            className="at-row-link after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </a>
        </h3>
        {post.excerpt && <p className="line-clamp-2 text-md text-text-2">{post.excerpt}</p>}
      </div>
    </li>
  )
}

function PostTile({
  post,
}: {
  post: PostCardView & { image: NonNullable<PostCardView["image"]> }
}) {
  return (
    <li className="relative flex flex-col gap-4">
      <div className="aspect-[4/3] overflow-hidden bg-paper-2">
        <ResponsiveImage
          image={post.image}
          sizes="(min-width: 1440px) 416px, (min-width: 768px) 30vw, 100vw"
          className="h-full w-full object-cover"
        />
      </div>
      <p className="flex flex-col text-sm text-text-3">
        {post.date && post.dateTime && <time dateTime={post.dateTime}>{post.date}</time>}
        <span>{post.reading}</span>
      </p>
      <h3 className="max-w-none">
        <a href={post.path} className="at-row-link after:absolute after:inset-0 after:content-['']">
          {post.title}
        </a>
      </h3>
    </li>
  )
}

/**
 * The shop's guides (the blog): ruled rows under an ink rule, the date,
 * its category and its reading time in the left column, the title and
 * two lines of it on the right; with pictures for all of them, a row of
 * three with their pictures instead. No picture is made up for a post.
 */
export function PostsSection({ section }: { section: Of<"posts"> }) {
  const id = headingId(section.id)
  const pictured = section.posts.every((post) => post.image !== null) && section.posts.length >= 3
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-10">
        <SectionHead id={id} title={section.title} more={section.more} />
        {pictured ? (
          <ul className="grid gap-x-(--gap-columns) gap-y-12 border-t-2 border-rule-ink pt-6 md:grid-cols-3">
            {section.posts
              .slice(0, 3)
              .map((post) =>
                post.image ? (
                  <PostTile key={post.path} post={{ ...post, image: post.image }} />
                ) : null
              )}
          </ul>
        ) : (
          <ul className="border-t-2 border-rule-ink">
            {section.posts.map((post) => (
              <PostRow key={post.path} post={post} />
            ))}
          </ul>
        )}
      </Container>
    </section>
  )
}

/**
 * The shop's newest approved reviews (design.md § Review card), never
 * made up: up to three across under ink rules, the stars (read as "5
 * üzerinden 4"), the title, six lines of the text, who and when, "a
 * verified purchase" in words, and the product. The summary and the
 * distribution wait for the contract (denetim §7); no section is drawn
 * without a review.
 * TODO(adr/0013 ek, denetim §7): customer photos from the reviews' images.
 */
export function ReviewsSection({ section, t }: { section: Of<"reviews">; t: Translate }) {
  if (section.reviews.length === 0) {
    return null
  }
  const id = headingId(section.id)
  return (
    <section aria-labelledby={id} className="pt-(--section-gap)">
      <Container className="flex flex-col gap-10">
        <SectionHead id={id} title={section.title} more={section.more} />
        <ul className="grid gap-x-(--gap-columns) gap-y-10 md:grid-cols-3">
          {section.reviews.slice(0, 6).map((review, index) => (
            <li
              key={`${review.author}-${review.date}-${String(index)}`}
              className="flex flex-col gap-3 border-t-2 border-rule-ink pt-4"
            >
              <p
                className="flex gap-0.5"
                role="img"
                aria-label={t("reviews.stars", { rating: review.rating })}
              >
                {Array.from({ length: 5 }, (_, star) => (
                  <Star
                    key={star}
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className={star < review.rating ? "size-4 fill-current" : "size-4 text-text-3"}
                  />
                ))}
              </p>
              {review.title && <p className="text-md font-medium">{review.title}</p>}
              <p className="line-clamp-6 text-md text-text-2">{review.body}</p>
              <p className="mt-auto flex flex-col text-sm text-text-3">
                <span className="font-medium text-text-2">{review.author}</span>
                <span>{review.date}</span>
                {review.verified && <span>{t("product.verified")}</span>}
                {review.product && (
                  <a href={review.product.path} className="at-inline-link self-start text-text-2">
                    {review.product.label}
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
