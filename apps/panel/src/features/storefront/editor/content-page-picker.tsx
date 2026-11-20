import { Check, ChevronsUpDown, LayoutTemplate, Loader2, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { PAGE_LAYOUT_LIMITS } from "@qticaret/types"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@qticaret/admin-ui/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@qticaret/admin-ui/ui/popover"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { useContentPageSearch } from "./use-content-pages"
import type { ContentPageOption } from "./use-content-pages"

const C = "storefront.editor.contentPage"
const DELAY_MS = 250

/**
 * Which content page the editor works on (adr/0073 §5, Ek 2026-11-19 (2)
 * K5), beside the page choice: "Yeni sayfa" first, then the shop's pages
 * by title or address, drafts marked "Taslak", the ones with a layout of
 * their own marked; while fifty have one, it says no other can have one
 * (the pages that have one stay open to edit).
 */
export function ContentPagePicker({
  doc,
  page,
  onChange,
  onNew,
}: {
  doc: LayoutDocument
  /** The page picked; null: none yet. */
  page: ContentPageOption | null
  onChange: (id: string) => void
  /** Opens the new page's dialog. */
  onNew: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text.trim())
    }, DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [text])
  const found = useContentPageSearch(q, open)
  const designed = new Set(doc.pages.map((each) => each.page_id))
  const full = doc.pages.length >= PAGE_LAYOUT_LIMITS.pages
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={t(`${C}.label`)}
          className="max-w-56 min-w-40 shrink justify-between font-normal"
        >
          <span className="truncate">{page?.title ?? t(`${C}.none`)}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={text} onValueChange={setText} placeholder={t(`${C}.search`)} />
          {full ? (
            <p className="border-b px-3 py-2 text-xs text-muted-foreground">
              {t(`${C}.pagesFull`, { max: PAGE_LAYOUT_LIMITS.pages })}
            </p>
          ) : null}
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="__new__"
                className="text-primary-text"
                onSelect={() => {
                  setOpen(false)
                  onNew()
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t(`${C}.new.open`)}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            {found.loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : found.pages.length === 0 ? (
              // "Yeni sayfa" stays listed: the list is never empty to the command
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t(q ? `${C}.noMatch` : `${C}.empty`)}
              </p>
            ) : null}
            {found.pages.map((option) => (
              <CommandItem
                key={option.id}
                value={option.id}
                onSelect={() => {
                  onChange(option.id)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn("size-4", page?.id === option.id ? "opacity-100" : "opacity-0")}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{option.title}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {option.path}
                  </span>
                </span>
                {designed.has(option.id) ? (
                  <LayoutTemplate
                    role="img"
                    aria-label={t(`${C}.designed`)}
                    className="size-4 shrink-0 text-primary-text"
                  />
                ) : null}
                {option.status === "draft" ? <ContentStatusBadge status="draft" /> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
