import type { AnySection, LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { SETTINGS_KEY, partOf } from "@/features/storefront/layout/settings-problems"
import { EditorNotices } from "./editor-notices"
import type { EditorPage, ShownPage } from "./editor-page"
import type { Opened } from "./opened"
import type { Adding } from "./section-chooser"
import { SectionTree } from "./section-tree"
import { SettingsSearch } from "./settings-search-panel"

interface EditorTreeProps {
  doc: LayoutDocument
  page: EditorPage
  /** The page shown, as the settings search tells its sections from others'. */
  shown: ShownPage
  /** The content page picked (`page: "content"`, adr/0073 §5). */
  contentPage: { id: string | null; title: string | null; contact: boolean }
  problems: Map<string, SectionProblems>
  act: (action: EditorAction) => void
  opened: Opened
  setOpened: (opened: Opened) => void
  /** Each pick of the settings search a fresh number: the same field picked again is shown again. */
  nextPick: () => number
  onRemove: (section: AnySection) => void
  onAdding: (adding: Adding) => void
  /** The side panel shown again (folded, it comes back with a part asked for). */
  showSidebar: () => void
}

/**
 * The theme editor's list side (adr/0049): the notices, the settings
 * search and, while nothing is typed, the page's parts; each pick opens
 * its panel.
 */
export function EditorTree({
  doc,
  page,
  shown,
  contentPage,
  problems,
  act,
  opened,
  setOpened,
  nextPick,
  onRemove,
  onAdding,
  showSidebar,
}: EditorTreeProps) {
  const settingsProblems = Object.keys(problems.get(SETTINGS_KEY) ?? {})
  return (
    <>
      <EditorNotices
        pendingMenus={doc.settings.menus}
        onDropMenus={() => {
          act({ type: "settings", settings: { ...doc.settings, menus: null } })
        }}
      />
      <SettingsSearch
        doc={doc}
        page={shown}
        onPick={(hit) => {
          const nonce = nextPick()
          if ("theme" in hit) {
            const { target, group } = hit.field
            setOpened({ kind: "theme", focus: { target, group, nonce } })
            return
          }
          const { section, field } = hit
          const focus = field ? { target: field.target, group: field.group, nonce } : undefined
          const part = field?.part
          setOpened({
            kind: "section",
            id: section.id,
            ...(focus ? { focus } : {}),
            ...(part ? { part } : {}),
          })
        }}
      >
        <SectionTree
          page={page}
          contentPage={contentPage}
          onOpenText={() => {
            if (contentPage.id !== null) {
              setOpened({ kind: "page-text", page: contentPage.id, contact: contentPage.contact })
            }
          }}
          doc={doc}
          problems={new Set(problems.keys())}
          dispatch={act}
          onOpen={(id) => {
            setOpened({ kind: "section", id })
          }}
          onRemove={onRemove}
          onAddSection={(placement) => {
            onAdding(placement ?? "bottom")
          }}
          onAddFooterSection={() => {
            onAdding("footer")
          }}
          onTheme={() => {
            setOpened({ kind: "theme" })
          }}
          themeProblem={settingsProblems.some((field) => partOf(field) === "theme")}
          onLooks={() => {
            setOpened({ kind: "looks" })
          }}
          looksProblem={settingsProblems.some((field) => partOf(field) === "looks")}
          onPreferences={() => {
            setOpened({ kind: "preferences" })
          }}
          fieldProblems={problems}
          openedPart={opened?.kind === "section" ? (opened.part?.id ?? null) : null}
          onOpenPart={(id, part) => {
            setOpened({ kind: "section", id, part })
            showSidebar()
          }}
        />
      </SettingsSearch>
    </>
  )
}
