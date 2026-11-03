import { Braces } from "lucide-react"
import { useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useShopTokenValues } from "@/features/settings/api/shop-tokens"
import {
  SHOP_TOKENS,
  SHOP_TOKEN_KEYS,
  fillShopText,
  hasShopToken,
  insertToken,
} from "@/features/settings/shop-tokens"
import { cn } from "@/lib/utils"

const K = "shopTokens"

/** A token a text offers besides the shop's details (a campaign's `{ad}`), with its own words. */
export interface ExtraToken {
  name: string
  label: string
  hint: string
}

interface ShopTokenMenuProps {
  /** The token's name, without its braces: a shop detail or one of `extra`. */
  onPick: (name: string) => void
  /** Once the menu closes; true when it put the focus somewhere itself (else it returns to the button). */
  onClosed?: () => boolean
  /** An icon inside a field, or a named button in the editor's toolbar. */
  variant?: "field" | "toolbar"
  className?: string
  /** Offered first, above the shop's details. */
  extra?: readonly ExtraToken[] | undefined
}

/**
 * "Bilgi ekle" (adr/0048): the shop's details a text may stand in for, each
 * with what it shows now, so the owner sees what the storefront will say.
 * The values are asked for only once the menu opens.
 */
export function ShopTokenMenu({
  onPick,
  onClosed,
  variant = "field",
  className,
  extra = [],
}: ShopTokenMenuProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const values = useShopTokenValues(open)
  const label = t(`${K}.insert`)
  const trigger =
    variant === "toolbar" ? (
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={cn("h-8", className)}>
          <Braces />
          {label}
        </Button>
      </DropdownMenuTrigger>
    ) : (
      // Its own provider: a field may sit outside the shell's (a dialog, a test)
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={label}
                className={cn("size-7 text-muted-foreground", className)}
              >
                <Braces />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {trigger}
      <DropdownMenuContent
        align="end"
        className="w-72"
        onCloseAutoFocus={(event) => {
          if (onClosed?.()) {
            event.preventDefault()
          }
        }}
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {t(`${K}.title`)}
          <span className="text-xs font-normal text-muted-foreground">{t(`${K}.hint`)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {extra.map((token) => (
          <DropdownMenuItem
            key={token.name}
            className="flex flex-col items-start gap-0.5"
            onSelect={() => {
              onPick(token.name)
            }}
          >
            {token.label}
            <span className="max-w-full text-xs text-muted-foreground">{token.hint}</span>
          </DropdownMenuItem>
        ))}
        {extra.length > 0 ? <DropdownMenuSeparator /> : null}
        {SHOP_TOKENS.map((name) => {
          const value = values?.[name]
          return (
            <DropdownMenuItem
              key={name}
              className="flex flex-col items-start gap-0.5"
              onSelect={() => {
                onPick(name)
              }}
            >
              {t(`${K}.names.${SHOP_TOKEN_KEYS[name]}`)}
              <span className="max-w-full truncate text-xs text-muted-foreground">
                {values === undefined ? "…" : (value ?? t(`${K}.notGiven`))}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type TextField = HTMLInputElement | HTMLTextAreaElement

/**
 * A text field that takes the shop's details: the menu sits inside its
 * right edge (the field leaves room with `pr-9`) and puts `{name}` where
 * the caret was, or at the end of a field not yet typed in.
 */
export function TokenSlot({
  fieldId,
  onInsert,
  multiline = false,
  extra,
  children,
}: {
  /** The input's or text area's id. */
  fieldId: string
  /** The field's new text, for the form to take (`setValue`). */
  onInsert: (text: string) => void
  multiline?: boolean
  /** Tokens besides the shop's details (ShopTokenMenu). */
  extra?: readonly ExtraToken[]
  children: ReactNode
}) {
  // Where the caret was when the field lost focus (to the menu's button)
  const selection = useRef<{ start: number; end: number } | null>(null)
  const caret = useRef<number | null>(null)
  const field = () => document.getElementById(fieldId) as TextField | null
  return (
    <div
      className="relative"
      onBlurCapture={(event) => {
        const target = event.target as TextField
        if (target.id === fieldId) {
          const end = target.value.length
          selection.current = {
            start: target.selectionStart ?? end,
            end: target.selectionEnd ?? end,
          }
        }
      }}
    >
      {children}
      <ShopTokenMenu
        className={cn("absolute right-1", multiline ? "top-1" : "top-1/2 -translate-y-1/2")}
        extra={extra}
        onPick={(name) => {
          const text = field()?.value ?? ""
          const at = selection.current ?? { start: text.length, end: text.length }
          const next = insertToken(text, name, at.start, at.end)
          caret.current = next.caret
          selection.current = { start: next.caret, end: next.caret }
          onInsert(next.text)
        }}
        onClosed={() => {
          const element = field()
          const at = caret.current
          caret.current = null
          if (!element || at === null) {
            return false
          }
          element.focus()
          element.setSelectionRange(at, at)
          return true
        }}
      />
    </div>
  )
}

/** "Vitrinde: …": the text with the details filled in, once it uses one. */
export function ShopTokenPreview({ text, className }: { text: string; className?: string }) {
  const { t } = useTranslation()
  const shown = hasShopToken(text)
  const values = useShopTokenValues(shown)
  if (!shown || !values) {
    return null
  }
  return (
    <p className={cn("text-xs break-words text-muted-foreground", className)}>
      <span className="font-medium">{t(`${K}.preview`)}</span> {fillShopText(text, values)}
    </p>
  )
}
