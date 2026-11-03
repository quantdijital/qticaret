import { useIsMutating, useQuery } from "@tanstack/react-query"
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router"
import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { LAYOUT_ACTION_KEY, layoutQuery } from "@/features/storefront/api/layout"
import type {
  AdminLayout,
  AnySection,
  BodyGroup,
  LayoutDocument,
  Placement,
} from "@/features/storefront/api/layout"
import { editorReducer, initialEditorState } from "@/features/storefront/layout/editor-state"
import { documentProblems } from "@/features/storefront/layout/problems"
import {
  findSection,
  groupLimit,
  idsOf,
  isBodyGroup,
  newBodySection,
  newSectionId,
} from "@/features/storefront/layout/sections"
import { useAutosave } from "@/features/storefront/layout/use-autosave"
import { AddSectionDialog } from "./add-section-dialog"
import { OpenedSectionContext, editorLayoutNow, useEditorLayout } from "./editor-layout"
import type { EditorView } from "./editor-layout"
import { EditorShell } from "./editor-shell"
import { EditorTopBar } from "./editor-top-bar"
import type { Device } from "./preview-fit"
import { PreviewFrame } from "./preview-frame"
import { DraftTools, PublishButton } from "./publish-controls"
import { RevisionsSheet } from "./revisions-sheet"
import { SamplePicker } from "./sample-picker"
import { SaveStatus } from "./save-status"
import { sectionLabel } from "./section-meta"
import { SectionPanel } from "./section-panel"
import { SectionTree } from "./section-tree"
import { ThemePanel } from "./theme-panel"
import { useEditorActions } from "./use-editor-actions"
import { usePreviewTarget } from "./use-preview-target"
import { useUndoKeys } from "./use-undo-keys"

const E = "storefront.editor"

type Opened = { kind: "section"; id: string } | { kind: "theme" } | null

/**
 * The theme editor (adr/0049): full screen, the page's parts, the open
 * part's settings and the storefront itself, laid out as the window allows
 * (`EditorShell`). Every change is kept here with its history and saved to
 * the draft once typing pauses; the preview reloads after each save;
 * "Yayınla" puts the draft live.
 */
