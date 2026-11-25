/**
 * The full image opening's drawn marks (`HeroFull`), each for the eye
 * only (`aria-hidden`), inline so nothing is fetched: the page's ground
 * washing over the photograph (`image_side: blend`), the curl under the
 * heading's second line (`accent_mark: swash`) and a sprig of leaves by
 * the words (`ornament: leaves`). Their colours are the theme's tokens.
 */

/**
 * The page's ground over the photograph from the words' side, from 1024 px:
 * a soft see-through edge, the solid ground the words stand on, a rise at
 * the far corner and a low wave along the foot into the page. Stretched to
 * the opening (`preserveAspectRatio="none"`), so the shapes keep their
 * place on any width.
 */
export function HeroWash() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 800"
      preserveAspectRatio="none"
      className="gf-cover-wash pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
    >
      <path
        className="fill-paper"
        opacity="0.55"
        d="M0 0h760c40 70 30 150-10 220-38 68-22 140 16 205 40 70 18 150-60 205-80 58-200 80-310 120C290 790 140 800 0 800Z"
      />
      <path
        className="fill-paper"
        opacity="0.96"
        d="M0 0h680c34 60 26 130-8 192-34 62-24 128 8 188 34 64 14 136-56 182-74 50-190 66-292 100C230 690 110 720 0 760Z"
      />
      <path
        className="fill-paper"
        opacity="0.9"
        d="M1440 430c-60 34-96 110-70 186 18 54-20 118-96 184h166Z"
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
 * A sprig of leaves at the opening's start edge, from 1024 px: a curved
 * stem and five leaves in a light tint of the shop's colour.
 */
export function HeroLeaves() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 80 120"
      className="gf-cover-leaves pointer-events-none absolute top-[14%] left-3 hidden h-28 w-20 lg:block xl:left-6"
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
