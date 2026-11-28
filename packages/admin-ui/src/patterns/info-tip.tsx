import { Info } from "lucide-react"
import { useId, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { cn } from "../lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"

/** Opens soon after the pointer settles, as the editor's other hints do. */
const DELAY_MS = 150

/** How long a press waits for its click (a tap's comes after the finger lifts). */
const PRESS_MS = 1000

/**
 * A field's help text behind a small (i) beside its name: it opens on
 * hover and on keyboard focus, a tap opens and closes it (a touch screen
 * has no hover), Escape and a tap elsewhere close it. The button is named
 * "Bilgi: <field>" and described by the words (`hintId`, the hidden copy
 * the field's control is described by too), so a screen reader reads
 * them without opening anything.
 */
export function InfoTip({
  name,
  hint,
  hintId,
  className,
}: {
  /** The field's name: the button's is "Bilgi: <name>". */
  name: string
  hint: ReactNode
  /** The hidden copy of the words (`HiddenHint`): the button's description. */
  hintId?: string | undefined
  className?: string
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const [open, setOpen] = useState(false)
  // The pointer pressing the button, until its click: what the tooltip does meanwhile on
  // its own (closing on the press, opening on the focus a tap gives after it) is left out,
  // the click decides: a tap toggles, a mouse keeps it open. A press with no click after
  // it (a finger dragged away) stops counting after a moment.
  const pressed = useRef<{ kind: string; at: number } | null>(null)
  const pressing = () =>
    pressed.current !== null && performance.now() - pressed.current.at < PRESS_MS
  return (
    <TooltipProvider delayDuration={DELAY_MS} disableHoverableContent>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          if (!pressing()) {
            setOpen(next)
          }
        }}
      >
        <TooltipTrigger asChild>
          <button
            type="button"
            // Never the control a field's focus lands on (a search's or a dialog's pick)
            data-info-tip=""
            aria-label={t("infoTip.label", { name })}
            aria-describedby={hintId}
            onPointerDown={(event) => {
              pressed.current = { kind: event.pointerType, at: performance.now() }
            }}
            onClick={(event) => {
              const by = pressing() ? pressed.current?.kind : null
              pressed.current = null
              // The tooltip's own handler would close it
              event.preventDefault()
              // A mouse keeps it open (hover opened it already); a tap or Enter toggles
              setOpen((was) => (by === "mouse" || by === "pen" ? true : !was))
            }}
            className={cn(
              // As tall as the name's first line (docs/18 §9 `h-lh`); a larger hit area for a finger
              "relative inline-flex h-lh shrink-0 items-center rounded-full text-sm text-muted-foreground after:absolute after:-inset-1.5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              className
            )}
          >
            <Info aria-hidden="true" className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          collisionPadding={8}
          className="max-w-xs px-3 py-2 text-sm leading-snug"
        >
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * The words behind an `InfoTip`, kept in the page but not shown: the
 * field's control and the (i) are described by them, and a panel's own
 * search still reads them.
 */
export function HiddenHint({ id, children }: { id?: string | undefined; children: ReactNode }) {
  return (
    <p id={id} className="sr-only">
      {children}
    </p>
  )
}

/**
 * A card's one sentence on what it is for, behind an (i) beside its title
 * (under `FieldHints style="tip"`): as tall as the title's line, its
 * words kept hidden as the button's description.
 */
export function TitleTip({
  title,
  hint,
  className,
}: {
  title: string
  hint: ReactNode
  className?: string
}) {
  const hintId = `${useId()}-about`
  return (
    <>
      <InfoTip name={title} hint={hint} hintId={hintId} className={cn("h-6", className)} />
      <HiddenHint id={hintId}>{hint}</HiddenHint>
    </>
  )
}
