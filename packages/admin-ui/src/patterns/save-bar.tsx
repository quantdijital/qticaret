import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { ConfirmDialog } from "./confirm-dialog"
import { useDirtyRegistry } from "./dirty-registry"
import { LeaveGuard } from "./leave-guard"

// Inside a dialog (a variant's), ⌘S is that form's business, not the page's
const inDialog = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest("[role=dialog], [role=alertdialog]") !== null

/**
 * The page's one save bar (docs/06 "Ürün sayfası"): while any card holds
 * unsaved changes, a bar held at the window's bottom says so, "Vazgeç"
 * lets all of them go (asked first) and "Kaydet" saves each through its
 * own save; the cards keep their own buttons too. ⌘S / Ctrl+S is
 * "Kaydet" on the page (never the browser's save), and leaving the page
 * with changes asks first.
 */
export function SaveBar() {
  const { t } = useTranslation(ADMIN_UI_NS)
  const registry = useDirtyRegistry()
  const [asking, setAsking] = useState(false)
  const dirty = registry?.now.dirty ?? 0
  const saving = registry?.now.saving ?? false
  useEffect(() => {
    if (!registry) {
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (
        typeof event.key !== "string" ||
        event.key.toLowerCase() !== "s" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        inDialog(event.target)
      ) {
        return
      }
      event.preventDefault()
      registry.submitAll()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [registry])
  if (!registry) {
    return null
  }
  return (
    <>
      <LeaveGuard when={dirty > 0 && !saving} />
      {dirty > 0 || saving ? (
        <div
          role="region"
          aria-label={t("saveBar.label")}
          data-save-bar=""
          className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3 shadow-lg"
        >
          <p className="text-sm font-medium" aria-live="polite">
            {t("saveBar.text", { count: dirty })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="cancel"
              size="sm"
              disabled={saving}
              onClick={() => {
                setAsking(true)
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              aria-keyshortcuts="Meta+S Control+S"
              onClick={() => {
                registry.submitAll()
              }}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("formDialog.discardTitle")}
        description={t("formDialog.discardText")}
        confirmLabel={t("formDialog.discard")}
        destructive
        onConfirm={() => {
          setAsking(false)
          registry.resetAll()
        }}
      />
    </>
  )
}
