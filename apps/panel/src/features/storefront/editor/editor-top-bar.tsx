import {
  ArrowLeft,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Redo2,
  Undo2,
} from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Separator } from "@qticaret/admin-ui/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import type { BodyGroup } from "@/features/storefront/api/layout"
import { BarButton } from "./bar-button"
import type { EditorLayout, EditorView } from "./editor-layout"
import { SIDEBAR_ID } from "./editor-sidebar"
import { Hint } from "./shared/hint"

const E = "storefront.editor"

// The page templates the editor covers (adr/0049 §6.3); one not ready yet is not offered
const EDITOR_PAGES: readonly BodyGroup[] = ["home", "product", "category"]

interface EditorTopBarProps {
  layout: EditorLayout
  onExit: () => void
  /** The page being edited. */
  page: BodyGroup
  onPage: (page: BodyGroup) => void
  /** The narrow editor's view: the settings or the preview. */
  view: EditorView
  onView: (view: EditorView) => void
  /** Whether the side panel is shown (1024 px and up; below, the view switch stands for it). */
  sidebar: boolean
  onSidebar: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** Where the draft stands. */
  status: ReactNode
  /** Revisions, discarding and the preview in a tab. */
  tools: ReactNode
  /** Publishing. */
  publish: ReactNode
}

function UndoRedo({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Pick<EditorTopBarProps, "canUndo" | "canRedo" | "onUndo" | "onRedo">) {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0">
      <Hint label={t(`${E}.undo`)} side="bottom" wrap>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canUndo}
          aria-label={t(`${E}.undo`)}
          aria-keyshortcuts="Control+Z Meta+Z"
          onClick={onUndo}
        >
          <Undo2 />
        </Button>
      </Hint>
      <Hint label={t(`${E}.redo`)} side="bottom" wrap>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canRedo}
          aria-label={t(`${E}.redo`)}
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
          onClick={onRedo}
        >
          <Redo2 />
        </Button>
      </Hint>
    </div>
  )
}

/** Folds the side panel away for a bigger preview, and back (⌘\ / Ctrl+\). */
function SidebarToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const label = t(shown ? `${E}.sidebar.hide` : `${E}.sidebar.show`)
  return (
    <Hint label={label} side="bottom" wrap>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        aria-label={label}
        aria-expanded={shown}
        aria-controls={SIDEBAR_ID}
        aria-keyshortcuts="Control+Backslash Meta+Backslash"
        onClick={onToggle}
      >
        {shown ? <PanelLeftClose /> : <PanelLeftOpen />}
      </Button>
    </Hint>
  )
}

/**
 * The editor's bar (Shopify's customizer), on show at every width: out
 * and the page being edited on the left; undo, redo and where the draft
 * stands in the middle; revisions and publishing on the right. Below
 * 1024 px a second row switches between the settings and the preview and
 * holds the tools, so the first keeps the page, the draft's state and
 * "Yayınla" in one line even on a phone.
 */
export function EditorTopBar({
  layout,
  onExit,
  page,
  onPage,
  view,
  onView,
  sidebar,
  onSidebar,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  status,
  tools,
  publish,
}: EditorTopBarProps) {
  const { t } = useTranslation()
  const narrow = layout === "narrow"
  const history = { canUndo, canRedo, onUndo, onRedo }
  return (
    <header className="shrink-0 border-b bg-card">
      <div className="flex h-14 items-center gap-2 px-3 lg:gap-3 lg:px-4">
        <BarButton
          variant="ghost"
          icon={<ArrowLeft />}
          label={t(`${E}.exit`)}
          wideOnly={narrow}
          className="shrink-0"
          onClick={onExit}
        />
        <Separator orientation="vertical" className="h-5 max-md:hidden" />
        {narrow ? null : <SidebarToggle shown={sidebar} onToggle={onSidebar} />}
        <h1 className="shrink-0 text-sm font-semibold max-md:sr-only">{t(`${E}.title`)}</h1>
        <Select
          value={page}
          onValueChange={(next) => {
            onPage(next as BodyGroup)
          }}
        >
          <SelectTrigger size="sm" aria-label={t(`${E}.page.label`)} className="w-40 shrink-0">
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
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:justify-center">
          {narrow ? null : <UndoRedo {...history} />}
          {status}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {narrow ? null : tools}
          {publish}
        </div>
      </div>
      {narrow ? (
        <div className="flex h-12 items-center gap-2 border-t px-3">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label={t(`${E}.view.label`)}
            className="min-w-40 flex-1"
            value={view}
            onValueChange={(next) => {
              if (next) {
                onView(next as EditorView)
              }
            }}
          >
            <ToggleGroupItem value="edit" className="flex-1">
              <PencilLine />
              {t(`${E}.view.edit`)}
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" className="flex-1">
              <Eye />
              {t(`${E}.view.preview`)}
            </ToggleGroupItem>
          </ToggleGroup>
          <UndoRedo {...history} />
          <div className="flex shrink-0 items-center gap-1">{tools}</div>
        </div>
      ) : null}
    </header>
  )
}
