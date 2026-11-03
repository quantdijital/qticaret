import type { AddonFormView, CartLineView, Translate } from "@qticaret/ui"
import { AddonFields } from "../components/AddonFields"
import { addonWords } from "../components/addon-words"

const BUTTON = "h-10 self-start rounded-button border border-foreground px-4 font-semibold"

/**
 * A cart line's add-on picks, changed in place (adr/0052): the product's
 * fields filled with the line's picks, inside `<details>` (open by itself
 * while a required pick is missing: the payment waits for it), and a
 * button that takes every pick off. Plain forms: no script needed; a
 * refusal comes back to the cart in words, the price is the server's.
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
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-3 text-sm">
      {form.missingRequired && (
        <p className="font-medium text-sale">{t("addons.missing_required")}</p>
      )}
      <details open={form.missingRequired}>
        <summary className="cursor-pointer font-medium underline-offset-4 hover:underline">
          {line.addons.length > 0 ? t("addons.edit") : t("addons.add")}
        </summary>
        <form action={save} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="line_id" value={line.id} />
          <input type="hidden" name="product_id" value={form.productId} />
          <AddonFields
            id={`ek-${line.id}`}
            fields={form.fields}
            values={form.values}
            words={addonWords(t)}
          />
          <button type="submit" className={BUTTON}>
            {t("addons.save")}
          </button>
        </form>
      </details>
      {form.removable && (
        <form action={save}>
          <input type="hidden" name="line_id" value={line.id} />
          <input type="hidden" name="product_id" value={form.productId} />
          <input type="hidden" name="clear" value="1" />
          <button
            type="submit"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("addons.remove")}
          </button>
        </form>
      )}
    </div>
  )
}
