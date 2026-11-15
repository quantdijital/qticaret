import { ResponsiveImage } from "@qticaret/ui"
import type { PostCardView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** When a post went out and how long it reads, side by side, never joined by a dot. */
export function PostFacts({ post, className }: { post: PostCardView; className?: string }) {
  return (
    <p className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-3", className)}>
      {post.date && post.dateTime && <time dateTime={post.dateTime}>{post.date}</time>}
      <span>{post.reading}</span>
    </p>
  )
}

/**
 * A post in a list: its cover in a rounded well (16:10), the category's
 * name, the title as the one link over the whole card, two lines of its
 * opening, the date and the reading time. A post without a cover shows
 * its title set larger on the tinted well instead.
 */
export function PostCard({
  post,
  level = "h2",
  priority = false,
  wide = false,
}: {
  post: PostCardView
  /** The card's heading level under the list's own heading. */
  level?: "h2" | "h3"
  /** A first-row card: its cover loads at once. */
  priority?: boolean
  /** Half the row wide (under the blog's lead): a larger title. */
  wide?: boolean
}) {
  const Heading = level
  return (
    <article className="group relative flex h-full flex-col gap-4">
      <div className="relative aspect-[16/10] overflow-hidden rounded-media bg-media">
        {post.image ? (
          <ResponsiveImage
            image={{ ...post.image, alt: "" }}
            sizes={
              wide
                ? "(min-width: 1440px) 680px, (min-width: 768px) 46vw, 100vw"
                : "(min-width: 1440px) 450px, (min-width: 1024px) 31vw, (min-width: 768px) 46vw, 100vw"
            }
            priority={priority}
            className="absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-(--dur-long) motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-end p-5 text-title leading-tight font-extrabold text-text-3"
          >
            {post.title}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {post.category && (
          <p className="text-sm font-semibold text-text-2">{post.category.label}</p>
        )}
        <Heading
          className={cn(
            "leading-snug tracking-[-0.015em]",
            wide ? "text-title lg:text-[calc(var(--text-title)*1.25)]" : "text-title"
          )}
        >
          <a
            href={post.path}
            className="no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </a>
        </Heading>
        {post.excerpt && <p className="line-clamp-2 text-text-2">{post.excerpt}</p>}
        <PostFacts post={post} className="mt-auto pt-1" />
      </div>
    </article>
  )
}
