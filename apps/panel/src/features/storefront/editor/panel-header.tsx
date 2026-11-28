import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useContext, useId, useLayoutEffect, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { FieldHints } from "@qticaret/admin-ui/hooks/use-field-hints"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { EditorChromeContext } from "./editor-layout"
import { GroupMarkContext, useGroupMarks } from "./group-mark"
import { SettingsLayoutContext } from "./settings-layout-state"
import { Hint } from "./shared/hint"

const P = "storefront.editor.panel"

/** A step before the open panel in its breadcrumb: a press goes back to it. */
export interface Crumb {
  label: string
  onSelect: () => void
}

// A crumb is a quiet link, as tall as the back button beside it (a row's controls are level);
// the keyboard shows its thin outline, a pointer none (docs/18)
const CRUMB =
  "inline-flex h-8 min-w-0 max-w-[10rem] shrink items-center rounded-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none [html:not([data-input=pointer])_&:focus-visible]:outline-2 [html:not([data-input=pointer])_&:focus-visible]:outline-ring"

/**
 * A settings panel (a section's, or the theme's), named by its title: its
 * header held at the top while it scrolls, with the way back one step and
 * the breadcrumb to where it stands ("Ana sayfa › Kayan bant"), each step
 * a way back to it (the owner, 2026-11-27: one side panel whose content
 * swaps). The groups' titles stick right under the header.
 */
export function Panel({
  icon: Icon,
  title,
  onBack,
  back,
  trail = [],
  children,
}: {
  icon?: LucideIcon
  title: string
  onBack: () => void
  /** Where the back button goes, when not to the page's parts (a part's panel back to its section). */
  back?: string
  /** The steps between the page's parts and this panel (a footer row's: the footer). */
  trail?: readonly Crumb[]
  children: ReactNode
}) {
  const { t } = useTranslation()
  const { root, toList } = useContext(EditorChromeContext)
  const id = useId()
  const crumbs: Crumb[] = [...(root ? [{ label: root, onSelect: toList }] : []), ...trail]
  return (
    <div
      role="region"
      aria-labelledby={id}
      // A field the settings search picked is marked for a moment (`use-field-focus.ts`)
      className="flex flex-col [--editor-panel-head:3.25rem] [&_[data-highlight]]:rounded-md [&_[data-highlight]]:ring-2 [&_[data-highlight]]:ring-ring [&_[data-highlight]]:ring-offset-4 [&_[data-highlight]]:ring-offset-card"
    >
      <div className="sticky top-0 z-10 flex h-[var(--editor-panel-head)] shrink-0 items-center gap-2 border-b bg-card px-3">
        <Hint label={back ?? t(`${P}.back`)} side="bottom" align="start">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={back ?? t(`${P}.back`)}
            onClick={onBack}
          >
            <ArrowLeft />
          </Button>
        </Hint>
        <nav aria-label={t(`${P}.trail`)} className="flex min-w-0 flex-1 items-center">
          <ol className="flex min-w-0 flex-1 items-center gap-1 text-sm">
            {crumbs.map((crumb) => (
              <li key={crumb.label} className="flex min-w-0 shrink items-center gap-1">
                <button type="button" className={CRUMB} onClick={crumb.onSelect}>
                  <span className="truncate">{crumb.label}</span>
                </button>
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </li>
            ))}
            <li aria-current="page" className="flex min-w-0 flex-1 items-center gap-1.5">
              {Icon ? (
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : null}
              {/* Where the keyboard lands when the panel opens (`editor-shell.tsx`): not the
                  back button, whose hint would take the first Escape */}
              <h2
                id={id}
                tabIndex={-1}
                data-panel-title
                className="min-w-0 truncate text-sm font-semibold outline-none"
              >
                {title}
              </h2>
            </li>
          </ol>
        </nav>
      </div>
      {/* Every field's help text as a small (i) beside its name (docs/18 §7.1) */}
      <FieldHints style="tip">{children}</FieldHints>
    </div>
  )
}

/** A group header's title button over the whole row, as before an (i) stood in it. */
const WHOLE_ROW =
  "flex h-11 w-full items-center justify-between gap-2 px-5 text-left text-sm font-semibold hover:bg-muted/60"

/**
 * The title button beside an (i): its `::before` covers the row (a press
 * anywhere on it folds the group), drawn under the words, and carries the
 * hover and the keyboard outline the row had.
 */
const STRETCHED =
  "flex min-w-0 items-center gap-2 text-left text-sm font-semibold before:absolute before:inset-0 before:-z-10 hover:before:bg-muted/60 focus-visible:outline-none [html:not([data-input=pointer])_&:focus-visible]:before:outline-2 [html:not([data-input=pointer])_&:focus-visible]:before:-outline-offset-2 [html:not([data-input=pointer])_&:focus-visible]:before:outline-ring"

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform",
        open && "rotate-180",
        className
      )}
    />
  )
}

