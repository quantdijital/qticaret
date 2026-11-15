import type { AnnouncementSettings } from "@qticaret/types"

type Align = AnnouncementSettings["align"]
type Size = AnnouncementSettings["size"]

/**
 * Where the announcement bar's lines sit (adr/0049 Ek 2026-11-15), as
 * classes. `auto` is the bar as it was: centred on a phone, at the start
 * from 1024 px. The shop's links and phone (only from 1024 px) always stay
 * at the bar's end: `left` keeps the lines at the start, `right` sets them
 * just before the links, `center` in the middle of the whole bar between
 * an empty start and the links, both growing alike (`spacer`, `navWide`):
 * when the links are wider than their half, the start gives way and the
 * lines stand just left of them, never under them.
 */
export const ANNOUNCEMENT_ALIGN: Readonly<
  Record<
    Align,
    {
      /** The bar's and the side-by-side list's place at every width. */
      justify: string
      /** The bar's own from 1024 px. */
      barWide: string
      /** The side-by-side list's own from 1024 px. */
      listWide: string
      /** A wrapped or turning line's words, and theirs from 1024 px. */
      text: string
      textWide: string
      /** The links' group, and its own from 1024 px. */
      nav: string
      navWide: string
      /** The empty start that balances the links, only while they show. */
      spacer: string
    }
  >
> = {
  auto: {
    justify: "justify-center",
    barWide: "lg:justify-between",
    listWide: "lg:justify-start",
    text: "text-center",
    textWide: "lg:text-left",
    nav: "ml-auto",
    navWide: "",
    spacer: "",
  },
  left: {
    justify: "justify-start",
    barWide: "",
    listWide: "",
    text: "text-left",
    textWide: "",
    nav: "ml-auto",
    navWide: "",
    spacer: "",
  },
  center: {
    justify: "justify-center",
    barWide: "",
    listWide: "",
    text: "text-center",
    textWide: "",
    nav: "",
    navWide: "lg:flex-1 lg:basis-0 lg:justify-end lg:whitespace-nowrap",
    spacer: "lg:before:flex-1 lg:before:basis-0 lg:before:content-['']",
  },
  right: {
    justify: "justify-end",
    barWide: "",
    listWide: "",
    text: "text-right",
    textWide: "",
    nav: "",
    navWide: "",
    spacer: "",
  },
}

/**
 * The bar's height and its words' size together (adr/0049 Ek 2026-11-15):
 * `medium` is the bar as it was (36 px, `--text-sm`); `small` 32 px with
 * `--text-xs`, `large` 44 px with `--text-md`. A link or the pause button
 * is the bar's height under a mouse and 44 px on a touch screen.
 */
export const ANNOUNCEMENT_SIZE: Readonly<
  Record<Size, { text: string; height: string; pad: string; button: string }>
> = {
  small: { text: "text-xs", height: "min-h-8", pad: "py-1.5", button: "size-8" },
  medium: { text: "text-sm", height: "min-h-9", pad: "py-2", button: "size-9" },
  large: { text: "text-md", height: "min-h-11", pad: "py-2.5", button: "size-11" },
}

/** The bar's place and size as drawn; absent (an older storefront): as it was. */
export function announcementStepsOf(
  settings: Partial<Pick<AnnouncementSettings, "align" | "size">> | undefined
) {
  return {
    align: ANNOUNCEMENT_ALIGN[settings?.align ?? "auto"],
    size: ANNOUNCEMENT_SIZE[settings?.size ?? "medium"],
  }
}
