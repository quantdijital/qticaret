import { ArrowLeft, Monitor, Redo2, Smartphone, Undo2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { BodyGroup } from "@/features/storefront/api/layout"
import { BarButton } from "./bar-button"
import type { Device } from "./preview-frame"

const E = "storefront.editor"

// The page templates the editor covers (adr/0049 §6.3); one not ready yet is not offered
const EDITOR_PAGES: readonly BodyGroup[] = ["home", "product", "category"]

interface EditorTopBarProps {
  onExit: () => void
  /** The page being edited, and its sample's picker (a product's or category's page). */
  page: BodyGroup
  onPage: (page: BodyGroup) => void
  sample: ReactNode
  device: Device
  onDevice: (device: Device) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** Where the draft stands. */
  status: ReactNode
  /** Revisions, discard, preview and publish. */
  actions: ReactNode
}

/**
 * The editor's bar (Shopify's customizer): out, the page being edited and
 * the preview's width on the left; undo, redo and where the draft stands
 * in the middle; revisions and publishing on the right. On a narrow
 * screen it wraps rather than scroll.
 */
export function EditorTopBar({
  onExit,
  page,
  onPage,
  sample,
  device,
  onDevice,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  status,
  actions,
}: EditorTopBarProps) {
  const { t } = useTranslation()
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <BarButton
          variant="ghost"
          icon={<ArrowLeft />}
          label={t(`${E}.exit`)}
          wideOnly={false}
          onClick={onExit}
        />
        <Separator orientation="vertical" className="h-5" />
        <h1 className="truncate text-sm font-semibold">{t(`${E}.title`)}</h1>
        <Select
          value={page}
          onValueChange={(next) => {
            onPage(next as BodyGroup)
          }}
        >
          <SelectTrigger size="sm" aria-label={t(`${E}.page.label`)} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_PAGES.map((each) => (
              <SelectItem key={each} value={each}>
                {t(`${E}.page.${each}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sample}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:justify-center">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={t(`${E}.device.label`)}
          className="max-lg:hidden"
          value={device}
          onValueChange={(next) => {
            if (next) {
              onDevice(next as Device)
            }
          }}
        >
          <ToggleGroupItem value="desktop" aria-label={t(`${E}.device.desktop`)}>
            <Monitor />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label={t(`${E}.device.mobile`)}>
            <Smartphone />
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!canUndo}
            aria-label={t(`${E}.undo`)}
            title={t(`${E}.undo`)}
            aria-keyshortcuts="Control+Z Meta+Z"
            onClick={onUndo}
          >
            <Undo2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!canRedo}
            aria-label={t(`${E}.redo`)}
            title={t(`${E}.redo`)}
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
            onClick={onRedo}
          >
            <Redo2 />
          </Button>
        </div>
        {status}
      </div>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  )
}