/**
 * A group of a panel's fields that folds away: its title held under the
 * panel's header while its fields scroll past, open at first unless it is
 * the "fine settings" kind (`defaultOpen`). `reveal` opens it each time it
 * changes: the settings search found a field in it.
 */
export function PanelGroup({
  name,
  title,
  hint,
  marked,
  children,
  className,
  defaultOpen = true,
  reveal = null,
}: {
  /**
   * Its name in the panel's tabs (`panel-groups.ts`): inside a
   * `SettingsLayout` it stands in its tab, closed at first, and opens as
   * the layout says; outside one (or with no name) it folds on its own.
   */
  name?: string
  title: string
  hint?: string | undefined
  /**
   * How many of its settings are off their defaults: a small mark beside the
   * title. Not given: its fields showing "Varsayılana dön" (`group-mark.ts`).
   */
  marked?: number | undefined
  children: ReactNode
  className?: string
  defaultOpen?: boolean
  reveal?: number | null
}) {
  const { t } = useTranslation()
  const layout = useContext(SettingsLayoutContext)
  // A group with no name still stands in a layout: in "İçerik", under its own title
  const key = name ?? `untitled:${title}`
  const [ownOpen, setOwnOpen] = useState(defaultOpen || reveal !== null)
  const [revealed, setRevealed] = useState(reveal)
  if (reveal !== revealed) {
    setRevealed(reveal)
    if (reveal !== null) {
      setOwnOpen(true)
    }
  }
  const register = layout?.register
  useLayoutEffect(() => register?.(key), [register, key])
  const mark = layout?.mark
  const marks = useGroupMarks()
  // The form's own count where it gives one, else its fields' "Varsayılana dön"
  const count = marked ?? marks.count
  useLayoutEffect(() => (count > 0 ? mark?.(key, count) : undefined), [mark, key, count])
  const open = layout ? layout.isOpen(key) : ownOpen
  const lone = layout ? layout.isLone(key) : false
  const shown = layout ? layout.isShown(key) : true
  const id = useId()
  return (
    <div
      role="group"
      aria-labelledby={`${id}-name`}
      data-panel-group={layout ? key : (name ?? "")}
      hidden={!shown}
      className="border-b last:border-b-0"
    >
      {lone ? (
        // Alone in its tab: nothing to fold, its name kept for the screen reader and the search
        <h3 id={`${id}-title`} className="sr-only">
          <span id={`${id}-name`} data-panel-group-title>
            {title}
          </span>
        </h3>
      ) : (
        <h3
          id={`${id}-title`}
          className={cn(
            "sticky top-[calc(var(--editor-panel-head)+var(--editor-panel-tabs,0px))] z-[5] bg-card",
            // The (i) beside the title is a button of its own: the title's button stretches
            // over the row (its `::before`), the (i) stands above it
            hint && "flex h-11 items-center gap-2 px-5"
          )}
        >
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            aria-describedby={hint ? `${id}-hint` : undefined}
            onClick={() => {
              if (layout) {
                layout.toggle(key)
              } else {
                setOwnOpen((was) => !was)
              }
            }}
            className={hint ? STRETCHED : WHOLE_ROW}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span id={`${id}-name`} data-panel-group-title className="truncate">
                {title}
              </span>
              {count > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-medium text-accent-foreground">
                  <span aria-hidden="true">{count}</span>
                  <span className="sr-only">{`, ${t(`${P}.marked`, { count })}`}</span>
                </span>
              ) : null}
            </span>
            {hint ? null : <Chevron open={open} />}
          </button>
          {hint ? (
            <>
              <InfoTip name={title} hint={hint} hintId={`${id}-hint`} />
              <Chevron open={open} className="pointer-events-none ml-auto" />
            </>
          ) : null}
        </h3>
      )}
      {hint && !lone ? <HiddenHint id={`${id}-hint`}>{hint}</HiddenHint> : null}
      <div
        id={`${id}-body`}
        data-panel-group-body
        hidden={!open}
        className={cn("@container flex flex-col gap-5 px-5 pt-1 pb-6", lone && "pt-5", className)}
      >
        {/* Alone in its tab there is no title to hang the (i) on: the words stay */}
        {hint && lone ? <p className="-mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        <GroupMarkContext.Provider value={marks.note}>{children}</GroupMarkContext.Provider>
      </div>
    </div>
  )
}
