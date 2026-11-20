import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router"

/**
 * Leaving the editor: what waits is stored first; a draft that cannot be
 * is asked about by the guard. Back where the editor was opened from, else
 * to the menus.
 */
export function useEditorExit(flush: () => Promise<boolean>) {
  const router = useRouter()
  const navigate = useNavigate()
  const canGoBack = useCanGoBack()
  return async () => {
    const stored = await flush()
    if (canGoBack) {
      router.history.back({ ignoreBlocker: stored })
    } else {
      void navigate({ to: "/storefront/menus", ignoreBlocker: stored })
    }
  }
}
