import { ResponsiveImage } from "@qticaret/ui"
import type { BlogIndexPageView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { Pages } from "./components/Pages"

/** The blog's posts, newest first: a card per post, one link to it. */
export function BlogIndexPage({ view, t }: { view: BlogIndexPageView; t: Translate }) {
  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{view.title}</h1>
      {view.posts.length === 0 ? (
        <p className="rounded-xl bg-muted py-16 text-center text-muted-foreground">
          {t("blog.empty")}
        </p>
      ) : (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {view.posts.map((post, index) => (
            <li key={post.path}>
              <article className="group relative flex h-full flex-col gap-3">
                {post.image && (
                  <div className="aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                    <ResponsiveImage
                      image={post.image}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      priority={index < 3 && view.pagination.page === 1}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                )}
                <p className="flex gap-2 text-xs text-muted-foreground">
                  {post.date && post.dateTime && <time dateTime={post.dateTime}>{post.date}</time>}
                  {post.date && <span aria-hidden="true">·</span>}
                  <span>{post.reading}</span>
                </p>
                <h2 className="text-lg leading-snug font-semibold tracking-tight">
                  <a href={post.path} className="after:absolute after:inset-0 after:content-['']">
                    {post.title}
                  </a>
                </h2>
                {post.excerpt && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
      <Pages pagination={view.pagination} t={t} />
    </div>
  )
}
