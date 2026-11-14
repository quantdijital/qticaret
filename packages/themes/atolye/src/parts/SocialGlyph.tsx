import type { SocialNetwork } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"
import { WhatsAppGlyph } from "./WhatsAppGlyph"

/**
 * A profile's network as a small sign (adr/0049 Ek 2026-11-15): a few
 * plain shapes the theme draws itself in the current colour (a camera
 * for Instagram, a play button for YouTube, a note for TikTok), never a
 * company's logo file; WhatsApp keeps its own glyph (`WhatsAppGlyph`,
 * design.md). A network without a shape of ours, or an address the
 * storefront does not know, is its name's first letters. Decorative: the
 * link carries the name.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

/** The networks drawn as their name's letters rather than a shape. */
const LETTERS: Partial<Record<SocialNetwork, string>> = {
  facebook: "f",
  x: "X",
  linkedin: "in",
  pinterest: "P",
}

function Shape({ network }: { network: "instagram" | "youtube" | "tiktok" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="size-5 shrink-0">
      {network === "instagram" && (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" {...STROKE} />
          <circle cx="12" cy="12" r="3.75" {...STROKE} />
          <circle cx="17" cy="7" r="1" fill="currentColor" />
        </>
      )}
      {network === "youtube" && (
        <>
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" {...STROKE} />
          <path d="M10.25 9.25v5.5L15 12z" fill="currentColor" />
        </>
      )}
      {network === "tiktok" && (
        <>
          <circle cx="9" cy="16.5" r="3" {...STROKE} />
          <path d="M12 16.5V4c.6 2.4 2.6 4.2 5.5 4.5" {...STROKE} />
        </>
      )}
    </svg>
  )
}

export function SocialGlyph({
  network,
  label,
  className,
}: {
  network: SocialNetwork | null | undefined
  /** The network's name or the address's host: its first letter stands in for a sign. */
  label: string
  className?: string
}) {
  if (network === "instagram" || network === "youtube" || network === "tiktok") {
    return <Shape network={network} />
  }
  if (network === "whatsapp") {
    return className === undefined ? <WhatsAppGlyph /> : <WhatsAppGlyph className={className} />
  }
  const letters =
    (network ? LETTERS[network] : undefined) ?? label.charAt(0).toLocaleUpperCase("tr")
  return (
    <span
      aria-hidden="true"
      className={cn("text-sm leading-none font-extrabold tracking-[-0.02em]", className)}
    >
      {letters}
    </span>
  )
}
