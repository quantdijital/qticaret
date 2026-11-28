import { scrollerSettingsOf } from "@qticaret/types/section-scroller"
import type { HeadLinesView, CategoryCardView, LinkView, Translate } from "@qticaret/ui"
import { CategoryTile } from "../parts/CategoryTile"
import { Container } from "../parts/Container"
import { Scroller } from "../parts/Scroller"
import { scrollerSizes } from "../parts/scroller-sizes"
import { SectionHead } from "./SectionHead"

/**
 * The categories' `carousel`: the tiles' own picture cards (`CategoryTile`:
 * the picture merging into the graphite foot, the name on it, the count
 * under it while the shop shows counts) in one row that slides with the
 * scroller kit (its arrows beside the head or the row, keyboard and screen
 * reader as the kit's; nothing turns by itself unless the shop says so).
 */
export function CategoryCarousel({
  id,
  title,
  categories,
  scroller,
  all,
  t,
  marks,
  ownAll = false,
  lines,
}: {
  id: string
  title: string
  categories: readonly CategoryCardView[]
  /** The kit's settings; absent or off the list: the default. */
  scroller: unknown
  /** The link beside the head: the shop's own, else every category. */
  all: LinkView
  t: Translate
  /** The editor's live preview (adr/0065 Faz 2b): the title carries its field mark. */
  marks?: boolean | undefined
  /** `all` is the shop's own link (`more`): in the preview it is marked too. */
  ownAll?: boolean
  /** The heading's upper line and hand note (sahip 2026-11-28); absent: none. */
  lines?: HeadLinesView | undefined
}) {
  if (categories.length === 0) {
    return null
  }
  const settings = scrollerSettingsOf(scroller)
  const sizes = scrollerSizes(settings)
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container>
        <Scroller
          settings={settings}
          words={{
            label: title,
            previous: t("scroller.previous"),
            next: t("scroller.next"),
            play: t("scroller.play"),
            pause: t("scroller.pause"),
            page: t("scroller.page", { n: "{n}" }),
            pages: t("scroller.pages"),
          }}
          head={
            <SectionHead
              id={id}
              title={title}
              more={all}
              marks={marks}
              ownMore={ownAll}
              lines={lines}
            />
          }
        >
          {categories.map((category) => (
            <CategoryTile
              key={category.path}
              category={category}
              sizes={sizes}
              note={
                typeof category.count === "number"
                  ? t("listing.count", { count: category.count.toLocaleString("tr-TR") })
                  : null
              }
            />
          ))}
        </Scroller>
      </Container>
    </section>
  )
}
