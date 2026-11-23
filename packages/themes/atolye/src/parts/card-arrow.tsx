import { ArrowRight } from "lucide-react"

/**
 * A round arrow at a card's foot (adr/0077 Ek "tur kartı", the shop's
 * `arrow`): for the eye only, hidden from a screen reader and never a
 * link or a button of its own; the card's one link (its name's) covers
 * it, so a press on it opens the product as anywhere on the card. Its
 * ring darkens while the card is pointed at or focused.
 */
export function CardArrow() {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rule text-text transition-colors duration-(--dur-micro) group-hover:border-text group-focus-within:border-text"
    >
      <ArrowRight className="size-4" strokeWidth={1.75} />
    </span>
  )
}
