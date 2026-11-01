import { ResponsiveImage } from "@qticaret/ui"
import type { PostCardView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** A blog post in a list: its picture (or a quiet panel), date, title and summary; one link. */
export function PostCard({
  post,
  priority = false,
  headingLevel = "h2",
}: {
  post: PostCardView
  priority?: boolean
  headingLevel?: "h2" | "h3"
}) {
  const Heading = headingLevel
  return (
    <article className="group relative flex h-full flex-col gap-4">
      <div
        className={cn(
          "aspect-[16/10] overflow-hidden rounded-2xl",
          post.image ? "bg-muted" : "flex items-end bg-primary/8 p-5"
        )}
      >
        {post.image ? (
          <ResponsiveImage
            image={post.image}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="font-heading line-clamp-3 text-2xl leading-tight text-primary/70"
          >
            {post.title}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="flex gap-2 text-xs font-medium text-muted-foreground">
          {post.date && post.dateTime && <time dateTime={post.dateTime}>{post.date}</time>}
          {post.date && <span aria-hidden="true">·</span>}
          <span>{post.reading}</span>
        </p>
        <Heading className="font-heading text-xl leading-snug">
          <a
            href={post.path}
            className="decoration-1 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </a>
        </Heading>
        {post.excerpt && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
        )}
      </div>
    </article>
  )
}
