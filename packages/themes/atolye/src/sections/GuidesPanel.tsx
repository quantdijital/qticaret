import { POSTS_INTRO_CARDS } from "@qticaret/types/section-posts"
import { ResponsiveImage, fieldMark } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { PanelLeaves } from "./band-art"
import { type Of, headingId } from "./plan"

/** The posts' variants this theme draws beside today's tiles (`drawnVariant`). */
export const GUIDE_VARIANTS = ["intro_panel"] as const

/** The cards' columns from 640 px: as many as there are, up to three. */
const CARDS: Readonly<Record<number, string>> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
}

/**
 * The posts' intro panel (`posts`, adr/0077 Ek, "Tanıtım paneli"): one
 * rounded panel on the section's ground (`ground`, the shop's look; a
 * light tint unless it set one, `Blocks` keeps it off the box), an upper
 * line, the heading, a short intro and one button (the shop's link, else
 * every post) on one side, the first two or three posts on the other,
 * each a card with its cover, its title and its reading time and date.
 * Stacked on a phone. One link per card.
 */
export function GuidesPanel({
  section,
  ground,
}: {
  section: Of<"posts">
  ground: "page" | "well" | "stage" | "primary"
}) {
  const id = headingId(section.id)
  const posts = section.posts.slice(0, POSTS_INTRO_CARDS)
  const marks = section.editor
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container>
        <div
          data-ground={ground}
          data-tone={section.panelTone}
          className={cn(
            "gf-ground grid items-center gap-(--gap-columns) rounded-tile p-5 sm:p-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:p-10",
            ground === "stage" && "gf-stage",
            section.ornament === "leaves" && "relative"
          )}
        >
          <div className="flex flex-col items-start gap-3">
            {section.eyebrow && (
              <p className="text-sm font-semibold text-text-2" {...fieldMark(marks, "eyebrow")}>
                {section.eyebrow}
              </p>
            )}
            <h2 id={id} {...fieldMark(marks, "title")}>
              {section.title}
            </h2>
            {section.intro && (
              <p className="text-text-2" {...fieldMark(marks, "intro")}>
                {section.intro}
              </p>
            )}
            <p className="pt-2">
              <a href={section.more.path} className="gf-btn" {...fieldMark(marks, "link")}>
                {section.more.label}
              </a>
            </p>
          </div>
          <ul className={cn("grid gap-4", CARDS[posts.length])}>
            {posts.map((post) => (
              <li key={post.path} className="min-w-0">
                <article className="group relative flex h-full flex-col overflow-hidden rounded-tile gf-pane">
                  {post.image && (
                    <div
                      className={cn(
                        "relative",
                        section.coverRatio === "wide" ? "aspect-[2/1]" : "aspect-[16/10]",
                        "bg-media-deep"
                      )}
                    >
                      <ResponsiveImage
                        image={{ ...post.image, alt: "" }}
                        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="text-md font-semibold">
                      <a
                        href={post.path}
                        className="no-underline transition-colors duration-(--dur-micro) group-hover:text-text-2 after:absolute after:inset-0 after:content-['']"
                      >
                        {post.title}
                      </a>
                    </h3>
                    <p className="mt-auto text-xs text-text-3">
                      {post.reading}
                      {post.date && post.dateTime && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <time dateTime={post.dateTime}>{post.date}</time>
                        </>
                      )}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          {section.ornament === "leaves" && <PanelLeaves />}
        </div>
      </Container>
    </section>
  )
}
