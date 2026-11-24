import { ResponsiveImage, fieldKey, fieldMark } from "@qticaret/ui"
import type { HeroFullView, Translate, TrustBadgeView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Preload } from "../parts/Preload"
import { SearchForm } from "../parts/SearchForm"
import { TrustIcon } from "../parts/TrustIcon"
import { type Of, headingId } from "./plan"

/** The photograph across the screen, or beside the words from 1024 px. */
const SIZES = { full: "100vw", end: "(min-width: 1024px) 56vw, 100vw" } as const

/** From 1024 px as many columns as badges (at most four): no empty box. */
const COLUMNS = ["lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"]

/**
 * The shop's trust badges in the opening: one floating box on the field
 * colour with the theme's float shadow (a hairline in its place when the
 * shop turns shadows off), each badge its icon in the shop's colour beside
 * its title and line; two by two on a phone, all in a row from 1024 px.
 */
function Trust({ badges, label }: { badges: readonly TrustBadgeView[]; label: string }) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-5 rounded-tile bg-field px-4 py-5 text-left text-text shadow-float sm:px-6 lg:gap-x-0 lg:px-2",
        COLUMNS[Math.min(badges.length, COLUMNS.length) - 1]
      )}
    >
      {badges.map((badge) => (
        <li
          key={badge.title}
          className="flex items-start gap-3 last:odd:col-span-2 lg:border-l lg:border-rule lg:px-6 lg:first:border-l-0 lg:last:odd:col-span-1"
        >
          <TrustIcon icon={badge.icon} className="size-7 shrink-0 text-signal" />
          <span className="flex min-w-0 flex-col gap-0.5 leading-snug">
            <span className="text-sm font-extrabold tracking-[-0.01em] text-balance">
              {badge.title}
            </span>
            {badge.text && <span className="text-xs text-balance text-text-2">{badge.text}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The full image opening (`hero` `full_image`, adr/0077 §9, "Tam görsel"):
 * the shop's photograph as the whole opening, edge to edge, the graphite
 * stage veiled over it (`scrim`) and the words on it in the stage's inks,
 * centred or at the start (`align`), about a screen tall or two thirds of
 * it (`height`). With no photograph, the stage alone.
 *
 * Beside the words (`image_side: end`) the words stand on the page's
 * ground in its own inks and the photograph takes the other half from
 * 1024 px, up to the screen's edge; on a phone it is a picture over the
 * words. Its edge is its own rectangle or a soft wave (`edge`).
 *
 * The heading is one heading (the page's h1 when the opening is first):
 * its second line (`accent`) is a line of the same heading, in the shop's
 * colour. Under the words either the buttons (the first the main one, the
 * second quiet) or the shop's one search box (`SearchForm`, adr/0077 §1),
 * inside the opening or as a card over its bottom edge (`search_position`).
 * The shop's trust badges, when shown, are a box over the bottom edge too,
 * under the search card. The search box and the trust box are drawn off
 * the stage, so they keep the page's own inks on their white ground.
 */
export function HeroFull({
  hero,
  full,
  first,
  t,
}: {
  hero: Of<"hero">
  full: HeroFullView
  /** The page's first section: its heading is the h1 and its picture the LCP. */
  first: boolean
  t: Translate
}) {
  const id = headingId(hero.id)
  const { settings, accent, search, trust } = full
  const beside = settings.image_side === "end"
  const centred = settings.align === "center"
  const { image } = hero
  const sizes = SIZES[settings.image_side]
  const Heading = first ? "h1" : "h2"
  const overlap = search !== null && settings.search_position === "overlap"
  const foot = overlap || trust.length > 0
  // The editor's field marks (adr/0065 Faz 2b): in its live preview only
  const on = hero.editor
  const box = cn("w-full", !beside && "max-w-5xl", centred && !beside && "mx-auto")
  return (
    <section
      aria-labelledby={id}
      className={cn("gf-cover", !first && "gf-section")}
      data-side={settings.image_side}
      data-height={settings.height}
      data-scrim={settings.scrim}
      data-edge={settings.edge}
      data-foot={foot ? "" : undefined}
    >
      {first && image && <Preload image={image} sizes={sizes} />}
      <div className="gf-cover-stage relative isolate flex flex-col justify-center">
        <div
          {...fieldMark(on, "image")}
          className={cn(
            "gf-cover-media overflow-hidden",
            beside
              ? "relative aspect-[16/10] sm:aspect-[2/1] lg:absolute lg:inset-y-0 lg:right-0 lg:-z-10 lg:aspect-auto lg:w-[54%]"
              : "absolute inset-0 -z-10",
            // Beside the words a photograph's well; behind them, or with none, the stage
            beside && image ? "bg-media" : "bg-stage"
          )}
        >
          {image && (
            <ResponsiveImage
              image={image}
              sizes={sizes}
              priority={first}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
        <Container className="gf-cover-body flex flex-col gap-8">
          <div
            className={cn(
              "flex flex-col gap-4 lg:gap-5",
              beside ? "lg:max-w-[42%]" : "gf-stage max-w-3xl bg-transparent",
              centred && "items-center text-center",
              centred && !beside && "mx-auto"
            )}
          >
            {hero.eyebrow && (
              <p
                {...fieldMark(on, "eyebrow")}
                className={cn(
                  "text-xs font-semibold tracking-[0.18em] uppercase",
                  beside ? "text-text-2" : "text-stage-text-2"
                )}
              >
                {hero.eyebrow}
              </p>
            )}
            <Heading
              id={id}
              className={cn(
                "gf-cover-title max-w-[20ch] text-balance",
                beside ? "text-text" : "text-stage-text"
              )}
            >
              <span {...fieldMark(on, "heading")}>{hero.heading}</span>
              {accent && (
                <span
                  {...fieldMark(on, "title_accent")}
                  className={cn("block", beside ? "text-signal" : "text-signal-on-stage")}
                >
                  {accent}
                </span>
              )}
            </Heading>
            {hero.intro && (
              <p
                {...fieldMark(on, "text")}
                className={cn(
                  "max-w-[48ch] text-md lg:text-lead",
                  beside ? "text-text-2" : "text-stage-text-2"
                )}
              >
                {hero.intro}
              </p>
            )}
            {search === null && hero.actions.length > 0 && (
              <div className={cn("flex flex-wrap gap-3 pt-1", centred && "justify-center")}>
                {hero.actions.slice(0, 2).map((action, index) => (
                  <a
                    key={`${action.path}-${index}`}
                    href={action.path}
                    className={cn("gf-btn", index > 0 && "gf-btn--quiet")}
                    {...fieldMark(on, fieldKey("links", hero.actionsAt?.[index] ?? index))}
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          {search && !overlap && <SearchForm form={search} className={box} />}
        </Container>
      </div>
      {foot && (
        <Container className="gf-cover-foot relative z-(--z-raised) flex flex-col gap-4">
          {search && overlap && <SearchForm form={search} className={box} />}
          {trust.length > 0 && <Trust badges={trust} label={t("footer.trust")} />}
        </Container>
      )}
    </section>
  )
}
