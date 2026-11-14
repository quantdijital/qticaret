import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  fetchLayoutPreview,
  useDiscardLayout,
  usePublishLayout,
  useRestoreRevision,
} from "@/features/storefront/api/layout"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { previewAddress } from "@/features/storefront/layout/preview-url"
import { errorText } from "@/lib/errors"

const E = "storefront.editor"

interface EditorActionsOptions {
  /** Stores what waits to be saved; false when it could not (a mistake, a refusal). */
  flush: () => Promise<boolean>
  /** The page the preview opens on: a product's or category's path; null: the home page. */
  page: string | null
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
export function useEditorActions({ flush, page, onLoaded }: EditorActionsOptions) {
  const { t } = useTranslation()
  const publish = usePublishLayout()
  const discard = useDiscardLayout()
  const restore = useRestoreRevision()
  const preview = useMutation({ mutationFn: fetchLayoutPreview })
  const failed = (failure: unknown) => toast.error(errorText(t, failure))
  const unsaved = () => toast.error(t(`${E}.unsaved`))
  return {
    busy: publish.isPending || discard.isPending || restore.isPending,
    publishing: publish.isPending,
    publish: async () => {
      if (!(await flush())) {
        unsaved()
        return
      }
      publish.mutate(undefined, {
        onSuccess: (layout) => {
          onLoaded(layout.draft)
          toast.success(t(`${E}.publish.done`))
        },
        onError: failed,
      })
    },
    discard: () => {
      discard.mutate(undefined, {
        onSuccess: (layout) => {
          onLoaded(layout.draft)
          toast.success(t(`${E}.discard.done`))
        },
        onError: failed,
      })
    },
    restore: (revision: number, menus: boolean) => {
      restore.mutate(
        { revision, menus },
        {
          onSuccess: (layout) => {
            onLoaded(layout.draft)
            toast.success(t(`${E}.revisions.restored`, { revision }))
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
        const address = previewAddress(await preview.mutateAsync(), undefined, page)
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
