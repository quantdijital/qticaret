import { Controller, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { POPUP_DESIGNS } from "@/features/popups/api/types"
import type { PopupDesign } from "@/features/popups/api/types"
import type { PopupValues } from "@/features/popups/form"

const PIC = "rounded-xs bg-foreground/45"
const LINE = "h-1 rounded-full bg-foreground/30"

/** Each design drawn small: where the picture stands, how the words sit. */
export function DesignShape({ design }: { design: PopupDesign }) {
  return (
    <span
      aria-hidden="true"
      data-design-shape={design}
      className="flex aspect-[4/3] w-full max-w-24 items-center justify-center rounded-sm border bg-muted p-1.5"
    >
      <span
        className={cn(
          "flex size-full overflow-hidden rounded-xs border bg-background",
          design === "split" ? "flex-row" : "flex-col"
        )}
      >
        {design === "classic" ? (
          <>
            <span className={cn(PIC, "h-2/5 rounded-b-none")} />
            <span className="flex flex-col gap-1 p-1">
              <span className={cn(LINE, "w-3/4 bg-foreground/55")} />
              <span className={cn(LINE, "w-1/2")} />
            </span>
          </>
        ) : null}
        {design === "split" ? (
          <>
            <span className={cn(PIC, "w-2/5 rounded-r-none")} />
            <span className="flex flex-1 flex-col justify-center gap-1 p-1">
              <span className={cn(LINE, "w-4/5 bg-foreground/55")} />
              <span className={cn(LINE, "w-3/5")} />
            </span>
          </>
        ) : null}
        {design === "hero" ? (
          <>
            <span className={cn(PIC, "h-3/5 rounded-b-none")} />
            <span className="flex flex-col items-center gap-1 p-1">
              <span className={cn(LINE, "h-1.5 w-3/4 bg-foreground/55")} />
            </span>
          </>
        ) : null}
        {design === "minimal" ? (
          <span className="flex flex-1 flex-col items-center justify-center gap-1 p-1">
            <span className={cn(LINE, "h-1.5 w-4/5 bg-foreground/55")} />
            <span className={cn(LINE, "w-1/2")} />
          </span>
        ) : null}
        {design === "coupon" ? (
          <span className="flex flex-1 flex-col items-center justify-center gap-1 p-1">
            <span className={cn(LINE, "w-1/2")} />
            <span className="h-3 w-4/5 rounded-xs border border-dashed border-foreground/60" />
          </span>
        ) : null}
      </span>
    </span>
  )
}

/**
 * The design (adr/0080 §6a): five cards of one size, the drawing on top,
 * the name under it; any design suits any type. The chosen one's sentence
 * says what it does under them.
 */
export function DesignPicker() {
  const { t } = useTranslation()
  const { control } = useFormContext<PopupValues>()
  return (
    <Controller
      control={control}
      name="design"
      render={({ field }) => (
        <div className="flex flex-col gap-2">
          <RadioGroup
            value={field.value}
            aria-label={t("popups.form.design")}
            onValueChange={field.onChange}
            className="grid grid-cols-2 gap-2 sm:grid-cols-5 max-sm:[&>:last-child]:col-span-2"
          >
            {POPUP_DESIGNS.map((design) => (
              <label
                key={design}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-md border p-2.5 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
              >
                <DesignShape design={design} />
                <span className="flex items-center gap-2">
                  <RadioGroupItem value={design} />
                  <span className="font-medium">{t(`popups.choices.design.${design}`)}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            {t(`popups.choices.designHint.${field.value}`)}
          </p>
        </div>
      )}
    />
  )
}
