import { useIsMutating, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { LAYOUT_ACTION_KEY, layoutQuery } from "@/features/storefront/api/layout"
import type { AdminLayout, AnySection, LayoutDocument } from "@/features/storefront/api/layout"
import { editorReducer, initialEditorState } from "@/features/storefront/layout/editor-state"
import { documentProblems } from "@/features/storefront/layout/problems"
import { findSection } from "@/features/storefront/layout/sections"
import { useAutosave } from "@/features/storefront/layout/use-autosave"
import { sayDroppedPages } from "./dropped-pages"
import {
  OpenedSectionContext,
  SectionHoverContext,
  editorLayoutNow,
  useEditorLayout,
} from "./editor-layout"
import type { EditorView } from "./editor-layout"
import { EditorShell } from "./editor-shell"
import { EditorTree } from "./editor-tree"
import { SectionChooser } from "./section-chooser"
import type { Adding } from "./section-chooser"
import { useEditorSidebar } from "./editor-sidebar"
import { EditorTopBar } from "./editor-top-bar"
import { OpenedForm } from "./opened-form"
import { formKeyOf, openedAtFirst } from "./opened"
import type { OpenAtFirst } from "./opened"
import type { Opened } from "./opened"
import type { Device } from "./preview-fit"
import { PreviewFrame } from "./preview-frame"
import { DraftTools, PublishButton } from "./publish-controls"
import { LooksMenu } from "./looks-menu"
import { SamplePicker } from "./sample-picker"
import { SaveStatus } from "./save-status"
import { sectionLabel } from "./section-meta"
import { useContentPageEditing } from "./use-content-page-editing"
import { useEditorActions } from "./use-editor-actions"
import { useEditorExit } from "./use-editor-exit"
import { useEditorPlace } from "./use-editor-place"
import { useEditorPreview } from "./use-editor-preview"
import { useUndoKeys } from "./use-undo-keys"

const E = "storefront.editor"

/**
 * The theme editor (adr/0049): full screen, the page's parts, the open
 * part's settings and the storefront itself, laid out as the window allows
 * (`EditorShell`). Every change is kept here with its history and saved to
 * the draft once typing pauses (a change made in one go at once); the
 * preview redraws in place after each save (adr/0065);
 * "Yayınla" puts the draft live.
 */
export function ThemeEditor({
  layout,
  openAtFirst = null,
  content = null,
  onContent = content !== null,
}: {
  layout: AdminLayout
  /** A panel the address asks for (`?open=preferences`; the content page's settings or new text). */
  openAtFirst?: OpenAtFirst
  /** A content page the address asks for (`?icerik=`, adr/0073 §5). */
  content?: string | null
  /** Opened on the content pages (`?sayfa=icerik`). */
  onContent?: boolean
}) {
  const { t } = useTranslation()
  const [state, dispatch] = useReducer(editorReducer, layout.draft, initialEditorState)
  const { doc } = state
  const live = useQuery(layoutQuery()).data ?? layout
  // A colour change is judged against the draft as stored (adr/0062 §6)
  const savedTheme = live.draft.settings.theme
  const problems = useMemo(() => documentProblems(doc, savedTheme), [doc, savedTheme])
  // Publishing, discarding or restoring: the autosave waits for it
  const acting = useIsMutating({ mutationKey: LAYOUT_ACTION_KEY }) > 0
  const autosave = useAutosave({
    doc,
    // Never saved: the default design is saved at once, so the preview has a draft
    stored: layout.is_default ? null : layout.draft,
    blocked: problems.size > 0 || acting,
    // Content pages deleted since: their layouts leave the editor too (adr/0073 §1)
    onDropped: (ids, count) => {
      dispatch({ type: "drop-pages", ids })
      sayDroppedPages(t, count)
    },
  })
  const [opened, setOpened] = useState<Opened>(() => openedAtFirst(openAtFirst, content))
  // Each pick of the settings search a fresh number: the same field picked again is shown again
  const picks = useRef(0)
  // The page worked on and shown; a link followed in the preview may change it (adr/0065 Faz 2)
  const place = useEditorPlace({
    content,
    onContent,
    onPageChange: () => {
      setOpened(null)
    },
  })
  const { page, target } = place
  // The chooser is open for this side of a category page's products (the others have one)
  const [adding, setAdding] = useState<Adding | null>(null)
  const shape = useEditorLayout()
  const [view, setView] = useState<EditorView>("edit")
  // A phone's preview starts as a phone; a wider screen's as a desktop
  const [device, setDevice] = useState<Device>(() =>
    editorLayoutNow() === "narrow" ? "mobile" : "desktop"
  )
  const { preview, act, notice, markNew, hover, announce } = useEditorPreview({
    doc,
    page: place.shown,
    path: target.path,
    draftPage: place.draftPage,
    finding: target.finding,
    opened,
    ready: !layout.is_default || autosave.round > 0,
    round: autosave.round,
    dispatch,
    hurry: autosave.hurry,
    visited: place.visited,
    problems,
    onOpen: (id, field) => {
      // A field's label (Faz 2b): its group opens and the field is shown, as a search hit's
      picks.current += 1
      const focus = field ? { ...field, nonce: picks.current } : undefined
      // A free rows footer's block or row opens its own panel (adr/0070 §6)
      const part = field?.part
      setOpened({ kind: "section", id, ...(focus ? { focus } : {}), ...(part ? { part } : {}) })
      // On a phone the preview hides the form: the edit label brings the form up
      setView("edit")
      // Folded, the side panel comes back with the settings asked for
      sidebar.show()
    },
    onVisit: place.visit,
    onLand: place.land,
  })
  // A content page shown with its text as sections when the design has none for it (adr/0073 Ek 2)
  const fresh = openAtFirst === "new-page" ? content : null
  const pages = useContentPageEditing({ doc, place, act, setOpened, fresh })
  const shownDoc = pages.view
  const actions = useEditorActions({
    flush: autosave.flush,
    page: target.path,
    draftPage: place.draftPage,
    onLoaded: (next: LayoutDocument) => {
      dispatch({ type: "load", doc: next })
      autosave.reset(next)
    },
  })
  const undo = () => {
    act({ type: "undo" })
  }
  const redo = () => {
    act({ type: "redo" })
  }
  useUndoKeys(undo, redo)

  const started = useRef(false)
  useEffect(() => {
    if (layout.is_default && !started.current) {
      started.current = true
      void autosave.flush()
    }
  }, [layout.is_default, autosave])

  const exit = useEditorExit(autosave.flush)
  const remove = (section: AnySection) => {
    const inFooter = findSection(shownDoc, section.id)?.group === "footer"
    const { name } = sectionLabel(t, section, inFooter)
    pages.act({ type: "remove", id: section.id })
    setOpened(null)
    toast.success(t(`${E}.row.removed`, { name }), {
      action: { label: t(`${E}.undo`), onClick: undo },
    })
  }
  const found = opened?.kind === "section" ? findSection(shownDoc, opened.id) : null
  const changed = live.has_changes || autosave.dirty

  const form = (
    <OpenedForm
      opened={opened}
      found={found}
      doc={shownDoc}
      problems={problems}
      dispatch={pages.act}
      onUndo={undo}
      onRemove={remove}
      onClose={() => {
        setOpened(null)
      }}
      onOpenSection={(id) => {
        setOpened({ kind: "section", id })
      }}
      onPageDeleted={pages.onPageDeleted}
    />
  )
  const formKey = formKeyOf(opened, found ? found.section.id : null)
  const sidebar = useEditorSidebar(formKey, shape !== "narrow")
  const tree = (
    <EditorTree
      doc={shownDoc}
      page={page}
      shown={place.shown}
      contentPage={pages.contentPage}
      problems={problems}
      act={pages.act}
      opened={opened}
      setOpened={setOpened}
      nextPick={() => {
        picks.current += 1
        return picks.current
      }}
      onRemove={remove}
      onAdding={setAdding}
      showSidebar={sidebar.show}
    />
  )
  const tools = (
    <>
      <LooksMenu
        actions={actions}
        revisions={live.revisions}
        live={live.revision}
        changed={changed}
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
        onPage={place.choosePage}
        pagePicker={pages.picker}
        view={view}
        onView={setView}
        sidebar={sidebar.shown}
        onSidebar={sidebar.toggle}
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
        publish={
          <PublishButton
            actions={actions}
            changed={changed}
            doc={doc}
            editing={place.contentPage.id}
          />
        }
      />
      <OpenedSectionContext.Provider value={found ? found.section.id : null}>
        <SectionHoverContext.Provider value={hover}>
          <EditorShell
            layout={shape}
            view={view}
            sidebar={sidebar.shown}
            tree={tree}
            form={form}
            formKey={formKey}
            preview={
              <PreviewFrame
                preview={preview}
                device={device}
                onDevice={setDevice}
                sample={
                  page === "home" || page === "content" ? null : (
                    <SamplePicker page={page} sample={target.sample} onChange={target.choose} />
                  )
                }
                missing={target.missing}
                notice={notice}
                announce={announce}
                finding={target.finding}
              />
            }
          />
        </SectionHoverContext.Provider>
      </OpenedSectionContext.Provider>
      <SectionChooser
        doc={shownDoc}
        page={page}
        content={place.contentPage.id}
        adding={adding}
        act={pages.act}
        onClose={() => {
          setAdding(null)
        }}
        onAdded={(id) => {
          markNew(id)
          setAdding(null)
          setOpened({ kind: "section", id })
        }}
      />
      <LeaveGuard when={autosave.dirty} />
    </div>
  )
}
