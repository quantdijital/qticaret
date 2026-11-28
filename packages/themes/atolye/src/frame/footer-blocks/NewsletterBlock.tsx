import type { PlaceOrderResult } from "@qticaret/ui"
import { NewsletterForm } from "../NewsletterForm"
import { newsletterWords } from "../newsletter-words"
import { BlockTitle, blockHeadingId, blockMark } from "./shared"
import type { BlockProps } from "./shared"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

/**
 * The newsletter box in a column (adr/0070 §2: the box's own variants
 * that fit one): `standard` the field over its button, as the brand
 * columns' strip draws it; `in_footer` the small joined field. The
 * sending and the consent are today's (`NewsletterForm`); none on a page
 * without sending.
 */
export function NewsletterBlock({
  block,
  shop,
  t,
  editor,
  subscribe,
}: BlockProps<"newsletter"> & { subscribe?: Subscribe | undefined }) {
  if (!subscribe) {
    return null
  }
  const joined = block.variant === "in_footer"
  return (
    <section
      aria-labelledby={blockHeadingId(block.at)}
      data-news={block.variant}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <BlockTitle at={block.at} editor={editor} className={joined ? undefined : "text-md"}>
          {block.title}
        </BlockTitle>
        {block.description && (
          <p
            className="max-w-[52ch] text-xs text-text-2"
            {...blockMark(editor, block.at, "description")}
          >
            {block.description}
          </p>
        )}
      </div>
      <NewsletterForm
        id="bulten-blok"
        quiet
        joined={joined}
        action={subscribe}
        privacyPath={shop.privacyPath}
        words={newsletterWords(t, block.consent, block.consentStyle)}
        marks={editor}
        textKey={`blocks.${String(block.at)}.text`}
      />
    </section>
  )
}
