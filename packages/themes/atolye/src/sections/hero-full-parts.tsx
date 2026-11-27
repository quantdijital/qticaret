import { ArrowRight, Play } from "lucide-react"
import { fieldKey, fieldMark } from "@qticaret/ui"
import type { HandNoteView, HeroFullView, TrustBadgeView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { BrushStroke } from "../parts/BrushStroke"
import { HandNote } from "../parts/HandNote"
import { TrustIcon } from "../parts/TrustIcon"
import { HeroVideo } from "./HeroVideo"
import { heroVideoWords } from "./hero-video-words"
import type { Of } from "./plan"

/**
 * The full image opening's buttons (`HeroFull`): the first the main one
 * (the accent colour with `button_tone: accent`, an arrow after its words
 * with `button_icon: arrow`), the second quiet, and the video's button
 * after them. With `second_button: play` the second and the video's are
 * clear, their words after a ringed play mark (`.gf-btn--play`,
 * `hero-full.css`); quiet, they are drawn as before.
 */
export function HeroButtons({
  hero,
  full,
  buttons,
  centred,
  t,
}: {
  hero: Of<"hero">
  full: HeroFullView
  buttons: boolean
  centred: boolean
  t: Translate
}) {
  const { settings, video } = full
  const play = settings.second_button === "play"
  const on = hero.editor
  return (
    <div
      className={cn("flex flex-wrap gap-3 pt-1", play && "gap-x-6", centred && "justify-center")}
    >
      {buttons &&
        hero.actions.slice(0, 2).map((action, index) => (
          <a
            key={`${action.path}-${index}`}
            href={action.path}
            className={cn(
              "gf-btn",
              index > 0 && "gf-btn--quiet",
              index > 0 && play && "gf-btn--play",
              index === 0 && settings.button_tone === "accent" && "gf-btn--accent"
            )}
            {...fieldMark(on, fieldKey("links", hero.actionsAt?.[index] ?? index))}
          >
            {index > 0 && play && <PlayRing />}
            {action.label}
            {index === 0 && settings.button_icon === "arrow" && (
              <ArrowRight className="size-4.5" aria-hidden="true" strokeWidth={2} />
            )}
          </a>
        ))}
      {video && <HeroVideo video={video} words={heroVideoWords(t)} ringed={play} />}
    </div>
  )
}

/** The play mark in its ring (`second_button: play`), for the eye only. */
export function PlayRing() {
  return (
    <span aria-hidden="true" className="gf-play-ring">
      <Play className="size-4 fill-current" strokeWidth={2} />
    </span>
  )
}

/**
 * The trust badges inside the opening (`trust_place: inside`): a row under
 * the buttons, each an icon over its title and words, a hairline between
 * them, in the stage's inks (on the photograph's veil) or the page's.
 */
export function HeroTrustRow({
  badges,
  label,
  inked,
  centred,
}: {
  badges: readonly TrustBadgeView[]
  label: string
  inked: boolean
  centred: boolean
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "gf-cover-trust grid grid-cols-2 gap-y-5 pt-2 sm:flex sm:flex-wrap",
        centred && "sm:justify-center",
        inked ? "text-text" : "text-stage-text"
      )}
    >
      {badges.map((badge) => (
        <li
          key={badge.title}
          className="flex flex-col items-center gap-1.5 px-4 text-center text-xs leading-snug sm:min-w-32 sm:border-l sm:border-current/30 sm:first:border-l-0 sm:first:pl-0 lg:px-6"
        >
          <TrustIcon icon={badge.icon} className="mb-1 size-6 shrink-0" />
          <span className="font-semibold">{badge.title}</span>
          {badge.text && (
            <span className={inked ? "text-text-2" : "text-stage-text-2"}>{badge.text}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The hand note in the opening's top corner (`note_place: corner`): tilted
 * a little more than over the heading, a brush stroke drawn under it in the
 * accent colour on the stage (for the eye only), from 1024 px; below it, the
 * note stands over the heading as before (`HandNote` in `HeroFull`).
 */
export function HeroCornerNote({
  note,
  mark,
  inked,
}: {
  note: HandNoteView
  mark?: { "data-qf"?: string }
  inked: boolean
}) {
  return (
    <div className="gf-cover-note absolute top-(--cover-room) right-(--gutter) hidden w-56 lg:block xl:w-64">
      <HandNote
        note={note}
        {...(mark ? { mark } : {})}
        className={cn(
          "mx-auto -rotate-6 text-center leading-[1.05]",
          note.hand ? "text-3xl lg:text-3xl xl:text-4xl" : "text-xl lg:text-xl",
          inked
            ? "text-text"
            : "text-stage-text [text-shadow:0_1px_2px_rgb(0_0_0/0.55),0_2px_16px_rgb(0_0_0/0.6)]"
        )}
      />
      <BrushStroke className={inked ? "text-signal" : "text-signal-on-stage"} />
    </div>
  )
}
