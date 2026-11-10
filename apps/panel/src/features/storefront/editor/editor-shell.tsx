import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@qticaret/admin-ui/ui/sheet"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { EditorChromeContext } from "./editor-layout"
import type { EditorLayout, EditorView } from "./editor-layout"

const E = "storefront.editor"

// A column of the editor: its own scroll, the card surface, a line to its right
const COLUMN = "flex min-h-0 shrink-0 flex-col overflow-y-auto overscroll-contain bg-card"

interface EditorShellProps {
  layout: EditorLayout
  /** The narrow editor's choice between the settings and the preview. */
  view: EditorView
  /** The page's parts. */
  tree: ReactNode
  /** The open part's settings (a section's, or the theme's). */
  form: ReactNode
  /** Which settings are open, null for none: another one starts at its top and closes the drawer. */
  formKey: string | null
  preview: ReactNode
}

/**
 * The editor below its top bar, as wide as the window allows: the page's
 * parts, the open part's settings and the preview side by side on a wide
 * screen (the preview takes the settings' room while none is open); the
 * settings beside the preview, the parts in a drawer, on a laptop; one of
 * the two at a time on a tablet or phone. What is hidden stays mounted, so
 * a half-filled form survives a look at the preview.
 */
export function EditorShell({ layout, view, tree, form, formKey, preview }: EditorShellProps) {
  const { t } = useTranslation()
  const [drawer, setDrawer] = useState(false)
  // A part picked (from the drawer or elsewhere) closes the drawer
  const [shownKey, setShownKey] = useState(formKey)
  if (shownKey !== formKey) {
    setShownKey(formKey)
    setDrawer(false)
  }
  const wide = layout === "wide"
  const open = formKey !== null
  const chrome = useMemo(
    () => ({
      openSections:
        wide || !open
          ? null
          : () => {
              setDrawer(true)
            },
    }),
    [wide, open]
  )
  const narrow = layout === "narrow"
  return (
    <EditorChromeContext.Provider value={chrome}>
      <main className="flex min-h-0 flex-1">
        {wide ? (
          <div
            data-editor-column="parts"
            className={cn(COLUMN, "w-[clamp(17rem,20vw,20rem)] border-r")}
          >
            {tree}
          </div>
        ) : null}
        {wide && open ? (
          <div
            key={formKey}
            data-editor-column="settings"
            className={cn(COLUMN, "w-[clamp(24rem,30vw,30rem)] border-r")}
          >
            {form}
          </div>
        ) : null}
        {wide ? null : (
          <div
            key={formKey ?? "parts"}
            data-editor-column="settings"
            hidden={narrow && view === "preview"}
            className={cn(COLUMN, narrow ? "w-full" : "w-[clamp(22rem,36vw,26rem)] border-r")}
          >
            {open ? form : tree}
          </div>
        )}
        <div
          data-editor-column="preview"
          hidden={narrow && view === "edit"}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {preview}
        </div>
      </main>
      {wide ? null : (
        <Sheet open={drawer && open} onOpenChange={setDrawer}>
          <SheetContent
            side="left"
            className="w-[min(20rem,calc(100vw-3rem))] gap-0 bg-card p-0 sm:max-w-none"
          >
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="text-sm">{t(`${E}.drawer.title`)}</SheetTitle>
              <SheetDescription className="text-xs">
                {t(`${E}.drawer.description`)}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">{tree}</div>
          </SheetContent>
        </Sheet>
      )}
    </EditorChromeContext.Provider>
  )
}
