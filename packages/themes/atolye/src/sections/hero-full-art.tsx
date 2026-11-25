/**
 * The full image opening's drawn marks (`HeroFull`), each for the eye
 * only (`aria-hidden`), inline so nothing is fetched: the page's ground
 * washing over the photograph (`image_side: blend`), the curl under the
 * heading's second line (`accent_mark: swash`) and a sprig of leaves by
 * the words (`ornament: leaves`). Their colours are the theme's tokens.
 */

/**
 * The page's ground over the photograph from the words' side, from 1024 px:
 * a haze that holds the words (nearly the ground under them, the picture
 * coming through past them), a lighter haze under the header, a soft
 * swirl rising from the start corner, a rise at the far edge and a low
 * wave along the foot into the page. Stretched to the opening
 * (`preserveAspectRatio="none"`), so the shapes keep their place on any
 * width; the gradients' colour is the ground's (`hero-full.css`), `id`
 * keeps their names the opening's own.
 */
export function HeroWash({ id }: { id: string }) {
  const across = `${id}-wash-x`
  const down = `${id}-wash-y`
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 800"
      preserveAspectRatio="none"
      className="gf-cover-wash pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
    >
      <defs>
        <linearGradient id={across} className="gf-wash-haze" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopOpacity="0.95" />
          <stop offset="0.38" stopOpacity="0.92" />
          <stop offset="0.46" stopOpacity="0.8" />
          <stop offset="0.54" stopOpacity="0.4" />
          <stop offset="0.64" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={down} className="gf-wash-haze" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopOpacity="0.6" />
          <stop offset="1" stopOpacity="0" />
        </linearGradient>
        {/* The haze thins under the search box: the picture's foot comes through */}
        <linearGradient id={`${id}-wash-fade`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0.56" stopColor="#fff" />
          <stop offset="0.82" stopColor="#fff" stopOpacity="0.3" />
        </linearGradient>
        <mask id={`${id}-wash-m`}>
          <rect width="1440" height="800" fill={`url(#${id}-wash-fade)`} />
        </mask>
      </defs>
      <rect width="1440" height="800" fill={`url(#${across})`} mask={`url(#${id}-wash-m)`} />
      <rect width="1440" height="170" fill={`url(#${down})`} />
      <path
        className="fill-paper"
        opacity="0.7"
        d="M0 430c70-20 150 6 196 70 44 62 40 140 96 200 34 36 80 66 130 100H0Z"
      />
      <path
        className="fill-paper"
        opacity="0.75"
        d="M1440 400c-64 30-104 104-80 180 20 60-14 130-92 220h172Z"
      />
      <path
        className="fill-paper"
        d="M0 800v-26c200-30 380 18 600-4 230-24 430-40 620-8 90 16 160 22 220 18v20Z"
      />
    </svg>
  )
}

/** A thin hand-drawn curl under the heading's second line, in the accent colour. */
export function HeroSwash() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 220 24"
      preserveAspectRatio="none"
      className="gf-cover-swash pointer-events-none absolute right-0 -bottom-[0.22em] h-[0.32em] w-[62%]"
    >
      <path
        d="M4 17C52 7 120 3 196 9c8 1 14 3 18 6"
        fill="none"
        stroke="var(--highlight)"
        strokeWidth="3.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * A sprig of leaves by the words' top corner, from 1280 px (where the
 * page's side margin holds it): a curved stem in the margin and five
 * leaves rising above the first line, none over the words, in a light
 * tint of the shop's colour.
 */
export function HeroLeaves() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 80 120"
      className="gf-cover-leaves pointer-events-none absolute -top-20 -left-9 hidden h-24 w-16 xl:block"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M14 116C24 90 30 62 52 8" />
      </g>
      <g fill="currentColor" opacity="0.8">
        <path d="M52 8c-12 4-16 16-10 24 10-4 14-14 10-24Z" />
        <path d="M44 30c-14 0-22 10-18 20 12 0 20-8 18-20Z" />
        <path d="M46 36c10-6 22-4 26 4-8 8-20 6-26-4Z" />
        <path d="M36 58c-14 2-20 14-14 22 12-2 18-12 14-22Z" />
        <path d="M38 64c10-4 20 0 22 8-10 6-20 2-22-8Z" />
      </g>
    </svg>
  )
}
