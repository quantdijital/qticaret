import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
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
import { cn } from "@/lib/utils"
import { usePreviewSamples } from "./use-preview-sample"
import type { PreviewSample, SamplePage } from "./use-preview-sample"

const S = "storefront.editor.sample"
const DELAY_MS = 250

/**
 * Which product or category page the preview shows the draft on ("Örnek:
 * …"): the sections are the same on all of them, so any live one will do.
 */
export function SamplePicker({
  page,
  sample,
  onChange,
}: {
  page: SamplePage
  sample: PreviewSample | null
  onChange: (sample: PreviewSample) => void
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
  const options = usePreviewSamples(page, q, open)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={t(`${S}.label.${page}`)}
          className="max-w-56 min-w-40 justify-between font-normal"
        >
          <span className="truncate">
            {t(`${S}.shown`, { name: sample?.name ?? t(`${S}.none`) })}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={text}
            onValueChange={setText}
            placeholder={t(`${S}.search.${page}`)}
          />
          <CommandList>
            {options.isFetching && !options.data ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : (
              <CommandEmpty>{t(`${S}.empty.${page}`)}</CommandEmpty>
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
                  className={cn("size-4", sample?.id === option.id ? "opacity-100" : "opacity-0")}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{option.name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {option.path}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
