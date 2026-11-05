import { ArrowRight } from "lucide-react"
import type { Translate } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { PageContainer } from "./components/Container"

const WORDS = {
  missing: { number: "404", title: "not_found.title", body: "not_found.body" },
  gone: { number: "410", title: "gone.title", body: "gone.body" },
} as const

/** A missing (404) or removed (410) page: says so, offers the way home and search; the status code is the storefront's. */
function MissingPage({ t, kind }: { t: Translate; kind: keyof typeof WORDS }) {
  const words = WORDS[kind]
  return (
    <PageContainer>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-16 text-center lg:py-24">
        <p className="font-heading text-8xl leading-none text-primary/25 lg:text-9xl">
          {words.number}
        </p>
        <h1 className="text-3xl leading-tight lg:text-4xl">{t(words.title)}</h1>
        <p className="text-muted-foreground">{t(words.body)}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button asChild size="lg" className="h-12 rounded-button px-7">
            <a href="/">
              {t("not_found.home")}
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-button bg-transparent px-7 shadow-none"
          >
            <a href="/arama">{t("not_found.search")}</a>
          </Button>
        </div>
      </div>
    </PageContainer>
  )
}

/** A 404. */
export function NotFoundPage({ t }: { t: Translate }) {
  return <MissingPage t={t} kind="missing" />
}

/** A 410 (adr/0046 Ek 2026-11-05): a page the shop removed for good. */
export function GonePage({ t }: { t: Translate }) {
  return <MissingPage t={t} kind="gone" />
}
