import type { BlogIndexPageView, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"
import { Pages } from "./components/Pages"
import { PostCard } from "./components/PostCard"

/** The blog's posts, newest first: a card per post, one link to it. */
export function BlogIndexPage({ view, t }: { view: BlogIndexPageView; t: Translate }) {
  return (
    <PageContainer className="flex flex-col gap-8">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <h1 className="text-4xl leading-tight lg:text-5xl">{view.title}</h1>
      {view.posts.length === 0 ? (
        <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
          {t("blog.empty")}
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
