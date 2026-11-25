import { EyeOff } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { PartKey } from "./parts"
import type { ShownWhy } from "./use-page-layout"

const L = "products.layout"

/**
 * A part of the product page in its place. One the shop hid but the page
 * shows anyway (it needs the person, or they asked for it) says so in a
 * line above it; a part that draws nothing leaves no gap (`contents`).
 */
export function PartSlot({
  part,
  why,
  children,
}: {
  part: PartKey
  why: ShownWhy | null
  children: ReactNode
}) {
  const { t } = useTranslation()
  // One element either way, the card always its second child: a part that
  // gains or loses its line keeps what is typed in it
  return (
    <div
      data-part={part}
      data-shown-hidden={why ?? undefined}
      className={
        why
          ? // A part that draws nothing here (add-ons off) leaves no lone line either
            "hidden min-w-0 flex-col gap-1.5 has-[>:nth-child(2)]:flex"
          : "contents"
      }
    >
      {why ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
          {t(why === "attention" ? `${L}.shownAttention` : `${L}.shownRevealed`)}
        </p>
      ) : null}
      {children}
    </div>
  )
}

/**
 * Under the page: the parts the shop hid, by name, and "Göster" to bring
 * them back for this visit (the layout itself stays). Nothing hidden, no line.
 */
export function HiddenLine({ parts, onShow }: { parts: readonly PartKey[]; onShow: () => void }) {
  const { t } = useTranslation()
  if (parts.length === 0) {
    return null
  }
  const names = parts.map((part) => t(`${L}.parts.${part}`)).join(", ")
  return (
    <p
      data-hidden-line=""
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground"
    >
      <EyeOff className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{t(`${L}.hiddenLine`, { names })}</span>
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onShow}>
        {t(`${L}.showHidden`)}
      </Button>
    </p>
  )
}
