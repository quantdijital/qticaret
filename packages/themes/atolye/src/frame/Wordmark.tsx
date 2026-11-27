import { ResponsiveImage } from "@qticaret/ui"
import type { ImageView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * The shop's mark at the header's start: its logo file when it has one,
 * else its name set as a wordmark in the display face at 800, tight, with
 * no ornament (owner 2026-11-04: no logo file yet). Links home.
 *
 * `logoOnDark`, the shop's dark-ground logo (the one-row header over the
 * opening's photograph): drawn beside the logo but hidden, and
 * `header-over.css` swaps the two while the header lies over the photograph
 * without its ground; no script, the same box. Only the link names the shop:
 * the twin is `aria-hidden` with an empty `alt`.
 */
export function Wordmark({
  name,
  logo,
  logoOnDark = null,
  className,
  large = false,
}: {
  name: string
  logo: ImageView | null
  logoOnDark?: ImageView | null
  className?: string
  /** A logo file a step taller from 1024 px (the one-row header's taller row). */
  large?: boolean
}) {
  const sizes = large ? "300px" : "180px"
  const height = cn("h-9 w-auto", large ? "lg:h-16" : "lg:h-10")
  return (
    <a
      href="/"
      aria-label={logo ? name : undefined}
      className={cn("gf-wordmark flex min-h-11 min-w-0 items-center rounded-inner", className)}
    >
      {logo && logoOnDark ? (
        <>
          <span data-gf-logo="light" className="contents">
            <ResponsiveImage image={logo} sizes={sizes} priority className={height} />
          </span>
          <span data-gf-logo="dark" aria-hidden="true" className="hidden">
            <ResponsiveImage
              image={{ ...logoOnDark, alt: "" }}
              sizes={sizes}
              priority
              className={height}
            />
          </span>
        </>
      ) : logo ? (
        <ResponsiveImage image={logo} sizes={sizes} priority className={height} />
      ) : (
        <span className="truncate font-display text-wordmark leading-none font-extrabold tracking-(--tracking-display)">
          {name}
        </span>
      )}
    </a>
  )
}
