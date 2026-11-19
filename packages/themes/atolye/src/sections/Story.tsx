import { fieldMark } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { BandPicture } from "./BandPicture"
import { type Of, headingId } from "./plan"

const PROSE =
  "flex max-w-[65ch] flex-col gap-4 text-md leading-[1.7] text-text-2 lg:text-lg [&_a]:py-3 [&_a]:font-semibold [&_a]:text-text [&_a]:underline [&_h3]:mt-4 [&_h3]:text-title [&_h3]:text-text [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_strong]:text-text [&_ul]:list-disc"

/**
 * The shop's own text (`rich_text`: its story, "Neden biz?"): the heading
 * large on the left, the text in a reading measure on the right, on the
 * tinted well. The HTML is the backend's, from its allow-listed schema
 * (adr/0019); without the shop's text the section is not on the page.
 * Its links take 12 px above and below as touch room (inline padding: the
 * lines do not move), so a link on its own line is a 44 px target.
 * `with_image` (adr/0073 §3) is drawn by `StoryWithImage`; the pane below
 * is the drawing from before variants, unchanged (adr/0066).
 */
export function Story({ section }: { section: Of<"rich_text"> }) {
  if (section.variant === "with_image" && section.image) {
    return <StoryWithImage section={section} image={section.image} />
  }
  const id = headingId(section.id)
  return (
    <section {...(section.title ? { "aria-labelledby": id } : {})} className="gf-section">
      <Container>
        <div className="grid gap-6 rounded-tile gf-pane p-6 sm:p-10 lg:grid-cols-12 lg:gap-(--gap-columns) lg:p-16">
          {section.title && (
            <h2 id={id} className="lg:col-span-5" {...fieldMark(section.editor, "title")}>
              {section.title}
            </h2>
          )}
          <div
            className={`${PROSE} ${section.title ? "lg:col-span-7" : "lg:col-span-8 lg:col-start-3"}`}
            // adr/0019: built by the backend from an allow-listed document schema
            dangerouslySetInnerHTML={{ __html: section.html }}
            {...fieldMark(section.editor, "body")}
          />
        </div>
      </Container>
    </section>
  )
}

/**
 * "Görselli metin" (adr/0073 §3): the same shadowed pane, the shop's
 * picture on one side (5/12, `imageSide`) and the heading and text on the
 * other (7/12) from 1024 px; on a phone the picture on top. The picture's
 * box holds its place before it loads (an aspect on a phone, the text's
 * height beside it), so nothing shifts; it loads lazily, its alt the
 * media library's or the shop's.
 */
function StoryWithImage({
  section,
  image,
}: {
  section: Of<"rich_text">
  image: NonNullable<Of<"rich_text">["image"]>
}) {
  const id = headingId(section.id)
  return (
    <section {...(section.title ? { "aria-labelledby": id } : {})} className="gf-section">
      <Container>
        <div className="grid overflow-hidden rounded-tile gf-pane lg:grid-cols-12">
          <div
            className={cn(
              "relative isolate aspect-[4/3] bg-media lg:col-span-5 lg:aspect-auto lg:min-h-80",
              section.imageSide === "end" && "lg:order-last"
            )}
          >
            <BandPicture
              image={image}
              phone={null}
              sizes="(min-width: 64rem) 40vw, 100vw"
              eager={false}
              mark={fieldMark(section.editor, "image")}
            />
          </div>
          <div className="flex flex-col justify-center gap-6 p-6 sm:p-10 lg:col-span-7 lg:p-16">
            {section.title && (
              <h2 id={id} {...fieldMark(section.editor, "title")}>
                {section.title}
              </h2>
            )}
            <div
              className={PROSE}
              // adr/0019: built by the backend from an allow-listed document schema
              dangerouslySetInnerHTML={{ __html: section.html }}
              {...fieldMark(section.editor, "body")}
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
