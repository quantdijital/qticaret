import { Info } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { cn } from "../lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"

/** Opens soon after the pointer settles, as the editor's other hints do. */
const DELAY_MS = 150

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
  // The kind of pointer pressing the button, until its click is done: the tooltip's own
  // closing on a press is left out, the click decides (a tap toggles, a mouse keeps it open)
  const pressed = useRef<string | null>(null)
  const release = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(release.current)
    },
    []
  )
  return (
    <TooltipProvider delayDuration={DELAY_MS} disableHoverableContent>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          if (next || pressed.current === null) {
            setOpen(next)
          }
        }}
      >
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t("infoTip.label", { name })}
            aria-describedby={hintId}
            onPointerDown={(event) => {
              pressed.current = event.pointerType
            }}
            onPointerUp={() => {
              window.clearTimeout(release.current)
              release.current = window.setTimeout(() => {
                pressed.current = null
              }, 0)
            }}
            onClick={(event) => {
              const by = pressed.current
              pressed.current = null
              // The tooltip's own handler would close it
              event.preventDefault()
              setOpen((was) => (by === "mouse" ? true : !was))
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
