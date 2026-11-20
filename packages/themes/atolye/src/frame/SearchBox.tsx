"use client"

import { Search, X } from "lucide-react"
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import type { ChangeEvent, KeyboardEvent } from "react"
import { IDLE, createSuggester, fieldMark, moveActive } from "@qticaret/ui"
import type { LinkView, SuggestState } from "@qticaret/ui"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import { cn } from "@qticaret/ui/lib/utils"
import { SearchPanel, panelOf, statusOf } from "./SearchPanel"
import type { SearchPanelWords } from "./SearchPanel"
import { keepInPanel, usePanelFit } from "./search-panel-fit"

export interface SearchWords extends SearchPanelWords {
  label: string
  placeholder: string
  submit: string
  /** "Aramayı temizle". */
  clear: string
}

/** The results page's own search, for the field to keep it ("" anywhere else). */
function searched(): string {
  return window.location.pathname === "/arama"
    ? (new URLSearchParams(window.location.search).get("q") ?? "").trim().slice(0, 100)
    : ""
}

/** The address does not change under a page; there is nothing to listen to. */
const still = () => () => undefined

/**
 * The header's search (wide screens, phones; told apart by `id`): a GET
 * form to `/arama`, a 48 px pill with its magnifier as the submit, so it
 * works before any script. Once the script runs and the storefront gives
 * a live search address (`suggest`), it is an ARIA combobox: from two
 * characters, 200 ms after the last key, the panel under it shows the
 * hits, "did you mean", the categories and brands and "Tüm sonuçları
 * gör (n)"; each change drops the request before it (`createSuggester`).
 * From 1024 px the panel is 56 rem wide at least, from the box's left
 * edge, kept inside the header's content (`usePanelFit`).
 * The arrow keys move through the options, Enter opens the one they are
 * on (or searches), Escape closes the panel (then clears the field), a
 * press outside closes it; the focus stays in the field. The browser's
 * own clear glyph is hidden; an X button clears the words and gives the
 * field its focus back. On the results page the field keeps the search,
 * ready to change; empty, it leaves its example whole (no room held for
 * the clear button). `written`: the submit is a filled "Ara" button.
 */
