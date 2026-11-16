import type { ComponentProps } from "react"
import { Container } from "../parts/Container"
import { SearchBox } from "./SearchBox"
import { PHONE_SEARCH } from "./SearchLink"

/** The search box's own props, less what this part sets: its id and its place. */
type PhoneSearchProps = Omit<ComponentProps<typeof SearchBox>, "id" | "className" | "onLeave">

/**
 * A phone's search, the same under every header variant (owner
 * 2026-11-16: "tüm headerlerde katalogdaki gibi çalışsın arama"): the
 * catalog header's own, a 48 px search pill always there under the
 * header's top row, below 1024 px (Tailwind's `lg`, the headers' own
 * step). Sticky, the row folds away while the page scrolls down and the
 * pill stays (`frame.css`); the bottom bar's "Ara" puts the cursor in it
 * (`SearchLink`, `PHONE_SEARCH`). The live panel answers under it as the
 * shopper types; Escape closes the panel, then clears the words. The
 * shop's `search_style: icon` is a wide screen's magnifier only.
 */
export function PhoneSearch(props: PhoneSearchProps) {
  return (
    <Container className="pb-2 lg:hidden">
      <SearchBox {...props} id={PHONE_SEARCH} />
    </Container>
  )
}
