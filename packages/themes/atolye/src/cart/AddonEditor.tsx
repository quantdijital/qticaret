import { ChevronDown, CircleAlert } from "lucide-react"
import type { AddonFormView, CartLineView, Translate } from "@qticaret/ui"
import { KeptForm } from "@qticaret/ui/components/kept-form"
import { AddonPicks } from "../product/Extras"
import { addonWords } from "../product/words"

/**
 * A cart line's add-on picks, changed in place (adr/0052): the product
 * page's fields filled with the line's picks, in a closed row inside the
 * line's well (open by itself while a required pick is missing: the
 * payment waits for it), and a quiet link that takes every pick off.
 * Plain forms: no script needed; a refusal comes back to the cart in
 * words (the picks as typed), the price is the server's.
 */
export function AddonEditor({
  line,
  form,
  save,
  t,
}: {
  line: CartLineView
  form: AddonFormView
  save: (form: FormData) => Promise<void>
  t: Translate
}) {
  return (
    <div className="flex flex-col gap-2 rounded-media bg-field p-3 text-sm sm:p-4">
      {form.missingRequired && (
        <p className="flex items-start gap-1.5 font-semibold text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          {t("addons.missing_required")}
        </p>
      )}
      <details open={form.missingRequired} className="group">
        <summary className="gf-link cursor-pointer">
          {line.addons.length > 0 ? t("addons.edit") : t("addons.add")}
          <ChevronDown
            className="size-4 transition-transform duration-(--dur-micro) group-open:rotate-180"
            aria-hidden="true"
            strokeWidth={2}
          />
        </summary>
        <KeptForm action={save} className="mt-2 flex flex-col gap-3">
          <input type="hidden" name="line_id" value={line.id} />
          <input type="hidden" name="product_id" value={form.productId} />
          <AddonPicks
            prefix={`ek-${line.id}`}
            fields={form.fields}
            values={form.values}
            words={addonWords(t)}
          />
          <button type="submit" className="gf-btn gf-btn--quiet gf-btn--small self-start">
            {t("addons.save")}
          </button>
        </KeptForm>
      </details>
      {form.removable && (
        <form action={save}>
          <input type="hidden" name="line_id" value={line.id} />
          <input type="hidden" name="product_id" value={form.productId} />
          <input type="hidden" name="clear" value="1" />
          <button type="submit" className="gf-link text-text-2 hover:text-text">
            {t("addons.remove")}
          </button>
        </form>
      )}
    </div>
  )
}
