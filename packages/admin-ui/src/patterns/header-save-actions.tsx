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
 * The page's one save, in its header (docs/06 "Ürün sayfası"; the owner
 * 2026-11-26, WordPress's "Güncelle"): "Kaydet" is the header's primary
 * button, always there and resting as "Kaydedildi" while nothing has
 * changed. While any card holds unsaved changes, "Vazgeç" (asked first)
 * stands beside it and "n bölümde değişiklik" is read out to screen readers
 * only (never drawn, the header row stays short); "Kaydet" saves
 * each card through its own save, the cards keep their own buttons too.
 * ⌘S / Ctrl+S is "Kaydet" on the page (never the browser's save), and
 * leaving the page with changes asks first. Outside a page with a dirty
 * registry it draws nothing.
 */
export function HeaderSaveActions() {
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
  const changed = dirty > 0
  return (
    <div
      role="group"
      aria-label={t("headerSave.label")}
      data-header-save=""
      className="flex items-center gap-2"
    >
      {/* Read out as it changes, never drawn: the header row stays short (the owner 2026-11-26) */}
      <p aria-live="polite" className="sr-only">
        {changed ? t("headerSave.changes", { count: dirty }) : null}
      </p>
      {changed ? (
        <Button
          type="button"
          variant="cancel"
          disabled={saving}
          onClick={() => {
            setAsking(true)
          }}
        >
          {t("common.cancel")}
        </Button>
      ) : null}
      <Button
        type="button"
        disabled={!changed || saving}
        aria-keyshortcuts="Meta+S Control+S"
        onClick={() => {
          registry.submitAll()
        }}
      >
        {saving ? <Loader2 className="animate-spin" /> : null}
        {changed || saving ? t("common.save") : t("headerSave.saved")}
      </Button>
      <LeaveGuard when={changed && !saving} />
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
    </div>
  )
}
