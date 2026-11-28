import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Label } from "@qticaret/admin-ui/ui/label"
import type { StepProps } from "../field"

interface SamplesChoiceProps extends Omit<StepProps, "problems"> {
  /** The pack's name and how many sample products it has (0: nothing is offered). */
  packName: string
  products: number
}

/**
 * "Örnek ürünlerle başla" under the looks: only for a pack whose sample
 * catalogue has products, off by default. The setup loads them after the
 * look; every one is marked as a sample, so the owner removes them in one
 * go from the shop panel's "Örnek içerik" card. A load that fails leaves
 * the shop set up, with a warning on its setup.
 */
export function SamplesChoice({ draft, change, packName, products }: SamplesChoiceProps) {
  const { t } = useTranslation()
  if (products <= 0) {
    return null
  }
  return (
    <SectionCard title={t("wizard.samples.title")}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="wizard-sample-catalog"
            checked={draft.sample_catalog}
            onCheckedChange={(checked) => {
              change((current) => ({ ...current, sample_catalog: checked === true }))
            }}
          />
          <Label htmlFor="wizard-sample-catalog" className="font-normal">
            {t("wizard.samples.use")}
          </Label>
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">
          {t("wizard.samples.note", { pack: packName, count: products })}
        </p>
      </div>
    </SectionCard>
  )
}
