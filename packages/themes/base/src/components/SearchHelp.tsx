import { Fragment } from "react"
import type { LinkView, SearchHelpView, Translate } from "@qticaret/ui"

/** A titled row of links as chips. */
function ChipRow({
  title,
  links,
  nofollow = false,
}: {
  title: string
  links: LinkView[]
  nofollow?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <h2 className="shrink-0 text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.path}>
            <a
              href={link.path}
              rel={nofollow ? "nofollow" : undefined}
              className="inline-flex h-10 items-center rounded-button border bg-card px-4 text-sm font-medium transition-colors hover:border-foreground"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A search's help above its results: "did you mean" phrases as links,
 * the categories most results are in, and the brands that narrow the
 * search (a filter: nofollow).
 */
export function SearchHelp({ help, t }: { help: SearchHelpView; t: Translate }) {
  // The shop's categories to start from (`popular`) are another theme's to draw
  if (help.suggestions.length + help.categories.length + help.brands.length === 0) {
    return null
  }
  return (
    <section aria-label={t("search.help")} className="flex flex-col gap-4">
      {help.suggestions.length > 0 && (
        <p className="text-base">
          {t("search.did_you_mean")}{" "}
          {help.suggestions.map((suggestion, index) => (
            <Fragment key={suggestion.path}>
              {index > 0 && ", "}
              <a
                href={suggestion.path}
                className="font-semibold underline underline-offset-4 hover:no-underline"
              >
                {suggestion.label}
              </a>
            </Fragment>
          ))}
        </p>
      )}
      {help.categories.length > 0 && (
        <ChipRow title={t("search.related_categories")} links={help.categories} />
      )}
      {help.brands.length > 0 && (
        <ChipRow title={t("search.related_brands")} links={help.brands} nofollow />
      )}
    </section>
  )
}
