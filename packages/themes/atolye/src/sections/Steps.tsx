import { TitleText } from "../parts/TitleText"
import { fieldKey, fieldMark } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"

/** Steps a line from 1024 px side by side: up to four in one line, five or six three a line. */
const WIDE: Readonly<Record<number, string>> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-3",
  6: "lg:grid-cols-3",
}

/**
 * Numbered steps (`steps`, adr/0077 §10): the heading and an optional intro,
 * then three to six steps as one ordered list, each under a hairline, its
 * number set large in the heading face's heaviest weight in the quiet
 * third ink (the shop's colour stays on its one action), its title and an
 * optional line. `row`: side by side from 768 px (two a line, up to four
 * from 1024 px); `column`: one under another at a reading measure, the
 * number beside the words. The printed number is for the eye only: the
 * list says the order. One optional link under the steps, the section's
 * action. Its ground and alignment are the section's look (`Look`).
 * `connector: dotted` (a row only): from 1024 px a dotted line runs from
 * each number to the next instead of the hairlines (`steps-connector.css`).
 */
export function Steps({ section }: { section: Of<"steps"> }) {
  const id = headingId(section.id)
  const row = section.layout === "row"
  const qf = (at: number, part: string) => fieldMark(section.editor, fieldKey("items", at, part))
  return (
    <section aria-labelledby={id} className="gf-section">
      <Container className="flex flex-col gap-(--head-gap)">
        <div className="flex max-w-2xl flex-col gap-2 group-data-[align=center]/look:mx-auto group-data-[align=center]/look:items-center">
          <h2 id={id} {...fieldMark(section.editor, "title")}>
            <TitleText text={section.title} />
          </h2>
          {section.intro && (
            <p className="text-text-2" {...fieldMark(section.editor, "intro")}>
              {section.intro}
            </p>
          )}
        </div>
        <ol
          role="list"
          data-connector={row && section.connector === "dotted" ? "dotted" : undefined}
          className={cn(
            "grid gap-x-(--gap-columns) gap-y-(--gap-rows)",
            row
              ? cn("md:grid-cols-2", WIDE[section.items.length])
              : "w-full max-w-3xl group-data-[align=center]/look:mx-auto"
          )}
        >
          {section.items.map((item, at) => (
            <li
              key={`${String(at)}-${item.title}`}
              className={cn(
                "grid min-w-0 gap-3 border-t border-rule pt-5",
                row
                  ? "content-start group-data-[align=center]/look:justify-items-center group-data-[align=center]/look:text-center"
                  : "grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[5rem_minmax(0,1fr)]"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "tabular text-[clamp(2rem,1.2vw+1.6rem,2.75rem)] leading-none font-extrabold tracking-(--tracking-display) text-text-3",
                  !row && item.text && "row-span-2"
                )}
              >
                {item.number}
              </span>
              <h3 className="text-title font-semibold text-text" {...qf(at, "title")}>
                {item.title}
              </h3>
              {item.text && (
                <p className={cn("text-text-2", !row && "col-start-2")} {...qf(at, "text")}>
                  {item.text}
                </p>
              )}
            </li>
          ))}
        </ol>
        {section.link && (
          <p className="group-data-[align=center]/look:text-center">
            <a href={section.link.path} className="gf-btn" {...fieldMark(section.editor, "link")}>
              {section.link.label}
            </a>
          </p>
        )}
      </Container>
    </section>
  )
}
