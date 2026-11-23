import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryIconsView, LinkView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { SectionIcon } from "../parts/SectionIcon"
import { SectionHead } from "./SectionHead"

/** The disc's ground by the shop's step: the main colour's light tint, the quiet field or a ring. */
const DISC: Readonly<Record<CategoryIconsView["disc"], string>> = {
  tint: "bg-[color-mix(in_oklab,var(--color-signal)_12%,var(--color-paper))] text-signal-deep",
  well: "bg-paper-2 text-text",
  line: "border border-rule bg-transparent text-text",
}

/**
 * The categories' icon row (adr/0077 §10 Ek, "İkonlu sıra"): each category
 * a round disc holding the icon the shop picked for it, else the
 * category's own picture filling the disc, else its name's first letter;
 * its name under the disc (and its count while the shop shows counts), the
 * whole a link to the category. From 1024 px the discs share the row
 * evenly; on a narrower screen they slide sideways with snapping and no
 * arrows (`phone: scroll`, bilesen-standardi §4.4 Ek: a row that only
 * overflows on a narrow screen is no carousel), or wrap onto more rows
 * (`wrap`). The icon and the picture are for the eye (alt empty): the name
 * says it.
 */
export function CategoryIcons({
  id,
  title,
  view,
  all,
  ownAll,
  t,
  marks,
}: {
  id: string
  title: string
  view: CategoryIconsView
  all: LinkView
  ownAll: boolean
  t: Translate
  marks?: boolean | undefined
}) {
  const scroll = view.phone === "scroll"
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container className="flex flex-col gap-(--head-gap)">
        <SectionHead id={id} title={title} more={all} ownMore={ownAll} marks={marks} />
        <ul
          data-variant="icons"
          className={cn(
            "flex gap-x-(--gap-columns) gap-y-(--gap-rows) lg:flex-wrap lg:justify-between",
            scroll
              ? "gf-rail -mx-(--gutter) overflow-x-auto scroll-px-(--gutter) px-(--gutter) lg:mx-0 lg:overflow-visible lg:px-0"
              : "flex-wrap justify-center"
          )}
        >
          {view.items.map((item) => (
            <li key={item.path} className="shrink-0">
              <a
                href={item.path}
                className="group flex w-22 flex-col items-center gap-2 text-center lg:w-28"
              >
                <span
                  className={cn(
                    "flex size-16 items-center justify-center overflow-hidden rounded-pill transition-colors lg:size-20",
                    // A picture sits on the photo well (adr/0067 S4), an icon or a letter on the disc
                    !item.icon && item.image ? "bg-media" : DISC[view.disc]
                  )}
                >
                  {item.icon ? (
                    <SectionIcon icon={item.icon} className="size-7 shrink-0 lg:size-8" />
                  ) : item.image ? (
                    <ResponsiveImage
                      image={{ ...item.image, alt: "" }}
                      sizes="80px"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span aria-hidden="true" className="text-xl font-extrabold">
                      {item.initial}
                    </span>
                  )}
                </span>
                <span className="text-sm leading-snug font-semibold text-balance transition-colors group-hover:text-text-2">
                  {item.label}
                </span>
                {typeof item.count === "number" && (
                  <span className="-mt-1.5 text-xs text-text-2">
                    {t("listing.count", { count: item.count.toLocaleString("tr-TR") })}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
