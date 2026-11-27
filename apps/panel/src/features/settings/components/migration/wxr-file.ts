import { MAX_WXR_BYTES, isWxrName } from "@/features/settings/api/migration-wordpress"

const W = "settings.migration.wordpress"

/** What is wrong with the chosen file, as an i18n key; nothing when it may be sent. */
export function fileProblem(file: File | null): string | null {
  if (!file) {
    return `${W}.errors.fileRequired`
  }
  if (!isWxrName(file.name)) {
    return `${W}.errors.fileType`
  }
  return file.size > MAX_WXR_BYTES ? `${W}.errors.fileTooLarge` : null
}
