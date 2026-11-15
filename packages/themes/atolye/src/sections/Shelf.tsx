import { sectionMark } from "@qticaret/ui"
import type { FormAction, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"
import { Rack } from "./ShelfRack"
import { ShelfTabs } from "./ShelfTabs"

/**
 * The shelf: the shop's product sections that stand next to each other,
 * each drawn as its own variant (`Rack`); two or more become tabs (pills),
 * every panel in the HTML. A columns rail stands alone (`blocksOf`).
 */
export function Shelf({
  sections,
  t,
  quickAdd,
}: {
  sections: readonly Of<"products">[]
  t: Translate
  quickAdd?: FormAction | undefined
}) {
  const [first] = sections
  if (!first) {
    return null
  }
  return (
    <div className="pt-(--section-gap)">
      <Container>
        {sections.length === 1 ? (
          <Rack section={first} t={t} quickAdd={quickAdd} tabbed={false} />
        ) : (
          <ShelfTabs
            id={headingId(first.id)}
            label={t("home.shelf")}
            tabs={sections.map((section) => section.title)}
          >
            {sections.map((section, index) => (
              // Each rail its own mark (adr/0065 §4); the first's is the shelf's box (one element per id)
              <div key={section.id} {...(index > 0 ? sectionMark(section.id) : {})}>
                <Rack section={section} t={t} quickAdd={quickAdd} tabbed />
              </div>
            ))}
          </ShelfTabs>
        )}
      </Container>
    </div>
  )
}
