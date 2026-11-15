import { cloneElement, createContext, useContext, useId } from "react"
import type { ComponentProps, ReactElement, ReactNode } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@qticaret/admin-ui/ui/tooltip"

/** Opens soon after the pointer settles: quicker than the browser's own `title`. */
export const HINT_DELAY_MS = 150
/** Within this long of one hint closing, the next one opens at once. */
export const HINT_SKIP_MS = 400

const HintScope = createContext(false)

/**
 * The editor's one tooltip clock: a hint opens after a short wait, and the
 * next one along opens at once, while one is still showing or just closed.
 */
export function HintProvider({ children }: { children: ReactNode }) {
  // Not hoverable: a hint closes as the pointer leaves its element. Otherwise
  // leaving toward the words (out over the preview's iframe, which swallows
  // the pointer) left the hint stuck open on the preview
  return (
    <TooltipProvider
      delayDuration={HINT_DELAY_MS}
      skipDelayDuration={HINT_SKIP_MS}
      disableHoverableContent
    >
      <HintScope.Provider value>{children}</HintScope.Provider>
    </TooltipProvider>
  )
}

type HintProps = {
  /** The words; none leaves the element as it is. */
  label: string | null | undefined
  children: ReactElement
  /**
   * Also tie the words to the element as its description, for screen readers
   * and touch screens, where a tooltip never shows (use when the element's
   * name says something else).
   */
  describe?: boolean
  /**
   * Hang the hint on a span around the element, so it still shows while the
   * element is disabled (a disabled button takes no pointer events; the
   * panel's buttons let them through to the span).
   */
  wrap?: boolean
} & Pick<ComponentProps<typeof TooltipContent>, "side" | "align" | "sideOffset">

/**
 * A tooltip on hover and keyboard focus, in place of the browser's `title`:
 * sooner, a size larger and in the panel's colours. Escape closes it. An
 * icon-only control keeps its own `aria-label`; the hint is only shown.
 */
export function Hint({
  label,
  children,
  describe = false,
  wrap = false,
  side = "top",
  align = "center",
  sideOffset = 6,
}: HintProps) {
  const scoped = useContext(HintScope)
  const id = useId()
  if (!label) {
    return children
  }
  const described = describe ? { "aria-describedby": id } : {}
  const hint = (
    <>
      <Tooltip>
        {wrap ? (
          <TooltipTrigger asChild>
            {/* The description stays on the element itself, not the span */}
            <span className="inline-flex">{cloneElement(children, described)}</span>
          </TooltipTrigger>
        ) : (
          <TooltipTrigger asChild {...described}>
            {children}
          </TooltipTrigger>
        )}
        <TooltipContent
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          className="max-w-xs px-3 py-2 text-sm leading-snug"
        >
          {label}
        </TooltipContent>
      </Tooltip>
      {describe ? (
        <span id={id} className="sr-only">
          {label}
        </span>
      ) : null}
    </>
  )
  // Outside the editor's shell (a lone form, a test) it keeps its own clock
  return scoped ? hint : <HintProvider>{hint}</HintProvider>
}
