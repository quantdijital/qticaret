import type { TFunction } from "i18next"
import { toast } from "sonner"

/**
 * Says that the server left out the layouts of content pages deleted
 * since (adr/0073 §1): the save went through without them ("engel değil
 * uyarı"); none: nothing is said.
 */
export function sayDroppedPages(t: TFunction, count: number) {
  if (count > 0) {
    toast.info(t("storefront.editor.contentPage.dropped", { count }))
  }
}
