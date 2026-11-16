import { ResponsiveImage } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"

/**
 * The shop's guides (its newest three posts): each a rounded tile, its
 * cover when the post has one, else its title set large on the tinted
 * well; the category, the title and the date under it (the excerpt and
 * the reading time wait for the post: a screen holds three guides).
 * One link per tile.
 */
export function Guides({ section }: { section: Of<"posts"> }) {
  const id = headingId(section.id)
  const posts = section.posts.slice(0, 3)
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container className="flex flex-col gap-6 lg:gap-10">
        <SectionHead id={id} title={section.title} more={section.more} marks={section.editor} />
        <ul className="grid gap-(--gap-columns) md:grid-cols-[repeat(3,minmax(0,1fr))]">
          {posts.map((post) => (
            <li key={post.path} className="min-w-0">
              <article className="group relative flex h-full flex-col overflow-hidden rounded-tile gf-pane">
                {post.image && (
                  <div className="relative aspect-[16/10] bg-media-deep">
                    <ResponsiveImage
                      image={{ ...post.image, alt: "" }}
                      sizes="(min-width: 768px) 30vw, 100vw"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3 p-5 lg:p-6">
                  {post.category && (
                    <p className="text-sm font-semibold text-text-2">{post.category.label}</p>
                  )}
                  <h3
                    className={
                      post.image ? "text-title" : "text-title lg:text-section lg:leading-tight"
                    }
                  >
                    <a
                      href={post.path}
                      className="no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
                    >
                      {post.title}
                    </a>
                  </h3>
                  {post.date && post.dateTime && (
                    <p className="mt-auto pt-2 text-xs text-text-3">
                      <time dateTime={post.dateTime}>{post.date}</time>
                    </p>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
