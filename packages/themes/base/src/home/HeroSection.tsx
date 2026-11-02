import { ArrowRight } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { HomeSectionView } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { cn } from "@qticaret/ui/lib/utils"
import { headingId } from "./SectionHead"

type Hero = Extract<HomeSectionView, { type: "hero" }>

/** The opening: the shop's line and buttons, beside its picture when it chose one. */
export function HeroSection({ section, first }: { section: Hero; first: boolean }) {
  const [main, second] = section.actions
  const id = headingId(section.id)
  // The page's one h1 is the first opening; a later one is a section
  const Heading = first ? "h1" : "h2"
  return (
    <section
      aria-labelledby={id}
      className={cn("grid gap-6", section.image && "lg:grid-cols-12 lg:gap-8")}
    >
      <div className="flex flex-col justify-center gap-7 rounded-3xl border bg-card px-6 py-12 sm:px-10 lg:col-span-7 lg:px-14 lg:py-20">
        {section.eyebrow && (
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-highlight" />
            {section.eyebrow}
          </p>
        )}
        <Heading id={id} className="text-[2.75rem] leading-[1.02] sm:text-6xl xl:text-7xl">
          {section.heading}
        </Heading>
        {section.intro && (
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{section.intro}</p>
        )}
        {main && (
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild size="lg" className="h-12 rounded-button px-7 text-[15px]">
              <a href={main.path}>
                {main.label}
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            {second && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-button bg-transparent px-7 text-[15px] shadow-none"
              >
                <a href={second.path}>{second.label}</a>
              </Button>
            )}
          </div>
        )}
      </div>
      {section.image && (
        <div className="overflow-hidden rounded-3xl border bg-card lg:col-span-5">
          <ResponsiveImage
            image={section.image}
            sizes="(min-width: 1024px) 40vw, 100vw"
            priority={first}
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </section>
  )
}
