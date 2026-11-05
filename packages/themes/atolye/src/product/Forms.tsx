"use client"

import { CircleCheck, Star } from "lucide-react"
import { useActionState } from "react"
import type { ReactNode } from "react"
import type { ActionResult, FormAction } from "@qticaret/ui"
import type { CommunityWords } from "./words"

const INITIAL: ActionResult = { ok: false, error: null }

const FIELD = "gf-field rounded-inner"

/** A refusal under the button, in the shop's words for it. */
function Refusal({
  state,
  failed,
  words,
}: {
  state: ActionResult
  failed: string
  words: CommunityWords
}) {
  return (
    <p role="status" className="text-sm empty:hidden">
      {state.error && <span className="text-error">{words.errors[state.error] ?? failed}</span>}
    </p>
  )
}

/** Sent: the form gives way to what happens next, and the way out (`done`). */
function Sent({ text, done }: { text: string; done?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <p
        role="status"
        className="flex items-start gap-3 rounded-media bg-paper-2 p-4 font-semibold"
      >
        <CircleCheck className="size-5 shrink-0 text-ok" aria-hidden="true" strokeWidth={2} />
        {text}
      </p>
      {done}
    </div>
  )
}

const SEND = "gf-btn w-full sm:w-auto sm:self-start"

/**
 * A signed-in customer's review: the stars as five real radios (arrow
 * keys move them, each star 44 px), a title, the text, up to three
 * photos (`multipart/form-data`, adr/0037 Ek 2026-11-04). It goes to the
 * shop for approval; the answer says so.
 */
export function ReviewForm({
  productId,
  write,
  words,
  placeholders,
  done,
}: {
  productId: string
  write: FormAction
  words: CommunityWords
  /** The examples inside the title and the text. */
  placeholders: { title: string; body: string }
  /** Shown under the thanks once it is sent (the dialog's "Kapat"). */
  done?: ReactNode
}) {
  const [state, send, pending] = useActionState(write, INITIAL)
  if (state.ok) {
    return <Sent text={words.reviewSent} done={done} />
  }
  return (
    <form action={send} className="flex flex-col gap-5">
      <input type="hidden" name="product_id" value={productId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{words.rating}</legend>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className="flex size-11 cursor-pointer items-center justify-center rounded-pill text-edge transition-colors duration-(--dur-micro) hover:text-star has-[:checked]:text-star has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus [&:has(~label:hover)]:text-star [&:has(~label_:checked)]:text-star"
            >
              <input
                type="radio"
                name="rating"
                value={value}
                required
                defaultChecked={value === 5}
                className="sr-only"
              />
              <Star className="size-7 fill-current" aria-hidden="true" strokeWidth={1.5} />
              <span className="sr-only">{words.stars[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="yorum-baslik" className="text-sm font-semibold">
          {words.reviewTitle}
        </label>
        <input
          id="yorum-baslik"
          name="title"
          maxLength={100}
          placeholder={placeholders.title}
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="yorum-metin" className="text-sm font-semibold">
          {words.reviewBody}
        </label>
        <textarea
          id="yorum-metin"
          name="body"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder={placeholders.body}
          className="gf-field min-h-28 rounded-inner"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="yorum-foto" className="text-sm font-semibold">
          {words.addPhotos}
        </label>
        <input
          id="yorum-foto"
          type="file"
          name="photos"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          aria-describedby="yorum-foto-ipucu"
          className="text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-pill file:border-0 file:bg-paper-3 file:px-4 file:font-semibold file:text-text"
        />
        <p id="yorum-foto-ipucu" className="text-xs text-text-2">
          {words.photosHint}
        </p>
      </div>
      <button type="submit" disabled={pending} aria-busy={pending} className={SEND}>
        {pending ? words.sending : words.send}
      </button>
      <Refusal state={state} failed={words.reviewFailed} words={words} />
    </form>
  )
}

/** A signed-in customer's question about the product; answered, it shows under it. */
export function QuestionForm({
  productId,
  ask,
  words,
  placeholder,
  done,
}: {
  productId: string
  ask: FormAction
  words: CommunityWords
  /** The nudge inside the question's box. */
  placeholder: string
  /** Shown under the thanks once it is sent (the dialog's "Kapat"). */
  done?: ReactNode
}) {
  const [state, send, pending] = useActionState(ask, INITIAL)
  if (state.ok) {
    return <Sent text={words.questionSent} done={done} />
  }
  return (
    <form action={send} className="flex flex-col gap-3">
      <input type="hidden" name="product_id" value={productId} />
      <label htmlFor="soru-metin" className="text-sm font-semibold">
        {words.questionBody}
      </label>
      <textarea
        id="soru-metin"
        name="body"
        required
        minLength={5}
        maxLength={1000}
        rows={4}
        placeholder={placeholder}
        className="gf-field min-h-32 rounded-inner"
      />
      <button type="submit" disabled={pending} aria-busy={pending} className={`${SEND} mt-2`}>
        {pending ? words.sending : words.ask}
      </button>
      <Refusal state={state} failed={words.questionFailed} words={words} />
    </form>
  )
}
