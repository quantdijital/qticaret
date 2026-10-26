import { Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}

const DELAY_MS = 300

/** A list's search box: types freely, searches once typing pauses. */
export function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(value)
  // The list's own value moved (a tab, the back button): the box follows it
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(value)
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (text === value) {
      return
    }
    const waiting = setTimeout(() => {
      onChange(text)
    }, DELAY_MS)
    timer.current = waiting
    return () => {
      clearTimeout(waiting)
    }
  }, [text, value, onChange])
  // Leaving the box (to open a result) searches at once: a search still
  // waiting would land after the click and take the page back to the list
  const flush = () => {
    clearTimeout(timer.current)
    if (text !== value) {
      onChange(text)
    }
  }
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => {
          setText(event.target.value)
        }}
        onBlur={flush}
        className="pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {text ? (
        <button
          type="button"
          aria-label={t("list.clearSearch")}
          onClick={() => {
            setText("")
            onChange("")
          }}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
