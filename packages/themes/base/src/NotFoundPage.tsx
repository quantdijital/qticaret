import { ArrowRight } from "lucide-react"
import type { Translate } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { PageContainer } from "./components/Container"

/** A 404: says so, offers the way home and search; the status code is the storefront's. */
export function NotFoundPage({ t }: { t: Translate }) {
  return (
    <PageContainer>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-16 text-center lg:py-24">
        <p className="font-heading text-8xl leading-none text-primary/25 lg:text-9xl">404</p>
        <h1 className="text-3xl leading-tight lg:text-4xl">{t("not_found.title")}</h1>
        <p className="text-muted-foreground">{t("not_found.body")}</p>
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
