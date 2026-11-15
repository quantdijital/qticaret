"use client"

import { Trash2 } from "lucide-react"
import { useActionState } from "react"
import { ResponsiveImage } from "@qticaret/ui"
import type { CartLineView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { LineAddons } from "../parts/LineAddons"
import { LineName, LinePhoto } from "../parts/LineLink"
import { LinePrice } from "../parts/LinePrice"
import { MAX_QUANTITY, Stepper } from "../parts/Stepper"

export interface SheetLineWords {
  /** With `{count}` where the quantity goes ("2 adet"). */
  quantity: string
  /** With `{title}`: "Çakı ürününü sepetten kaldır". */
  remove: string
  /** With `{title}`: "Çakı adedi". */
  group: string
  decrease: string
  increase: string
  before: string
  /** A line made to the buyer's wish: no right of withdrawal. */
  nonWithdrawable: string
}

const named = (template: string, title: string) => template.replace("{title}", title)

/** The line's own controls, dimmed and busy while its change is on its way. */
function Controls({
  line,
  pending,
  words,
}: {
  line: CartLineView
  pending: boolean
  words: SheetLineWords
}) {
  return (
    <>
      <button
        type="submit"
        name="remove"
        value="1"
        disabled={pending}
        aria-label={named(words.remove, line.title)}
        className="gf-icon-btn -mt-2 -mr-2 size-11 shrink-0 self-start text-text-3 disabled:opacity-40"
      >
        <Trash2 className="size-4.5" aria-hidden="true" strokeWidth={2} />
      </button>
      <div
        aria-busy={pending || undefined}
        className={cn(
          "col-span-2 flex items-end justify-between gap-3 transition-opacity duration-(--dur-micro)",
          pending && "opacity-60"
        )}
      >
        <Stepper
          quantity={line.quantity}
          most={line.maxQuantity ?? MAX_QUANTITY}
          busy={pending}
          words={{
            group: named(words.group, line.title),
            decrease: words.decrease,
            increase: words.increase,
          }}
        />
        <LinePrice
          total={line.total}
          original={line.original}
          before={words.before}
          note={line.taxNote}
        />
      </div>
    </>
  )
}

function Picture({ line }: { line: CartLineView }) {
  return (
    <LinePhoto
      path={line.path}
      className="size-20 shrink-0 overflow-hidden rounded-inner bg-media-deep"
    >
      {line.image && (
        <ResponsiveImage
          image={{ ...line.image, alt: "" }}
          sizes="80px"
          className="h-full w-full object-cover"
        />
      )}
    </LinePhoto>
  )
}

function Words({ line, words }: { line: CartLineView; words: SheetLineWords }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="line-clamp-2 leading-snug font-semibold">
        <LineName path={line.path} title={line.title} />
      </span>
      {line.detail && line.detail.trim() !== line.title.trim() && (
        <span className="text-text-3">{line.detail}</span>
      )}
      <LineAddons addons={line.addons} note={line.nonWithdrawable ? words.nonWithdrawable : null} />
    </div>
  )
}

/**
 * A line in the cart drawer: its photograph and name (one link to its
 * product's page, when it has one), variant and picks; the
 * quantity pill and the bin as the line form's own buttons (the
 * storefront's `changeCartLine`), its price on the right, struck price
 * above it. Without the action, or for a payment link's line, the line
 * reads only, its count in words.
 */
export function CartSheetLine({
  line,
  change,
  locked,
  words,
}: {
  line: CartLineView
  change: ((form: FormData) => Promise<void>) | undefined
  locked: boolean
  words: SheetLineWords
}) {
  if (!change || locked) {
    return <ReadOnlyLine line={line} words={words} />
  }
  return <LineForm line={line} change={change} words={words} />
}

/** The line with its controls; the change runs as the form's action, the line busy meanwhile. */
function LineForm({
  line,
  change,
  words,
}: {
  line: CartLineView
  change: (form: FormData) => Promise<void>
  words: SheetLineWords
}) {
  const [, act, pending] = useActionState(async (_state: null, form: FormData) => {
    await change(form)
    return null
  }, null)
  return (
    <li className="flex gap-3 rounded-media gf-box p-3">
      <Picture line={line} />
      <form
        action={act}
        className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] content-between gap-x-1 gap-y-2"
      >
        <input type="hidden" name="line_id" value={line.id} />
        <Words line={line} words={words} />
        <Controls line={line} pending={pending} words={words} />
      </form>
    </li>
  )
}

/** A payment link's line, or one without the action: its count in words. */
function ReadOnlyLine({ line, words }: { line: CartLineView; words: SheetLineWords }) {
  return (
    <li className="flex gap-3 rounded-media gf-box p-3">
      <Picture line={line} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Words line={line} words={words} />
        <div className="mt-auto flex items-end justify-between gap-3 text-sm text-text-3">
          <span>{words.quantity.replace("{count}", String(line.quantity))}</span>
          <LinePrice
            total={line.total}
            original={line.original}
            before={words.before}
            note={line.taxNote}
          />
        </div>
      </div>
    </li>
  )
}
