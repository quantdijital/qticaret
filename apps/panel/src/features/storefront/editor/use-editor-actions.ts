import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  fetchLayoutPreview,
  useDiscardLayout,
  usePublishLayout,
  useRestoreRevision,
} from "@/features/storefront/api/layout"
import type { KeptDraft, LayoutDocument } from "@/features/storefront/api/layout"
import { previewAddress } from "@/features/storefront/layout/preview-url"
import { errorText } from "@/lib/errors"
import { sayDroppedPages } from "./dropped-pages"

const E = "storefront.editor"

interface EditorActionsOptions {
  /** Stores what waits to be saved; false when it could not (a mistake, a refusal). */
  flush: () => Promise<boolean>
  /** The page the preview opens on: a product's or category's path; null: the home page. */
  page: string | null
  /** A content page in draft shown (adr/0073 §5): its id goes with the address. */
  draftPage?: string | null
  /**
   * The draft as the server now holds it, after a publish, a discard or a
   * restore: a publish clears the menu set it put live (adr/0063 §3), and the
   * editor and the autosave must not carry it back into the draft.
   */
  onLoaded: (doc: LayoutDocument) => void
}

/**
 * Publish, discard, restore and preview in a new tab. Each first stores
 * what is waiting, so what goes live (or opens) is what the editor shows.
 */
export function useEditorActions({
  flush,
  page,
  draftPage = null,
  onLoaded,
}: EditorActionsOptions) {
  const { t } = useTranslation()
  const publish = usePublishLayout()
  const discard = useDiscardLayout()
  const restore = useRestoreRevision()
  const preview = useMutation({ mutationFn: fetchLayoutPreview })
  const failed = (failure: unknown) => toast.error(errorText(t, failure))
  const unsaved = () => toast.error(t(`${E}.unsaved`))
  // The draft replaced was kept first (adr/0064 Ek 2026-11-17): said under the toast
  const keptNote = (kept: KeptDraft | null) =>
    kept ? { description: t(`${E}.keptDraft`) } : undefined
  return {
    /** Stores what waits to be saved first (before a look is saved from the draft). */
    store: flush,
    busy: publish.isPending || discard.isPending || restore.isPending,
    publishing: publish.isPending,
    /** `pagesLive`: content pages in draft to put live with the design (adr/0073 Ek 2026-11-19 (2) K5). */
    publish: async (pagesLive: readonly string[] = []) => {
      if (!(await flush())) {
        unsaved()
        return
      }
      publish.mutate(pagesLive, {
        onSuccess: ({ layout, dropped }) => {
          onLoaded(layout.draft)
          toast.success(t(`${E}.publish.done`))
          sayDroppedPages(t, dropped)
        },
        onError: failed,
      })
    },
    discard: () => {
      discard.mutate(undefined, {
        onSuccess: ({ layout, kept, dropped }) => {
          onLoaded(layout.draft)
          toast.success(t(`${E}.discard.done`), keptNote(kept))
          sayDroppedPages(t, dropped)
        },
        onError: failed,
      })
    },
    restore: (revision: number, menus: boolean) => {
      restore.mutate(
        { revision, menus },
        {
          onSuccess: ({ layout, kept, dropped }) => {
            onLoaded(layout.draft)
            toast.success(t(`${E}.revisions.restored`, { revision }), keptNote(kept))
            sayDroppedPages(t, dropped)
          },
          onError: failed,
        }
      )
    },
    previewing: preview.isPending,
    // The tab opens on the click, before the link exists: a tab opened after
    // the request would be taken for a pop-up
    openPreview: async () => {
      const tab = window.open("about:blank", "_blank")
      const close = () => {
        tab?.close()
      }
      if (!(await flush())) {
        close()
        unsaved()
        return
      }
      try {
        const address = previewAddress(await preview.mutateAsync(), undefined, page, draftPage)
        if (!address) {
          close()
          toast.error(t(`${E}.preview.noHost`))
          return
        }
        if (tab) {
          tab.opener = null
          tab.location.href = address
        }
      } catch (failure) {
        close()
        failed(failure)
      }
    },
  }
}
