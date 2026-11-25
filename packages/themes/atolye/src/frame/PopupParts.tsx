"use client"

import { useRef, useState } from "react"
import type { PlaceOrderResult, PopupView } from "@qticaret/ui"
import { copyText } from "@qticaret/ui/lib/popup-client"
import { cn } from "@qticaret/ui/lib/utils"
import { NewsletterForm } from "./NewsletterForm"
import type { PopupWords } from "./popup-words"

type Copied = "idle" | "copied" | "failed"

/**
 * A campaign's code (adr/0080 §2): the code itself in a well, selectable,
 * and "Kodu kopyala" beside it; what happened is said in a live region. An
 * automatic promotion has no code: the line says the cart applies it.
 */
export function CampaignCode({
  promotion,
  words,
  ticket = false,
  onCopy,
}: {
  promotion: NonNullable<PopupView["promotion"]>
  words: PopupWords
  /** The coupon design's: a dashed ticket, the code large and centred, the button under it. */
  ticket?: boolean
  onCopy: () => void
}) {
  const [copied, setCopied] = useState<Copied>("idle")
  const code = useRef<HTMLElement>(null)
  if (promotion.code === null) {
    return ticket ? (
      <p className="rounded-inner border-2 border-dashed border-edge px-4 py-4 text-center text-md font-semibold">
        {words.automatic}
      </p>
    ) : (
      <p className="text-sm font-semibold">{words.automatic}</p>
    )
  }
  const text = promotion.code
  const copy = async () => {
    onCopy()
    const done = await copyText(text)
    setCopied(done ? "copied" : "failed")
    if (!done && code.current) {
      // Selected for the visitor's own copy
      const range = document.createRange()
      range.selectNodeContents(code.current)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
    }
  }
  const status = (
    <p role="status" className={cn("min-h-[1lh] text-xs font-semibold", ticket && "text-center")}>
      {copied === "copied" ? words.copied : copied === "failed" ? words.copyFailed : null}
    </p>
  )
  if (ticket) {
    return (
      <div className="flex flex-col gap-1.5">
        <div
          data-popup-ticket=""
          className="relative flex flex-col items-center gap-3 rounded-inner border-2 border-dashed border-edge bg-paper-2 px-6 py-5 before:absolute before:top-1/2 before:-left-2.5 before:size-5 before:-translate-y-1/2 before:rounded-full before:bg-paper after:absolute after:top-1/2 after:-right-2.5 after:size-5 after:-translate-y-1/2 after:rounded-full after:bg-paper"
        >
          <span className="text-xs font-semibold tracking-wider text-text-2 uppercase">
            {words.code}
          </span>
          <code
            ref={code}
            className="max-w-full truncate font-mono text-display font-bold tracking-widest select-all"
          >
            {text}
          </code>
          <button type="button" onClick={() => void copy()} className="gf-btn max-sm:w-full">
            {words.copy}
          </button>
        </div>
        {status}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-inner bg-paper-2 p-1.5 pl-4">
        <span className="sr-only">{words.code}</span>
        <code
          ref={code}
          className="min-w-0 flex-1 truncate font-mono text-md font-bold tracking-wider select-all"
        >
          {text}
        </code>
        <button type="button" onClick={() => void copy()} className="gf-btn gf-btn--small shrink-0">
          {words.copy}
        </button>
      </div>
      {status}
    </div>
  )
}

/** Whether a link leaves the shop (an https address elsewhere). */
const leavesShop = (href: string) =>
  /^https?:\/\//i.test(href) && URL.parse(href)?.origin !== window.location.origin

/** The pop-up's button: a link on the shop, or elsewhere without the opener and the referrer. */
export function PopupLink({
  button,
  onFollow,
}: {
  button: NonNullable<PopupView["button"]>
  onFollow: () => void
}) {
  return (
    <a
      href={button.href}
      onClick={onFollow}
      {...(leavesShop(button.href) ? { rel: "noopener noreferrer" } : {})}
      className="gf-btn self-start max-sm:w-full"
    >
      {button.label}
    </a>
  )
}

/**
 * A newsletter pop-up's form: the footer box's own (double opt-in, the
 * consent box unticked and required, its sentence the shop's), its button
 * the pop-up's words when the shop wrote some. A subscription taken is
 * counted; the form then says the confirmation mail is on its way.
 */
export function PopupNewsletter({
  popup,
  words,
  privacyPath,
  subscribe,
  onSignup,
}: {
  popup: PopupView
  words: PopupWords
  privacyPath: string | null
  subscribe: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  onSignup: () => void
}) {
  const action = async (state: PlaceOrderResult, form: FormData) => {
    const result = await subscribe(state, form)
    if (result.ok) {
      onSignup()
    }
    return result
  }
  return (
    <NewsletterForm
      id={`popup-${popup.id}`}
      action={action}
      privacyPath={privacyPath}
      words={{ ...words.newsletter, submit: popup.submitLabel ?? words.newsletter.submit }}
    />
  )
}
