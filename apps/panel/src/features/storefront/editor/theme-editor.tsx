import { useIsMutating, useQuery } from "@tanstack/react-query"
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router"
import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import {
  LAYOUT_ACTION_KEY,
  MARQUEE_LIMITS,
  PRICE_BANDS_LIMITS,
  layoutQuery,
} from "@/features/storefront/api/layout"
import type {
  AdminLayout,
  AnySection,
  LayoutDocument,
  Placement,
} from "@/features/storefront/api/layout"
import { editorReducer, initialEditorState } from "@/features/storefront/layout/editor-state"
import { documentProblems } from "@/features/storefront/layout/problems"
import { SETTINGS_KEY, partOf } from "@/features/storefront/layout/settings-problems"
import {
  findSection,
  idsOf,
  marqueesOn,
  priceBandsOn,
  newBodySection,
  newSectionId,
} from "@/features/storefront/layout/sections"
import { useAutosave } from "@/features/storefront/layout/use-autosave"
import { AddSectionDialog } from "./add-section-dialog"
import {
  OpenedSectionContext,
  SectionHoverContext,
  editorLayoutNow,
  useEditorLayout,
} from "./editor-layout"
import type { EditorView } from "./editor-layout"
import { EditorShell } from "./editor-shell"
import { useEditorSidebar } from "./editor-sidebar"
import { EditorTopBar } from "./editor-top-bar"
import { OpenedForm } from "./opened-form"
import { formKeyOf } from "./opened"
import type { Opened } from "./opened"
import type { Device } from "./preview-fit"
import { EditorNotices } from "./editor-notices"
import { PreviewFrame } from "./preview-frame"
import { DraftTools, PublishButton } from "./publish-controls"
import { LooksMenu } from "./looks-menu"
import { SamplePicker } from "./sample-picker"
import { SaveStatus } from "./save-status"
import { sectionLabel } from "./section-meta"
import { SectionTree } from "./section-tree"
import { SettingsSearch } from "./settings-search-panel"
import { useEditorActions } from "./use-editor-actions"
import { useEditorPreview } from "./use-editor-preview"
import { usePreviewPlace } from "./use-preview-place"
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
}: {
  layout: AdminLayout
  /** A panel the address asks for (`?open=preferences`: the old preferences page's links). */
  openAtFirst?: "preferences" | null
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const navigate = useNavigate()
  const canGoBack = useCanGoBack()
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
  })
  const [opened, setOpened] = useState<Opened>(() => (openAtFirst ? { kind: openAtFirst } : null))
  // Each pick of the settings search a fresh number: the same field picked again is shown again
  const picks = useRef(0)
  // The page worked on and shown; a link followed in the preview may change it (adr/0065 Faz 2)
  const place = usePreviewPlace({
    onPageChange: () => {
      setOpened(null)
    },
  })
  const { page, target } = place
  // The chooser is open for this side of a category page's products (the others have one)
  const [adding, setAdding] = useState<Placement | null>(null)
  const shape = useEditorLayout()
  const [view, setView] = useState<EditorView>("edit")
  // A phone's preview starts as a phone; a wider screen's as a desktop
  const [device, setDevice] = useState<Device>(() =>
    editorLayoutNow() === "narrow" ? "mobile" : "desktop"
  )
  const { preview, act, notice, markNew, hover, announce } = useEditorPreview({
    doc,
    page,
    path: target.path,
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
      setOpened({ kind: "section", id, ...(focus ? { focus } : {}) })
      // On a phone the preview hides the form: the edit label brings the form up
      setView("edit")
      // Folded, the side panel comes back with the settings asked for
      sidebar.show()
    },
    onVisit: place.visit,
    onLand: place.land,
  })
  const actions = useEditorActions({
    flush: autosave.flush,
    page: target.path,
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
    act({ type: "remove", id: section.id })
    setOpened(null)
    toast.success(t(`${E}.row.removed`, { name }), {
      action: { label: t(`${E}.undo`), onClick: undo },
    })
  }
  const found = opened?.kind === "section" ? findSection(doc, opened.id) : null
  const changed = live.has_changes || autosave.dirty

  const form = (
    <OpenedForm
      opened={opened}
      found={found}
      doc={doc}
      problems={problems}
      dispatch={act}
      onUndo={undo}
      onRemove={remove}
      onClose={() => {
        setOpened(null)
      }}
    />
  )
  const formKey = formKeyOf(opened, found ? found.section.id : null)
  const sidebar = useEditorSidebar(formKey, shape !== "narrow")
  const pendingMenus = doc.settings.menus
  const tree = (
    <>
      <EditorNotices
        pendingMenus={pendingMenus}
        onDropMenus={() => {
          act({ type: "settings", settings: { ...doc.settings, menus: null } })
        }}
      />
      <SettingsSearch
        doc={doc}
        page={page}
        onPick={(hit) => {
          picks.current += 1
          if ("theme" in hit) {
            const { target, group } = hit.field
            setOpened({ kind: "theme", focus: { target, group, nonce: picks.current } })
            return
          }
          const { section, field } = hit
          const focus = field
            ? { target: field.target, group: field.group, nonce: picks.current }
            : undefined
          setOpened({ kind: "section", id: section.id, ...(focus ? { focus } : {}) })
        }}
      >
        <SectionTree
          page={page}
          doc={doc}
          problems={new Set(problems.keys())}
          dispatch={act}
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
          themeProblem={Object.keys(problems.get(SETTINGS_KEY) ?? {}).some(
            (field) => partOf(field) === "theme"
          )}
          onLooks={() => {
            setOpened({ kind: "looks" })
          }}
          looksProblem={Object.keys(problems.get(SETTINGS_KEY) ?? {}).some(
            (field) => partOf(field) === "looks"
          )}
          onPreferences={() => {
            setOpened({ kind: "preferences" })
          }}
        />
      </SettingsSearch>
    </>
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
        publish={<PublishButton actions={actions} changed={changed} />}
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
                  page === "home" ? null : (
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
      <AddSectionDialog
        open={adding !== null}
        page={page}
        placement={adding ?? "bottom"}
        marqueeFull={marqueesOn(doc, page) >= MARQUEE_LIMITS.perPage}
        priceBandsFull={priceBandsOn(doc, page) >= PRICE_BANDS_LIMITS.perPage}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(null)
          }
        }}
        onPick={(type) => {
          const id = newSectionId(idsOf(doc))
          const section = newBodySection(page, type, id, adding ?? "bottom")
          markNew(id)
          act({ type: "add", group: page, section })
          setAdding(null)
          setOpened({ kind: "section", id })
        }}
      />
      <LeaveGuard when={autosave.dirty} />
    </div>
  )
}
