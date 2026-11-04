import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"

/** Opens a tab of the page by its key (`?part=`), keeping where the page is scrolled. */
export function useOpenPart(): (key: string) => Promise<void> {
  const navigate = useNavigate()
  return useCallback(
    (key: string) =>
      navigate({
        to: ".",
        search: (previous) => ({ ...previous, part: key }),
        replace: true,
        // A detail page's tabs sit under its main cards: opening one does not jump to the top
        resetScroll: false,
      }),
    [navigate]
  )
}
