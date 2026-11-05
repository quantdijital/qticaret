import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import type { ClipboardEvent, KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SUMMARY_LIMITS, pastedLines, summaryOf } from "@/features/products/summary-lines"

const { lines: MAX_LINES, length: MAX_LENGTH } = SUMMARY_LIMITS
// Characters left when a line starts showing its count
const NEAR_LIMIT = 20

interface SummaryFieldProps {
  /** The editor's rows as typed; an empty list shows one empty row. */
  value: readonly string[]
  onChange: (rows: string[]) => void
}

/**
 * The product's short description as up to five short lines (the owner,
 * 2026-11-05), one input each: shown under its name, above the price.
 * Enter starts the next line, Backspace on an empty one removes it; text
 * pasted as several lines fills one line each. The arrows move a line.
 */
export function SummaryField({ value, onChange }: SummaryFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const rows = value.length > 0 ? [...value] : [""]
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  // The row to put the caret in once the change has rendered
  const focusNext = useRef<number | null>(null)
  const placeholders = t("products.summary.placeholders", { returnObjects: true }) as string[]

  useEffect(() => {
    const index = focusNext.current
    if (index !== null) {
      focusNext.current = null
      inputs.current[index]?.focus()
    }
  })

  const commit = (next: string[], focus: number | null = null) => {
    focusNext.current = focus
    onChange(next)
  }
  const set = (index: number, text: string) => {
    commit(rows.map((row, at) => (at === index ? text : row)))
  }
  const add = (after: number) => {
    if (rows.length < MAX_LINES) {
      commit([...rows.slice(0, after + 1), "", ...rows.slice(after + 1)], after + 1)
    }
  }
  const remove = (index: number) => {
    commit(
      rows.filter((_, at) => at !== index),
      Math.max(0, index - 1)
    )
  }
  const move = (index: number, by: -1 | 1) => {
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(index + by, 0, row ?? "")
    commit(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Enter") {
      // Never the card's submit: Enter starts the next line
      event.preventDefault()
      add(index)
    } else if (event.key === "Backspace" && rows[index] === "" && rows.length > 1) {
      event.preventDefault()
      remove(index)
    }
  }
  const onPaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    const text = event.clipboardData.getData("text")
    if (!/[\r\n]/.test(text)) {
      return
    }
    event.preventDefault()
    const current = rows[index] ?? ""
    const kept = current.trim() === "" ? [] : [current]
    const room = MAX_LINES - (rows.length - 1) - kept.length
    const lines = pastedLines(text).slice(0, Math.max(0, room))
    if (lines.length === 0) {
      return
    }
    const next = [...rows.slice(0, index), ...kept, ...lines, ...rows.slice(index + 1)]
    commit(next, index + kept.length + lines.length - 1)
  }

  const filled = summaryOf(rows).length
  const labelId = `${id}-label`
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label id={labelId} htmlFor={`${id}-0`} className="text-sm font-medium">
          {t("products.summary.label")}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("products.summary.count", { count: filled, max: MAX_LINES })}
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const n = index + 1
          const near = row.length >= MAX_LENGTH - NEAR_LIMIT
          return (
            // Rows are plain text in order: their place is their identity
            <li key={index} className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Input
                  id={`${id}-${String(index)}`}
                  ref={(element) => {
                    inputs.current[index] = element
                  }}
                  aria-label={t("products.summary.line", { n })}
                  value={row}
                  maxLength={MAX_LENGTH}
                  placeholder={placeholders[index] ?? ""}
                  className={near ? "pr-16" : undefined}
                  onChange={(event) => {
                    set(index, event.target.value)
                  }}
                  onKeyDown={(event) => {
                    onKeyDown(event, index)
                  }}
                  onPaste={(event) => {
                    onPaste(event, index)
                  }}
                />
                {near ? (
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground tabular-nums">
                    {t("products.summary.chars", { count: row.length, max: MAX_LENGTH })}
                  </span>
                ) : null}
              </div>
              {rows.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("products.summary.up", { n })}
                    disabled={index === 0}
                    onClick={() => {
                      move(index, -1)
                    }}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("products.summary.down", { n })}
                    disabled={index === rows.length - 1}
                    onClick={() => {
                      move(index, 1)
                    }}
                  >
                    <ArrowDown />
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("products.summary.remove", { n })}
                disabled={rows.length === 1 && row === ""}
                onClick={() => {
                  remove(index)
                }}
              >
                <X />
              </Button>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-xs text-muted-foreground">{t("products.summary.hint")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length >= MAX_LINES}
          onClick={() => {
            add(rows.length - 1)
          }}
        >
          <Plus />
          {t("products.summary.add")}
        </Button>
      </div>
    </div>
  )
}
