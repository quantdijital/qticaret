import { ArrowRight, ArrowUpRight, Mail, MessageCircle, Phone } from "lucide-react"
import type { ContactView, HomePageView, LinkView, Translate } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "./components/Container"
import { PostCard } from "./components/PostCard"
import { ProductGrid } from "./components/ProductCard"

const number = (index: number) => String(index + 1).padStart(2, "0")

/** The opening's side: the first categories as a numbered index on a dark panel. */
function CategoryIndex({ categories, t }: { categories: LinkView[]; t: Translate }) {
  return (
    <nav
      aria-label={t("home.category_index")}
      className="flex flex-col justify-between gap-8 rounded-3xl bg-ink p-6 text-ink-foreground sm:p-8"
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-ink-muted uppercase">
        {t("home.category_index")}
      </p>
      <ol className="flex flex-col">
        {categories.map((category, index) => (
          <li key={category.path} className="border-b border-ink-foreground/10 last:border-0">
            <a
              href={category.path}
              className="group flex items-baseline gap-4 py-3.5 transition-colors"
            >
              <span className="tabular w-6 text-xs text-ink-muted">{number(index)}</span>
              <span className="font-heading flex-1 text-2xl leading-tight transition-transform duration-300 group-hover:translate-x-1 sm:text-[1.75rem]">
                {category.label}
              </span>
              <ArrowUpRight
                className="size-5 self-center text-ink-muted transition-colors group-hover:text-ink-foreground"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ol>
      <a
        href="#kategoriler"
        className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink-foreground"
      >
        {t("home.all_categories")}
        <ArrowRight className="size-4" aria-hidden="true" />
      </a>
    </nav>
  )
}

/** A heading row: the section's name, and a link to see more when there is one. */
function SectionHead({ id, title, more }: { id: string; title: string; more?: LinkView }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="text-3xl leading-tight lg:text-4xl">
        {title}
      </h2>
      {more && (
        <a
          href={more.path}
          className="group flex shrink-0 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
        >
          {more.label}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      )}
    </div>
  )
}

/** The dark band that invites a question: WhatsApp, phone and e-mail, whichever the shop gave. */
function HelpBand({ help, t }: { help: ContactView; t: Translate }) {
  return (
    <section
      aria-labelledby="yardim"
      className="grid gap-8 overflow-hidden rounded-3xl bg-ink px-6 py-10 text-ink-foreground sm:px-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-14 lg:py-14"
    >
      <div className="flex flex-col gap-3">
        <h2 id="yardim" className="text-3xl leading-tight lg:text-4xl">
          {t("home.help_title")}
        </h2>
        <p className="max-w-lg text-ink-muted">{t("home.help_text")}</p>
      </div>
      <ul className="flex flex-wrap gap-3 lg:justify-end">
        {help.whatsappHref && (
          <li>
            <a
              href={help.whatsappHref}
              target="_blank"
              rel="noopener"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink-foreground px-6 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {t("home.help_whatsapp")}
            </a>
          </li>
        )}
        {help.phone && help.phoneHref && (
          <li>
            <a
              href={help.phoneHref}
              className="tabular inline-flex h-12 items-center gap-2 rounded-full border border-ink-foreground/25 px-6 text-sm font-semibold transition-colors hover:bg-ink-foreground/10"
            >
              <Phone className="size-4" aria-hidden="true" />
              {help.phone}
            </a>
          </li>
        )}
        {help.email && (
          <li>
            <a
              href={`mailto:${help.email}`}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-ink-foreground/25 px-6 text-sm font-semibold transition-colors hover:bg-ink-foreground/10"
            >
              <Mail className="size-4" aria-hidden="true" />
              {help.email}
            </a>
          </li>
        )}
      </ul>
    </section>
  )
}

/**
 * The home page: the shop's opening beside a numbered index of its first
 * categories, every top category as a tile, the newest products, an
 * "ask us" band and the newest posts. The shop's own blocks (banners,
 * rails) come with the home editor (D11).
 */
export function HomePage({ view, t }: { view: HomePageView; t: Translate }) {
  const [first, second] = view.actions
  const indexed = view.categories.slice(0, 5)
  return (
    <Container className="flex flex-col gap-20 pt-6 lg:gap-28 lg:pt-10">
      <section
        aria-labelledby="giris"
        className={cn("grid gap-6", indexed.length > 0 && "lg:grid-cols-12 lg:gap-8")}
      >
        <div className="flex flex-col justify-center gap-7 rounded-3xl border bg-card px-6 py-12 sm:px-10 lg:col-span-7 lg:px-14 lg:py-20">
          {view.eyebrow && (
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              {view.eyebrow}
            </p>
          )}
          <h1 id="giris" className="text-[2.75rem] leading-[1.02] sm:text-6xl xl:text-7xl">
            {view.heading}
          </h1>
          {view.intro && (
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{view.intro}</p>
          )}
          {first && (
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-[15px]">
                <a href={first.path}>
                  {first.label}
                  <ArrowRight aria-hidden="true" />
                </a>
              </Button>
              {second && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full bg-transparent px-7 text-[15px] shadow-none"
                >
                  <a href={second.path}>{second.label}</a>
                </Button>
              )}
            </div>
          )}
        </div>
        {indexed.length > 0 && (
          <div className="lg:col-span-5">
            <CategoryIndex categories={indexed} t={t} />
          </div>
        )}
      </section>

      {view.categories.length > 0 && (
        <section aria-labelledby="kategoriler" className="flex scroll-mt-40 flex-col gap-8">
          <SectionHead id="kategoriler" title={t("home.shop_categories")} />
          {/* An index in columns: any number of categories fills it without gaps */}
          <ul className="gap-x-10 rounded-3xl border bg-card px-6 py-3 sm:columns-2 sm:px-8 lg:columns-3 lg:px-10 lg:py-5">
            {view.categories.map((category, index) => (
              <li key={category.path} className="break-inside-avoid border-b last:border-0">
                <a href={category.path} className="group flex items-center gap-4 py-4">
                  <span className="tabular w-6 text-xs font-medium text-muted-foreground">
                    {number(index)}
                  </span>
                  <span className="font-heading flex-1 text-xl leading-tight transition-transform duration-300 group-hover:translate-x-1 lg:text-[1.375rem]">
                    {category.label}
                  </span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="urunler" className="flex flex-col gap-8">
        <SectionHead
          id="urunler"
          title={t("home.products")}
          more={{ label: t("home.all_products"), path: "/magaza" }}
        />
        {view.products.length > 0 ? (
          <ProductGrid products={view.products} t={t} eager={4} />
        ) : (
          <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
            {t("home.no_products")}
          </p>
        )}
      </section>

      {view.help && <HelpBand help={view.help} t={t} />}

      {view.posts.length > 0 && (
        <section aria-labelledby="yazilar" className="flex flex-col gap-8">
          <SectionHead
            id="yazilar"
            title={t("home.posts")}
            more={{ label: t("home.all_posts"), path: "/blog" }}
          />
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {view.posts.map((post) => (
              <li key={post.path}>
                <PostCard post={post} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  )
}
