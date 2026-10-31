import { useNavigate, useSearch } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface SettingsTab {
  key: string
  label: string
  content: ReactNode
}

/**
 * A settings page's parts as tabs (the owner, 2026-10-31: one page per
 * subject, its parts side by side instead of scattered pages). The open
 * tab is in the address (`?part=`), so a link, a reload or the back button
 * lands on it; an unknown one opens the first. The tabs wrap on a narrow
 * screen rather than scroll sideways.
 */
export function SettingsTabs({ tabs, label }: { tabs: readonly SettingsTab[]; label: string }) {
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const asked = typeof search.part === "string" ? search.part : undefined
  const current = tabs.find((tab) => tab.key === asked)?.key ?? tabs[0]?.key ?? ""
  return (
    <Tabs
      value={current}
      onValueChange={(tab) => {
        void navigate({
          to: ".",
          search: (previous) => ({ ...previous, part: tab }),
          replace: true,
        })
      }}
      className="gap-6"
    >
      <TabsList
        variant="line"
        aria-label={label}
        // The list's fixed height (its variant's) gives way: wrapped tabs take a second row
        className="h-auto w-full flex-wrap justify-start gap-x-1 gap-y-1 border-b pb-px group-data-[orientation=horizontal]/tabs:h-auto"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            // One underline, in the brand colour: the line variant's own is hidden
            className="h-9 flex-none rounded-none border-0 border-b-2 border-transparent px-3 after:hidden data-[state=active]:border-primary"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.key} value={tab.key} className="flex flex-col gap-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
