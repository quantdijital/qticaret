import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@qticaret/admin-ui/ui/tabs"

export interface LineTab<K extends string> {
  key: K
  label: string
  content: ReactNode
}

/**
 * A page's parts as tabs instead of a long stack of cards (the owner,
 * 2026-10-31), drawn as Settings draws its tabs; the open one is the
 * page's own state.
 */
export function LineTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly LineTab<K>[]
  value: K
  onChange: (key: K) => void
  label: string
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        onChange(next as K)
      }}
      className="gap-[var(--grid-gap)]"
    >
      <TabsList
        variant="line"
        aria-label={label}
        className="h-auto w-full flex-wrap justify-start gap-x-1 gap-y-1 border-b pb-px group-data-[orientation=horizontal]/tabs:h-auto"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className="h-9 flex-none rounded-none border-0 border-b-2 border-transparent px-3 after:hidden data-[state=active]:border-primary"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.key} value={tab.key} className="flex flex-col gap-[var(--grid-gap)]">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
