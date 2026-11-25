import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * The shop's mark at the header's start: its logo file when it has one,
 * else its name set as a wordmark in the display face at 800, tight, with
 * no ornament (owner 2026-11-04: no logo file yet). Links home.
 */
export function Wordmark({
  name,
  logo,
  className,
  large = false,
}: {
  name: string
  logo: ImageView | null
  className?: string
  /** A logo file a step taller from 1024 px (the one-row header's taller row). */
  large?: boolean
}) {
  return (
    <a
      href="/"
      aria-label={logo ? name : undefined}
      className={cn("flex min-h-11 min-w-0 items-center rounded-inner", className)}
    >
      {logo ? (
        <ResponsiveImage
          image={logo}
          sizes={large ? "300px" : "180px"}
          priority
          className={cn("h-9 w-auto", large ? "lg:h-14" : "lg:h-10")}
        />
      ) : (
        <span className="truncate font-display text-wordmark leading-none font-extrabold tracking-(--tracking-display)">
          {name}
        </span>
      )}
    </a>
  )
}
