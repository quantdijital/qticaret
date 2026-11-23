import { useNavigate } from "@tanstack/react-router"
import { History, LayoutTemplate, Save } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { useCan } from "@/features/auth/api/staff"
import type { LayoutRevision } from "@/features/storefront/api/layout"
import { suggestedName } from "@/features/storefront/gallery/design-name"
import { SaveDesignDialog } from "@/features/storefront/gallery/name-dialog"
import { RevisionsSheet } from "./revisions-sheet"
import type { useEditorActions } from "./use-editor-actions"

const E = "storefront.editor"

interface LooksMenuProps {
  actions: ReturnType<typeof useEditorActions>
  revisions: readonly LayoutRevision[]
  /** The revision on the storefront now. */
  live: number
  /** The draft holds changes a restore would replace. */
  changed: boolean
}

/**
 * The editor's "Görünümler" (adr/0064 Ek 2026-11-17; Shopify's theme
 * menu): keep the draft as a saved look, open the publication history (the
 * safety net: the last 20, kept by themselves), or go to the gallery once
 * what waits is stored. One button, so a phone's bar keeps its room. The
 * looks are the owner's alone (2026-11-23): another role gets the history
 * on its own, without keeping a revision as a look.
 */
export function LooksMenu({ actions, revisions, live, changed }: LooksMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // The looks are the owner's alone (2026-11-23): the others keep the publication history
  const looks = useCan("looks")
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState(false)
  const label = t(`${E}.looks.open`)
  const historyLabel = t(`${E}.revisions.open`)
  return (
    <>
      {looks ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={historyLabel}
          className="max-xl:w-8 max-xl:px-0"
          onClick={() => {
            setHistory(true)
          }}
        >
          <History />
          <span className="max-xl:hidden">{historyLabel}</span>
        </Button>
      )}
      {looks ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={label}
              className="max-xl:w-8 max-xl:px-0"
            >
              <LayoutTemplate />
              <span className="max-xl:hidden">{label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              onSelect={() => {
                setSaving(true)
              }}
            >
              <Save />
              {t(`${E}.looks.save`)}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setHistory(true)
              }}
            >
              <History />
              {t(`${E}.revisions.open`)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void (async () => {
                  // What waits is stored first; one that cannot be is asked about by the guard
                  const stored = await actions.store()
                  void navigate({ to: "/storefront/looks", ignoreBlocker: stored })
                })()
              }}
            >
              <LayoutTemplate />
              {t(`${E}.looks.all`)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <SaveDesignDialog
        open={looks && saving}
        onOpenChange={setSaving}
        initial={suggestedName(t, t("storefront.gallery.save.defaultSource"))}
        before={actions.store}
      />
      <RevisionsSheet
        open={history}
        onOpenChange={setHistory}
        revisions={revisions}
        live={live}
        ask={changed}
        busy={actions.busy}
        onRestore={actions.restore}
        canKeep={looks}
      />
    </>
  )
}
