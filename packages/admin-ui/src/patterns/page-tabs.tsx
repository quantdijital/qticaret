import { useSearch } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { formatCount } from "../lib/format"
import { cn } from "../lib/utils"
import { useOpenPart } from "../hooks/use-open-part"

export interface PageTab {
  key: string
  label: string
  /** How many records the tab holds (messages, refunds), beside its name. */
  count?: number | undefined
  content: ReactNode
}

/**
 * A page's parts as tabs (docs/06 "Detay sayfası düzeni", docs/18 §7):
 * a settings page's parts under its title, a detail page's secondary
 * cards under its main ones. The open tab is in the address (`?part=`),
 * so a link, a reload or the back button lands on it; an unknown one
 * opens the first. The tabs wrap on a narrow screen rather than scroll
 * sideways. `keepMounted` keeps every tab's card alive while hidden, so a
 * card's unsaved edit survives a look at another tab.
 */
export function PageTabs({
  tabs,
  label,
  keepMounted = false,
  className,
  onOpen,
}: {
  tabs: readonly PageTab[]
  label: string
  keepMounted?: boolean
  className?: string
  /** Opens a tab its own way (leaving the last tab's filters behind); by default `?part=` is set and the rest kept. */
  onOpen?: (key: string) => void
}) {
  // Any page's search: the package knows no app's routes, only the `part` key it writes
  const search: unknown = useSearch({ strict: false })
  const open = useOpenPart()
  const part =
    typeof search === "object" && search !== null && "part" in search ? search.part : null
  const asked = typeof part === "string" ? part : undefined
  const current = tabs.find((tab) => tab.key === asked)?.key ?? tabs[0]?.key ?? ""
  return (
    <Tabs
      value={current}
      onValueChange={(tab) => {
        if (onOpen) {
          onOpen(tab)
        } else {
          void open(tab)
        }
      }}
      className={cn("gap-6", className)}
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
            {/* A space between, so the tab reads "İletişim geçmişi 4" aloud */}
            {tab.count ? " " : null}
            {tab.count ? (
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {formatCount(tab.count)}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.key}
          value={tab.key}
          {...(keepMounted ? { forceMount: true as const } : {})}
          className="flex flex-col gap-6 data-[state=inactive]:hidden"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
