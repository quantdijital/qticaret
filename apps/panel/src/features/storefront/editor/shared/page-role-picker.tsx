import { AlertTriangle, Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@qticaret/admin-ui/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@qticaret/admin-ui/ui/popover"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { useContentPage, useContentPageSearch } from "../use-content-pages"

const C = "settings.storefront.rolePage"
const DELAY_MS = 250
const NONE = "__none__"

/**
 * The content page a storefront role is on (the contact form, the payment
 * and shipping facts; adr/0073 Açık kararlar 3): İçerik's pages by title
 * or address, drafts marked; kept by the page's id, so the role stays when
 * the page's address changes. A page since deleted says so; the save goes on.
 */
export function PageRolePicker({
  id,
  value,
  onChange,
  noneLabel,
  invalid = false,
}: {
  /** The trigger's id, for the field's label. */
  id: string
  /** The page's id; null: none. */
  value: string | null
  onChange: (id: string | null) => void
  /** Offers "none" first, with this name. */
  noneLabel?: string
  invalid?: boolean
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
  const chosen = useContentPage(value)
  const missing = value !== null && !chosen.finding && chosen.page === null
  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }
  const shown =
    chosen.page?.title ?? (missing ? t(`${C}.deleted`) : (noneLabel ?? t(`${C}.choose`)))
  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || missing}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !chosen.page && "text-muted-foreground")}>
              {chosen.finding ? t("common.loading") : shown}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={text} onValueChange={setText} placeholder={t(`${C}.search`)} />
            <CommandList>
              {found.loading ? (
                <div className="flex justify-center py-6">
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              ) : (
                <CommandEmpty>{t(q ? `${C}.noMatch` : `${C}.empty`)}</CommandEmpty>
              )}
              {noneLabel && !q ? (
                <CommandItem
                  value={NONE}
                  onSelect={() => {
                    pick(null)
                  }}
                >
                  <Check
                    className={cn("size-4", value === null ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  {noneLabel}
                </CommandItem>
              ) : null}
              {found.pages.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    pick(option.id)
                  }}
                >
                  <Check
                    className={cn("size-4", value === option.id ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.title}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {option.path}
                    </span>
                  </span>
                  {option.status === "draft" ? <ContentStatusBadge status="draft" /> : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {missing ? (
        <p className="flex items-start gap-1.5 text-xs text-warning-text">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {t(`${C}.missing`)}
        </p>
      ) : null}
    </div>
  )
}
