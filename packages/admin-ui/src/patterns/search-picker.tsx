import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "../ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { cn } from "../lib/utils"

export interface PickerOption {
  id: string
  label: string
  /** Shown dimmed with a note (an inactive brand). */
  inactive?: boolean
}

interface SearchPickerProps {
  id?: string
  /** The control's name where no `<label>` points at `id` (a filter row). */
  label?: string
  value: PickerOption | null
  onChange: (value: PickerOption | null) => void
  /** Server search; called as the text settles. */
  search: (q: string) => Promise<PickerOption[]>
  /** Keeps searches apart in the cache (`["brands", "options"]`). */
  queryKey: readonly unknown[]
  placeholder: string
  empty: string
  inactiveNote?: string
  disabled?: boolean
  /** The button's own size where the default (at most 320 px) leaves a gap in its row. */
  className?: string
}

const DELAY_MS = 250

/**
 * One record chosen from many (docs/18 §7): a button showing the choice,
 * a popover that searches the server as you type, and a way to clear it.
 */
export function SearchPicker({
  id,
  label,
  value,
  onChange,
  search,
  queryKey,
  placeholder,
  empty,
  inactiveNote,
  disabled = false,
  className,
}: SearchPickerProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
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
  const options = useQuery({
    queryKey: [...queryKey, q],
    queryFn: () => search(q),
    enabled: open,
  })

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            disabled={disabled}
            className={cn("min-w-0 flex-1 justify-between font-normal sm:max-w-80", className)}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          {/* Results come from the server already filtered */}
          <Command shouldFilter={false}>
            <CommandInput value={text} onValueChange={setText} placeholder={placeholder} />
            <CommandList>
              {options.isFetching && !options.data ? (
                <div className="flex justify-center py-6">
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              ) : (
                <CommandEmpty>{empty}</CommandEmpty>
              )}
              {(options.data ?? []).map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn("size-4", value?.id === option.id ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className={cn("truncate", option.inactive && "text-muted-foreground")}>
                    {option.label}
                  </span>
                  {option.inactive && inactiveNote ? (
                    <span className="ml-auto text-xs text-muted-foreground">{inactiveNote}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          // The field's height beside it (docs/18 §2, "Denge")
          size="icon"
          className="shrink-0"
          aria-label={t("common.clear")}
          onClick={() => {
            onChange(null)
          }}
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}
