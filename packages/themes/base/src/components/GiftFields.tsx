import { Gift } from "lucide-react"
import type { GiftRecipientView } from "@qticaret/ui"
import { TextField } from "../checkout/fields"

export interface GiftWords {
  title: string
  email: string
  name: string
  message: string
  /** Under the message: how long it may be, that it goes as plain text. */
  messageHint: string
  sender: string
}

/** The longest message the backend takes (adr/0025 Ek 2026-11-03); names take 60. */
const MESSAGE_MAX = 300
const NAME_MAX = 60

/**
 * Who a gift card goes to (adr/0025 Ek 2026-11-03): the address it is
 * e-mailed to, and as plain text the recipient's name, a message and the
 * sender's name. Plain fields of the form around them: they post without script.
 */
export function GiftFields({
  id,
  words,
  values = null,
}: {
  /** Keeps the fields' ids apart when a page has more than one gift form. */
  id: string
  words: GiftWords
  values?: GiftRecipientView | null
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-medium">
        <Gift className="size-4" aria-hidden="true" />
        {words.title}
      </legend>
      <TextField
        id={`${id}-email`}
        name="recipient_email"
        type="email"
        required
        maxLength={254}
        autoComplete="off"
        label={words.email}
        defaultValue={values?.email ?? ""}
      />
      <TextField
        id={`${id}-name`}
        name="recipient_name"
        maxLength={NAME_MAX}
        autoComplete="off"
        label={words.name}
        defaultValue={values?.name ?? ""}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-message`} className="text-sm font-medium">
          {words.message}
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={3}
          maxLength={MESSAGE_MAX}
          defaultValue={values?.message ?? ""}
          className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-[15px] outline-none placeholder:text-muted-foreground hover:border-foreground/30 focus-visible:border-foreground"
        />
        <p className="text-xs text-muted-foreground">{words.messageHint}</p>
      </div>
      <TextField
        id={`${id}-sender`}
        name="sender_name"
        maxLength={NAME_MAX}
        autoComplete="name"
        label={words.sender}
        defaultValue={values?.sender ?? ""}
      />
    </fieldset>
  )
}
