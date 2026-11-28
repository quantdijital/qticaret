import type { TFunction } from "i18next"

/** A step after the move, numbered in its order ("1. Eski adresler…"); unnumbered, its title alone. */
export const stepTitle = (t: TFunction, title: string, step: number | undefined) =>
  step === undefined ? title : t("settings.migration.stepTitle", { step, title })
