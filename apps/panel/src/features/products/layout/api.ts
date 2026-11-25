import { useQuery } from "@tanstack/react-query"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import { DEFAULT_LAYOUT, layoutOf, sameLayout } from "./parts"
import type { ProductLayout, StoredLayout } from "./parts"

/** The `panel_layout` settings section: the panel's record pages as the shop laid them out. */
export interface PanelLayoutSettings {
  product: StoredLayout
}

const SECTION = "panel_layout"

/**
 * The product page's layout, the shop's for the whole team; the default
 * until it loads, and when a backend before the section answers 404.
 */
export function useProductLayout(): ProductLayout {
  const { data } = useQuery({ ...sectionQuery<PanelLayoutSettings>(SECTION), retry: false })
  return data ? layoutOf((data.values as Partial<PanelLayoutSettings>).product) : DEFAULT_LAYOUT
}

/** Saves the layout; the default is saved as empty lists, so a part added later lands in place. */
export function useSaveProductLayout() {
  const save = useSaveSection<PanelLayoutSettings>(SECTION)
  const saveLayout = (
    layout: ProductLayout,
    options: { onSuccess: () => void; onError: (failure: unknown) => void }
  ) => {
    const product: StoredLayout = sameLayout(layout, DEFAULT_LAYOUT)
      ? { main: [], side: [], hidden: [], open: [] }
      : { main: layout.main, side: layout.side, hidden: layout.hidden, open: layout.open }
    save.mutate({ product }, options)
  }
  return { isPending: save.isPending, saveLayout }
}
