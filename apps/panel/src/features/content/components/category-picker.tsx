import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { allCategoriesQuery } from "@/features/content/api/terms"
import type { TermView } from "@/features/content/api/terms"
import { cn } from "@/lib/utils"

const T = "content.terms"
const NONE = "__none__"

const folded = (text: string) => text.toLocaleLowerCase("tr")

/** Matches by name (its keywords), as a Turkish reader types it; never by the id the item is keyed by. */
const byName = (_value: string, search: string, keywords: string[] = []): number =>
  folded(keywords.join(" ")).includes(folded(search.trim())) ? 1 : 0

/** A post's one category, searched by name; "— Kategorisiz —" files it under none. */
export function CategoryPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: TermView | null
  onChange: (value: TermView | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const categories = useQuery({ ...allCategoriesQuery(), enabled: open })
  const none = t(`${T}.uncategorised`)
  const pick = (next: TermView | null) => {
    onChange(next)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value?.name ?? none}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command filter={byName}>
          <CommandInput placeholder={t(`${T}.searchCategory`)} />
          <CommandList>
            <CommandEmpty>
              {categories.isPending ? t("common.loading") : t(`${T}.noCategory`)}
            </CommandEmpty>
            <CommandItem
              value={NONE}
              keywords={[none]}
              onSelect={() => {
                pick(null)
              }}
            >
              <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
              {none}
            </CommandItem>
            {(categories.data ?? []).map((category) => (
              <CommandItem
                key={category.id}
                value={category.id}
                keywords={[category.name]}
                onSelect={() => {
                  pick({
                    id: category.id,
                    name: category.name,
                    handle: category.handle,
                    path: category.path,
                  })
                }}
              >
                <Check
                  className={cn("size-4", value?.id === category.id ? "opacity-100" : "opacity-0")}
                />
                <span className="truncate">{category.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
