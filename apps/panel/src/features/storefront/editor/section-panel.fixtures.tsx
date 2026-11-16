import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { useState } from "react"
import { vi } from "vitest"
import type { AnySection, LayoutGroup } from "@/features/storefront/api/layout"
import type { FieldGroupName } from "./forms/field-registry"
import { SectionPanel } from "./section-panel"
import type { FieldFocus } from "./use-field-focus"

export type PanelFocus = (FieldFocus & { group: FieldGroupName }) | null

/**
 * A section's settings panel as the editor holds it (adr/0065 Ek,
 * sekmeler): every change kept, and `pick` hands it a field picked from
 * outside (the settings search, the preview's edit label) as the editor
 * does, the panel staying drawn.
 */
export function renderPanel(section: AnySection, group: LayoutGroup = "home") {
  const changes: AnySection[] = []
  function Holder({ focus }: { focus: PanelFocus }) {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group={group}
        problems={{}}
        canDuplicate
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
        focus={focus}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (focus: PanelFocus) => (
    <QueryClientProvider client={client}>
      <Holder focus={focus} />
    </QueryClientProvider>
  )
  const view = render(tree(null))
  return {
    changes,
    pick: (focus: PanelFocus) => {
      view.rerender(tree(focus))
    },
    unmount: view.unmount,
  }
}
