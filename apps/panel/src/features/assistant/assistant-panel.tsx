import { useId, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent } from "react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@qticaret/admin-ui/hooks/use-mobile"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@qticaret/admin-ui/ui/sheet"
import { AssistantChat } from "./assistant-chat"
import { useAssistant } from "./assistant-state"
import { WIDTH_MAX, WIDTH_MIN, clampWidth, loadWidth, saveWidth } from "./storage"

const STEP = 16

/**
 * The assistant beside the page (adr/0079 §9). On a computer a column on
 * the right that pushes the page aside, never over it, as wide as its
 * handle leaves it (320–640 px, remembered in the browser); a page
 * change leaves it open. On a phone (< 768 px) a full-screen dialog;
 * closing it returns to the screen below. Nothing while closed or with
 * the shop's flag off.
 */
export function AssistantPanel() {
  const { t } = useTranslation()
  const assistant = useAssistant()
  const mobile = useIsMobile()
  const titleId = useId()
  if (!assistant.enabled) {
    return null
  }
  if (mobile) {
    return (
      <Sheet open={assistant.open} onOpenChange={assistant.setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 p-0 sm:max-w-none"
        >
          <AssistantChat
            titleId={titleId}
            title={
              <SheetTitle className="flex-1 text-[15px] font-semibold">
                {t("ai.assistant.title")}
              </SheetTitle>
            }
          />
          <SheetDescription className="sr-only">{t("ai.assistant.emptyText")}</SheetDescription>
        </SheetContent>
      </Sheet>
    )
  }
  return assistant.open ? <SidePanel titleId={titleId} /> : null
}

function SidePanel({ titleId }: { titleId: string }) {
  const { t } = useTranslation()
  const [width, setWidth] = useState(loadWidth)
  const drag = useRef<{ x: number; width: number } | null>(null)

  const change = (next: number) => {
    const clamped = clampWidth(next)
    setWidth(clamped)
    saveWidth(clamped)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, width }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      // The handle is on the panel's left edge: moving left widens it
      setWidth(clampWidth(drag.current.width + drag.current.x - event.clientX))
    }
  }
  const onPointerUp = () => {
    if (drag.current) {
      drag.current = null
      saveWidth(width)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const by: Record<string, number> = {
      ArrowLeft: STEP,
      ArrowRight: -STEP,
      Home: WIDTH_MAX - width,
      End: WIDTH_MIN - width,
    }
    const delta = by[event.key]
    if (delta !== undefined) {
      event.preventDefault()
      change(width + delta)
    }
  }

  return (
    <aside
      aria-labelledby={titleId}
      style={{ width }}
      className="sticky top-0 flex h-svh shrink-0 self-start border-l bg-card text-card-foreground"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("ai.assistant.resize")}
        aria-valuemin={WIDTH_MIN}
        aria-valuemax={WIDTH_MAX}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none outline-none hover:bg-primary/20 focus-visible:bg-primary/30"
      />
      <div className="min-w-0 flex-1">
        <AssistantChat titleId={titleId} />
      </div>
    </aside>
  )
}
