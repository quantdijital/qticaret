import { fieldKey, fieldMark } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { SectionIcon } from "../parts/SectionIcon"
import { type Of, headingId } from "./plan"
import { SectionHead } from "./SectionHead"

/** Figures a line from 1024 px: all of them, as the shop has two to six. */
const WIDE: Readonly<Record<number, string>> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
}

/** From 768 px: three a line where the count splits into threes, else two. */
const MIDDLE: Readonly<Record<number, string>> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2",
  5: "md:grid-cols-3",
  6: "md:grid-cols-3",
}

/**
 * The figures strip (`stats`, adr/0077 §10): the shop's two to six figures
 * set large in the heading face's heaviest weight, each over its label and
 * an optional quiet line; two a line on a phone, all in one line from
 * 1024 px. With `dividers` on, hairlines part them (a rule above each on a
 * narrow screen, beside each from 1024 px); off, space alone. One list
 * (`dl`): a screen reader hears each label with its value; the figure
 * stands first only for the eye. The values are the shop's words as they
 * are, never counted up or moved. Its ground and alignment are the
 * section's look (`Look`): on the graphite stage the figures turn light
 * with the stage's own inks, centred the head and every figure centre.
 */
export function Stats({ section }: { section: Of<"stats"> }) {
  const id = headingId(section.id)
  const count = section.items.length
  const lined = section.dividers === "on"
  const qf = (at: number, part: string) => fieldMark(section.editor, fieldKey("items", at, part))
  return (
    <section
      {...(section.title ? { "aria-labelledby": id } : { "aria-label": section.label })}
      className="gf-section"
    >
      <Container className="flex flex-col gap-(--head-gap)">
        {section.title && <SectionHead id={id} title={section.title} marks={section.editor} />}
        <dl
          className={cn(
            "grid grid-cols-2 gap-x-(--gap-columns) gap-y-(--gap-rows)",
            MIDDLE[count],
            WIDE[count],
            lined && "lg:gap-x-0"
          )}
        >
          {section.items.map((item, at) => (
            <div
              key={`${String(at)}-${item.value}`}
              className={cn(
                "flex min-w-0 flex-col gap-2 group-data-[align=center]/look:items-center group-data-[align=center]/look:text-center",
                lined &&
                  "border-t border-rule pt-5 lg:border-t-0 lg:border-l lg:px-(--gap-columns) lg:pt-0 lg:first:border-l-0 lg:first:pl-0"
              )}
            >
              <dt className="order-2 text-md font-semibold text-text" {...qf(at, "label")}>
                {item.label}
              </dt>
              <dd
                className="tabular order-1 text-[clamp(2.25rem,1.8vw+1.6rem,3.5rem)] leading-none font-extrabold tracking-(--tracking-display) break-words"
                {...qf(at, "value")}
              >
                {item.value}
              </dd>
              {item.text && (
                <dd className="order-3 max-w-[32ch] text-sm text-text-2" {...qf(at, "text")}>
                  {item.text}
                </dd>
              )}
              {/* The figure's icon over its value, for the eye only (adr/0077 §10 Ek) */}
              {item.icon && (
                <dd
                  aria-hidden="true"
                  className="order-0 text-signal in-[.gf-stage]:text-signal-on-stage"
                >
                  <SectionIcon icon={item.icon} className="size-8 shrink-0 lg:size-9" />
                </dd>
              )}
            </div>
          ))}
        </dl>
      </Container>
    </section>
  )
}