export function SearchBox({
  id,
  words,
  suggest,
  browse = [],
  written = false,
  marks = false,
  onLeave,
  className,
}: {
  id: string
  words: SearchWords
  /** The storefront's live search address; none: the plain form alone. */
  suggest?: string | undefined
  /** The shop's categories, offered when a search finds nothing. */
  browse?: readonly LinkView[]
  /** The submit written ("Ara") in a filled button rather than the magnifier (the catalog header). */
  written?: boolean
  /** The theme editor's live preview (adr/0065 Faz 2b): the box carries the search words' field mark. */
  marks?: boolean | undefined
  /** A box that opens on a press (`SearchToggle`, `SearchDrop`): Escape with no panel closes it, the words kept. */
  onLeave?: (() => void) | undefined
  className?: string
}) {
  const hydrated = useHydrated()
  const live = hydrated && suggest !== undefined
  const form = useRef<HTMLFormElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const asked = useSyncExternalStore(still, searched, () => "")
  const [typed, setText] = useState<string | null>(null)
  const text = typed ?? asked
  const [state, setState] = useState<SuggestState>(IDLE)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [suggester] = useState(() =>
    suggest
      ? createSuggester({
          url: suggest,
          onState: (next) => {
            setState(next)
            setActive(-1)
          },
        })
      : null
  )
  const base = useId()
  const listboxId = `${base}-liste`
  const optionId = (index: number) => `${base}-secenek-${String(index)}`
  const model = live ? panelOf(state, browse) : null
  const shown = open && model !== null
  const paths = model?.paths ?? []
  const activeId = shown && active >= 0 && active < paths.length ? optionId(active) : undefined

  // A request on its way when the page goes is dropped
  useEffect(
    () => () => {
      suggester?.cancel()
    },
    [suggester]
  )

  // A press anywhere outside the field and its panel closes the panel
  useEffect(() => {
    if (!shown) {
      return
    }
    const press = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !form.current?.contains(event.target)) {
        setOpen(false)
        setActive(-1)
      }
    }
    document.addEventListener("pointerdown", press)
    return () => {
      document.removeEventListener("pointerdown", press)
    }
  }, [shown])

  // Wide, the panel opens wider than the box within the header; on a phone it ends above the keyboard
  usePanelFit(form, panel, shown)

  // The option the arrow keys are on stays in the panel's view; the page stays where it is
  useEffect(() => {
    const option = activeId ? document.getElementById(activeId) : null
    if (option && panel.current) {
      keepInPanel(panel.current, option)
    }
  }, [activeId])

  const close = () => {
    setOpen(false)
    setActive(-1)
  }

  const clear = () => {
    if (field.current) {
      field.current.value = ""
    }
    setText("")
    close()
    suggester?.ask("")
    field.current?.focus({ preventScroll: true })
  }

  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setText(value)
    setOpen(true)
    setActive(-1)
    suggester?.ask(value)
  }

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // The panel first, then the words; never the browser's own clearing
      if (shown || text || onLeave) {
        event.preventDefault()
      }
      if (shown) {
        close()
      } else if (onLeave) {
        onLeave()
      } else if (text) {
        clear()
      }
      return
    }
    if (!model) {
      return
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setActive(moveActive(active, event.key === "ArrowDown" ? 1 : -1, paths.length))
    } else if (event.key === "Enter" && activeId) {
      // The highlighted option's own link: a product, a category, a phrase or every result
      event.preventDefault()
      suggester?.cancel()
      document.getElementById(activeId)?.click()
    } else if (event.key === "Tab") {
      close()
    }
  }

  return (
    <form
      ref={form}
      action="/arama"
      method="get"
      role="search"
      {...fieldMark(marks, "search_placeholder")}
      className={cn("relative", className)}
      onSubmit={() => {
        suggester?.cancel()
        close()
      }}
    >
      <label htmlFor={id} className="sr-only">
        {words.label}
      </label>
      <input
        ref={field}
        id={id}
        name="q"
        type="search"
        placeholder={words.placeholder}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        defaultValue={asked}
        className={cn(
          "gf-field",
          written ? (text === "" ? "pr-24" : "pr-34") : text === "" ? "pr-14" : "pr-24"
        )}
        onChange={change}
        onKeyDown={keyDown}
        onFocus={() => {
          if (model) {
            setOpen(true)
          }
        }}
        {...(live
          ? {
              role: "combobox",
              "aria-autocomplete": "list" as const,
              "aria-expanded": shown,
              "aria-controls": listboxId,
              "aria-activedescendant": activeId,
            }
          : {})}
      />
      {text !== "" && (
        <button
          type="button"
          aria-label={words.clear}
          className={cn(
            "gf-icon-btn absolute top-1/2 -translate-y-1/2 text-text-2",
            written ? "right-22" : "right-12"
          )}
          onClick={clear}
        >
          <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
        </button>
      )}
      {written ? (
        <button
          type="submit"
          className="gf-btn gf-btn--small absolute top-1/2 right-0.5 min-w-20 -translate-y-1/2"
        >
          {words.submit}
        </button>
      ) : (
        <button
          type="submit"
          aria-label={words.submit}
          className="gf-icon-btn absolute top-1/2 right-1 -translate-y-1/2 text-text"
        >
          <Search className="size-5" aria-hidden="true" strokeWidth={1.75} />
        </button>
      )}
      {live && (
        <>
          <p role="status" className="sr-only">
            {shown ? statusOf(model, words) : ""}
          </p>
          <SearchPanel
            model={model}
            words={words}
            listboxId={listboxId}
            optionId={optionId}
            active={active}
            hidden={!shown}
            panelRef={panel}
          />
        </>
      )}
    </form>
  )
}
