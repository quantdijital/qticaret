import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { IMAGE_ACCEPT, uploadContentImage } from "@/features/content/editor/upload"
import { errorText } from "@/lib/errors"
import { F } from "./fields"

/** Picks a file and uploads it to the media library (the only images a section may use). */
export function useImageUpload(onUploaded: (url: string) => void) {
  const { t } = useTranslation()
  const picker = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // The section as it is when the upload ends, not as it was when it began
  const latest = useRef(onUploaded)
  useEffect(() => {
    latest.current = onUploaded
  })
  const upload = async (file: File | undefined) => {
    if (!file) {
      return
    }
    setUploading(true)
    try {
      const url = await uploadContentImage(file)
      latest.current(url)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setUploading(false)
    }
  }
  return {
    uploading,
    choose: () => picker.current?.click(),
    input: (
      <input
        ref={picker}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        aria-label={t(`${F}.chooseImage`)}
        onChange={(event) => {
          void upload(event.target.files?.[0])
          event.target.value = ""
        }}
      />
    ),
  }
}
