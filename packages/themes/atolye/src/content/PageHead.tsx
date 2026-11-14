import { ResponsiveImage } from "@qticaret/ui"
import type { ContentPageView, Translate } from "@qticaret/ui"
import { Trail } from "../parts/Trail"

/** A draft's preview says it is one, above everything. */
export function Notice({ text }: { text: string | null | undefined }) {
  return text ? (
    <p role="status" className="rounded-media bg-highlight-soft px-5 py-3 text-sm font-semibold">
      {text}
    </p>
  ) : null
}

/**
 * A content page's opening: the trail, then the title. With the page's
 * own cover the title stands on a graphite stage beside the photograph,
 * whose dark edge merges into the graphite (on a phone the photograph
 * above it, short); without one the title stands on the counter.
 */
export function PageHead({ view, t }: { view: ContentPageView; t: Translate }) {
  const image = view.image ?? null
  return (
    <div className="flex flex-col gap-6 lg:gap-10">
      <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} />
      <Notice text={view.notice} />
      {image ? (
        <div className="gf-stage grid overflow-hidden rounded-tile lg:min-h-[26rem] lg:grid-cols-12">
          <div className="relative aspect-[16/10] after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:via-stage/0 after:via-40% lg:order-2 lg:col-span-7 lg:aspect-auto lg:after:bg-linear-to-r lg:after:via-45%">
            <ResponsiveImage
              image={{ ...image, alt: "" }}
              sizes="(min-width: 1440px) 820px, (min-width: 1024px) 58vw, 100vw"
              priority
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="relative flex flex-col justify-end gap-4 p-6 pt-2 sm:p-8 lg:col-span-5 lg:p-12">
            <h1 className="text-display">{view.title}</h1>
          </div>
        </div>
      ) : (
        <h1 className="max-w-[28ch]">{view.title}</h1>
      )}
    </div>
  )
}
