import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MediaAsset } from "@/features/media/api/media"
import { AddressTab, LibraryTab, UploadTab } from "@/features/media/components/picker-tabs"

type Source = "library" | "upload" | "address"

export interface MediaPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The chosen images, in the library's record; the dialog closes after. */
  onSelect: (assets: MediaAsset[]) => void
  /** Several at once (a product's gallery); one otherwise. */
  multiple?: boolean
  /** At most this many may be chosen. */
  max?: number
  title?: string
}

/**
 * Where every picture in the panel comes from (docs/18 §7): the shop's
 * media library, a file from this computer or an outside address. Uploads
 * and addresses land in the library first, so a page only ever shows the
 * shop's own, cleaned copy.
 */
export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  max = 20,
  title,
}: MediaPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <PickerContent
          multiple={multiple}
          max={max}
          title={title}
          onChoose={(assets) => {
            onSelect(assets)
            onOpenChange(false)
          }}
        />
      ) : null}
    </Dialog>
  )
}

// Mounted on each opening: a fresh search, choice and upload list
function PickerContent({
  multiple,
  max,
  title,
  onChoose,
}: {
  multiple: boolean
  max: number
  title: string | undefined
  onChoose: (assets: MediaAsset[]) => void
}) {
  const { t } = useTranslation()
  const [source, setSource] = useState<Source>("library")
  return (
    <DialogContent size="xl">
      <DialogHeader>
        <DialogTitle>
          {title ?? t(multiple ? "media.picker.titleMany" : "media.picker.title")}
        </DialogTitle>
        <DialogDescription>{t("media.picker.description")}</DialogDescription>
      </DialogHeader>
      <Tabs
        value={source}
        onValueChange={(value) => {
          setSource(value as Source)
        }}
        className="gap-5"
      >
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="library">{t("media.picker.library")}</TabsTrigger>
          <TabsTrigger value="upload">{t("media.picker.upload")}</TabsTrigger>
          <TabsTrigger value="address">{t("media.picker.addressTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="flex flex-col gap-6">
          <LibraryTab multiple={multiple} max={max} onChoose={onChoose} />
        </TabsContent>
        <TabsContent value="upload" className="flex flex-col gap-6">
          <UploadTab multiple={multiple} max={max} onChoose={onChoose} />
        </TabsContent>
        <TabsContent value="address" className="flex flex-col gap-6">
          <AddressTab onChoose={onChoose} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  )
}
