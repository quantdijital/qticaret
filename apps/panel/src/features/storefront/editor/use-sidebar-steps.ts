import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { EditorChrome } from "./editor-layout"
import type { EditorPage } from "./editor-page"
import type { Opened } from "./opened"

interface SidebarSteps {
  /** What a settings panel's header leads back to (its breadcrumb's first step). */
  chrome: EditorChrome
  /** The section marked in the list: the open one, else the one last opened. */
  marked: string | null
  /** One step up (Escape): a footer row to its footer, a part to the list; null at the list. */
  up: (() => void) | null
}

/**
 * The side panel's steps (the owner, 2026-11-27: one side panel whose
 * content swaps): the page's parts, a part's settings, a footer row's
 * settings; how each leads back, and the row left marked on the way.
 */
export function useSidebarSteps({
  opened,
  setOpened,
  found,
  root,
  page,
  formKey,
}: {
  opened: Opened
  setOpened: (opened: Opened) => void
  /** The open section's id, as found in the draft. */
  found: string | null
  /** The content page's title, when one is edited. */
  root: string | null
  page: EditorPage
  formKey: string | null
}): SidebarSteps {
  const { t } = useTranslation()
  const [marked, setMarked] = useState<string | null>(null)
  if (found !== null && found !== marked) {
    setMarked(found)
  }
  const chrome = useMemo(
    () => ({
      root: root ?? t(`storefront.editor.page.${page}`),
      toList: () => {
        setOpened(null)
      },
    }),
    [root, page, t, setOpened]
  )
  const part = opened?.kind === "section" && opened.part ? opened.id : null
  const up =
    formKey === null
      ? null
      : () => {
          setOpened(part === null ? null : { kind: "section", id: part })
        }
  return { chrome, marked: found ?? marked, up }
}
