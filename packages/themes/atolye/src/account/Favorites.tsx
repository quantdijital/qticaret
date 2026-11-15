import { Heart } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { AccountActions, AccountPageView, Translate } from "@qticaret/ui"
import { ProductCard } from "../parts/ProductCard"
import { StartAisles } from "./StartAisles"

type Favorite = AccountPageView["favorites"][number]

/** A saved product not on sale here now: its photo and name, the link to its page. */
function PlainCard({ item }: { item: Favorite }) {
  return (
    <article className="group relative flex flex-col gap-3">
      <div className="aspect-card overflow-hidden rounded-media bg-media">
        {item.image && (
          <ResponsiveImage
            image={item.image}
            sizes="(min-width: 768px) 25vw, 46vw"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <h3 className="text-sm leading-snug font-semibold tracking-normal lg:text-md">
        <a
          href={item.path}
          className="line-clamp-2 no-underline underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
        >
          {item.title}
        </a>
      </h3>
    </article>
  )
}

/**
 * The customer's saved products as the shop's own cards (photo, name,
 * live price, stock), each with a filled heart on its photo's corner that
 * takes it off the list (a plain form). Nothing saved yet: what the heart
 * does, and the shop's categories to start from.
 */
export function Favorites({
  view,
  t,
  actions,
}: {
  view: AccountPageView
  t: Translate
  actions: AccountActions
}) {
  if (view.favorites.length === 0) {
    return (
      <>
        <div className="flex flex-col items-start gap-5 rounded-tile bg-paper-2 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-paper">
            <Heart className="size-6" aria-hidden="true" strokeWidth={1.75} />
          </span>
          <p className="flex flex-1 flex-col gap-1">
            <span className="text-lg font-semibold">{t("account.no_favorites")}</span>
            <span className="text-md text-text-2">{t("account.no_favorites_text")}</span>
          </p>
          <a href="/" className="gf-btn">
            {t("account.start_shopping")}
          </a>
        </div>
        <StartAisles
          id="favori-kategoriler"
          title={t("home.shop_categories")}
          categories={view.categories ?? []}
        />
      </>
    )
  }
  return (
    <section aria-labelledby="favori-sayisi" className="flex flex-col gap-5">
      <h2 id="favori-sayisi" className="text-title">
        {t("listing.count", { count: view.favorites.length })}
      </h2>
      <ul className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-(--gap-columns) gap-y-8 md:grid-cols-[repeat(3,minmax(0,1fr))] lg:gap-y-10">
        {view.favorites.map((item) => (
          <li key={item.id} className="relative min-w-0">
            {item.card ? <ProductCard product={item.card} t={t} /> : <PlainCard item={item} />}
            <form action={actions.removeFavorite} className="absolute top-2 right-2 z-(--z-raised)">
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                aria-label={t("account.remove_favorite", { title: item.title })}
                className="gf-icon-btn bg-field text-deal hover:bg-paper-2"
              >
                <Heart className="size-5 fill-current" aria-hidden="true" strokeWidth={1.75} />
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  )
}