export function ThemeEditor({ layout }: { layout: AdminLayout }) {
  const { t } = useTranslation()
  const router = useRouter()
  const navigate = useNavigate()
  const canGoBack = useCanGoBack()
  const [state, dispatch] = useReducer(editorReducer, layout.draft, initialEditorState)
  const { doc } = state
  const problems = useMemo(() => documentProblems(doc), [doc])
  // Publishing, discarding or restoring: the autosave waits for it
  const acting = useIsMutating({ mutationKey: LAYOUT_ACTION_KEY }) > 0
  const autosave = useAutosave({
    doc,
    // Never saved: the default design is saved at once, so the preview has a draft
    stored: layout.is_default ? null : layout.draft,
    blocked: problems.size > 0 || acting,
  })
  const live = useQuery(layoutQuery()).data ?? layout
  const [opened, setOpened] = useState<Opened>(null)
  const [page, setPage] = useState<BodyGroup>("home")
  // The chooser is open for this side of a category page's products (the others have one)
  const [adding, setAdding] = useState<Placement | null>(null)
  const shape = useEditorLayout()
  const [view, setView] = useState<EditorView>("edit")
  // A phone's preview starts as a phone; a wider screen's as a desktop
  const [device, setDevice] = useState<Device>(() =>
    editorLayoutNow() === "narrow" ? "mobile" : "desktop"
  )
  const target = usePreviewTarget(page)
  // A theme setting saved elsewhere than the draft reloads the preview too
  const [refreshed, setRefreshed] = useState(0)
  const actions = useEditorActions({
    flush: autosave.flush,
    page: target.path,
    onLoaded: (next: LayoutDocument) => {
      dispatch({ type: "load", doc: next })
      autosave.reset(next)
    },
  })
  const undo = () => {
    dispatch({ type: "undo" })
  }
  const redo = () => {
    dispatch({ type: "redo" })
  }
  useUndoKeys(undo, redo)

  const started = useRef(false)
  useEffect(() => {
    if (layout.is_default && !started.current) {
      started.current = true
      void autosave.flush()
    }
  }, [layout.is_default, autosave])

  const exit = async () => {
    // What waits is stored first; a draft that cannot be is asked about by the guard
    const stored = await autosave.flush()
    if (canGoBack) {
      router.history.back({ ignoreBlocker: stored })
    } else {
      void navigate({ to: "/storefront/menus", ignoreBlocker: stored })
    }
  }
  const remove = (section: AnySection) => {
    const inFooter = findSection(doc, section.id)?.group === "footer"
    const { name } = sectionLabel(t, section, inFooter)
    dispatch({ type: "remove", id: section.id })
    setOpened(null)
    toast.success(t(`${E}.row.removed`, { name }), {
      action: { label: t(`${E}.undo`), onClick: undo },
    })
  }
  const found = opened?.kind === "section" ? findSection(doc, opened.id) : null
  const changed = live.has_changes || autosave.dirty

  let form: ReactNode = null
  if (found) {
    form = (
      <SectionPanel
        section={found.section}
        group={found.group}
        problems={problems.get(found.section.id) ?? {}}
        canDuplicate={isBodyGroup(found.group) && doc[found.group].length < groupLimit(found.group)}
        onChange={(section, field) => {
          dispatch({ type: "update", section, merge: field ? `${section.id}:${field}` : undefined })
        }}
        onPlace={(placement) => {
          dispatch({ type: "place", id: found.section.id, placement })
        }}
        onBack={() => {
          setOpened(null)
        }}
        onDuplicate={() => {
          dispatch({ type: "duplicate", id: found.section.id })
        }}
        onRemove={() => {
          remove(found.section)
        }}
      />
    )
  } else if (opened?.kind === "theme") {
    form = (
      <ThemePanel
        announcement={doc.header[0]?.lines.find((line) => line.trim() !== "") ?? null}
        onBack={() => {
          setOpened(null)
        }}
        onSaved={() => {
          setRefreshed((was) => was + 1)
        }}
      />
    )
  }
  const formKey = found ? found.section.id : opened?.kind === "theme" ? "theme" : null
  const tree = (
    <SectionTree
      page={page}
      doc={doc}
      problems={new Set(problems.keys())}
      dispatch={dispatch}
      onOpen={(id) => {
        setOpened({ kind: "section", id })
      }}
      onRemove={remove}
      onAddSection={(placement) => {
        setAdding(placement ?? "bottom")
      }}
      onTheme={() => {
        setOpened({ kind: "theme" })
      }}
    />
  )
  const tools = (
    <>
      <RevisionsSheet
        revisions={live.revisions}
        live={live.revision}
        ask={changed}
        busy={actions.busy}
        onRestore={actions.restore}
      />
      <DraftTools actions={actions} changed={changed} />
    </>
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <EditorTopBar
        layout={shape}
        onExit={() => void exit()}
        page={page}
        onPage={(next) => {
          setPage(next)
          setOpened(null)
        }}
        view={view}
        onView={setView}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        status={
          <SaveStatus
            status={autosave.status}
            dirty={autosave.dirty}
            blocked={problems.size > 0}
            onRetry={autosave.retry}
          />
        }
        tools={tools}
        publish={<PublishButton actions={actions} changed={changed} />}
      />
      <OpenedSectionContext.Provider value={found ? found.section.id : null}>
        <EditorShell
          layout={shape}
          view={view}
          tree={tree}
          form={form}
          formKey={formKey}
          preview={
            <PreviewFrame
              round={autosave.round + refreshed}
              ready={!layout.is_default || autosave.round > 0}
              device={device}
              onDevice={setDevice}
              sample={
                page === "home" ? null : (
                  <SamplePicker page={page} sample={target.sample} onChange={target.choose} />
                )
              }
              page={target.path}
              missing={target.missing}
              finding={target.finding}
            />
          }
        />
      </OpenedSectionContext.Provider>
      <AddSectionDialog
        open={adding !== null}
        page={page}
        placement={adding ?? "bottom"}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(null)
          }
        }}
        onPick={(type) => {
          const id = newSectionId(idsOf(doc))
          const section = newBodySection(page, type, id, adding ?? "bottom")
          dispatch({ type: "add", group: page, section })
          setAdding(null)
          setOpened({ kind: "section", id })
        }}
      />
      <LeaveGuard when={autosave.dirty} />
    </div>
  )
}
