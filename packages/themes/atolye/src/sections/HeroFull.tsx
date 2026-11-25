import { ArrowRight } from "lucide-react"
import { ResponsiveImage, fieldKey, fieldMark } from "@qticaret/ui"
import type { HeroFullView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { HandNote } from "../parts/HandNote"
import { Preload } from "../parts/Preload"
import { SearchForm } from "../parts/SearchForm"
import { HeroLeaves, HeroSwash, HeroWash } from "./hero-full-art"
import { HeroTrust } from "./HeroTrust"
import { HeroVideo } from "./HeroVideo"
import { heroVideoWords } from "./hero-video-words"
import { type Of, headingId } from "./plan"

/** The photograph across the screen, or beside the words from 1024 px. */
const SIZES = {
  full: "100vw",
  end: "(min-width: 1024px) 56vw, 100vw",
  blend: "100vw",
} as const

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
 * words. Its edge is its own rectangle or a soft wave (`edge`). With no
 * photograph there is nothing to stand beside the words: the opening
 * draws as the stage alone, as `full` does (no empty box over the words).
 *
 * The heading is one heading (the page's h1 when the opening is first):
 * its second line (`accent`) is a line of the same heading, in the shop's
 * colour. Under the words either the buttons (the first the main one, the
 * second quiet) or the shop's one search box (`SearchForm`, adr/0077 §1),
 * inside the opening or as a card over its bottom edge (`search_position`).
 * A video the shop linked adds a quiet play button after the buttons (with
 * the search box, in a row of its own under the words) that opens it in a
 * lightbox (`HeroVideo`); with none the row is drawn as before. A hand
 * note (`HandNote`) stands over the heading in the heading's ink; with
 * none, nothing is drawn there.
 * Blended (`image_side: blend`) the photograph runs under the whole
 * opening from 1024 px and the page's ground washes over it from the
 * words' side in soft drawn shapes (`HeroWash`), the words in the page's
 * inks; on a phone it is a picture over the words, as beside them.
 * With `action: both` the buttons stand under the words and the search
 * box under them. The buttons take the shop's accent colour
 * (`button_tone`), the first an arrow after its words (`button_icon`); the
 * second line of the heading a drawn curl (`accent_mark`); a sprig of
 * leaves may stand by the words (`ornament`). Mixed (`title_mix`), the
 * heading is set light and its second part follows on the same line in
 * the accent face's italic, in the heading's ink. Split (`words_place`,
 * behind the words only), the heading stands at the opening's top and the
 * text and buttons at its foot, the photograph between; the veil may be
 * faint (`scrim`). Each off: drawn as before.
 * The shop's trust badges, when shown, are a box over the bottom edge too,
 * under the search card, which then takes the same width (one edge for
 * both). Beside the words the photograph ends where that foot begins, so
 * none of it shows past the cards' side. The search box and the trust box are drawn off
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
  const { settings, accent, search, trust, video } = full
  const { image } = hero
  const both = settings.action === "both"
  const buttons = (search === null || both) && hero.actions.length > 0
  // Beside or under the words only with a photograph there: with none, the stage as `full` draws it
  const side = image && settings.image_side !== "full" ? settings.image_side : "full"
  const beside = side === "end"
  const blend = side === "blend"
  // The words on the page's ground, in its inks: beside the photograph or on its wash
  const inked = beside || blend
  const accentTone = settings.button_tone === "accent"
  const leaves = settings.ornament === "leaves"
  const centred = settings.align === "center"
  // The heading set light, its second part inline in the accent face's italic (`hero-full-mix.css`)
  const mixed = settings.title_mix === "serif_accent"
  // The heading at the top, the text and buttons at the foot: over the photograph only (`hero-full-split.css`)
  const split = settings.words_place === "split" && side === "full"
  const sizes = SIZES[side]
  const Heading = first ? "h1" : "h2"
  const overlap = search !== null && settings.search_position === "overlap"
  const foot = overlap || trust.length > 0
  // The editor's field marks (adr/0065 Faz 2b): in its live preview only
  const on = hero.editor
  const box = blend
    ? "w-full lg:w-[86%]"
    : cn("w-full", !beside && "max-w-5xl", centred && !beside && "mx-auto")
  return (
    <section
      aria-labelledby={id}
      className={cn("gf-cover", !first && "gf-section")}
      data-side={side}
      data-height={settings.height}
      data-scrim={settings.scrim}
      data-edge={settings.edge}
      data-foot={foot ? "" : undefined}
      data-title-mix={mixed ? "serif_accent" : undefined}
      data-words={split ? "split" : undefined}
    >
      {first && image && <Preload image={image} sizes={sizes} />}
      <div className="gf-cover-stage relative isolate flex flex-col justify-center">
        <div
          {...fieldMark(on, "image")}
          className={cn(
            "gf-cover-media overflow-hidden",
            beside
              ? "relative aspect-[16/10] sm:aspect-[2/1] lg:absolute lg:top-0 lg:right-0 lg:-z-10 lg:aspect-auto lg:w-[54%]"
              : blend
                ? "relative aspect-[16/10] sm:aspect-[2/1] lg:absolute lg:inset-0 lg:-z-10 lg:aspect-auto"
                : "absolute inset-0 -z-10",
            // Beside the words it ends where the foot's cards begin: none of it shows past their side
            beside && (foot ? "lg:bottom-(--cover-lift)" : "lg:bottom-0"),
            // Beside the words a photograph's well; behind them, or with none, the stage
            inked ? "bg-media" : "bg-stage"
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
          {blend && <HeroWash id={id} />}
        </div>
        <Container className={cn("gf-cover-body flex flex-col gap-8", blend && "lg:gap-12")}>
          <div
            className={cn(
              "flex flex-col gap-4 lg:gap-5",
              leaves && "relative",
              inked ? "lg:max-w-[42%]" : "gf-stage max-w-3xl bg-transparent",
              centred && "items-center text-center",
              centred && !beside && "mx-auto"
            )}
          >
            {leaves && <HeroLeaves />}
            {hero.eyebrow && (
              <p
                {...fieldMark(on, "eyebrow")}
                className={cn(
                  "text-xs font-semibold tracking-[0.18em] uppercase",
                  inked ? "text-text-2" : "text-stage-text-2"
                )}
              >
                {hero.eyebrow}
              </p>
            )}
            {full.note && (
              <HandNote
                note={full.note}
                mark={fieldMark(on, "note")}
                className={inked ? "text-text" : "text-stage-text"}
              />
            )}
            <Heading
              id={id}
              className={cn(
                "gf-cover-title max-w-[20ch] text-balance",
                inked ? "text-text" : "text-stage-text"
              )}
            >
              <span {...fieldMark(on, "heading")}>{hero.heading}</span>
              {accent && mixed && (
                <>
                  {" "}
                  <span {...fieldMark(on, "title_accent")} className="gf-cover-accent">
                    {settings.accent_mark === "swash" ? (
                      <span className="relative inline-block">
                        {accent}
                        <HeroSwash />
                      </span>
                    ) : (
                      accent
                    )}
                  </span>
                </>
              )}
              {accent && !mixed && (
                <span
                  {...fieldMark(on, "title_accent")}
                  className={cn("block", inked ? "text-signal" : "text-signal-on-stage")}
                >
                  {settings.accent_mark === "swash" ? (
                    <span className="relative inline-block">
                      {accent}
                      <HeroSwash />
                    </span>
                  ) : (
                    accent
                  )}
                </span>
              )}
            </Heading>
            {hero.intro && (
              <p
                {...fieldMark(on, "text")}
                className={cn(
                  "max-w-[48ch] text-md lg:text-lead",
                  inked ? "text-text-2" : "text-stage-text-2"
                )}
              >
                {hero.intro}
              </p>
            )}
            {(buttons || video) && (
              <div className={cn("flex flex-wrap gap-3 pt-1", centred && "justify-center")}>
                {buttons &&
                  hero.actions.slice(0, 2).map((action, index) => (
                    <a
                      key={`${action.path}-${index}`}
                      href={action.path}
                      className={cn(
                        "gf-btn",
                        index > 0 && "gf-btn--quiet",
                        index === 0 && accentTone && "gf-btn--accent"
                      )}
                      {...fieldMark(on, fieldKey("links", hero.actionsAt?.[index] ?? index))}
                    >
                      {action.label}
                      {index === 0 && settings.button_icon === "arrow" && (
                        <ArrowRight className="size-4.5" aria-hidden="true" strokeWidth={2} />
                      )}
                    </a>
                  ))}
                {video && <HeroVideo video={video} words={heroVideoWords(t)} />}
              </div>
            )}
          </div>
          {search && !overlap && <SearchForm form={search} className={box} />}
        </Container>
      </div>
      {foot && (
        <Container className="gf-cover-foot relative z-(--z-raised) flex flex-col gap-4">
          {search && overlap && (
            <SearchForm form={search} className={trust.length > 0 ? "w-full" : box} />
          )}
          {trust.length > 0 && (
            <HeroTrust
              badges={trust}
              label={t("footer.trust")}
              className={blend && !(search && overlap) ? "mx-auto lg:w-[76%]" : undefined}
              roomy={blend}
            />
          )}
        </Container>
      )}
    </section>
  )
}
