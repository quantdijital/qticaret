import { useRef, useState } from "react"
import type { DragEvent } from "react"
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
import type { UploadZoneHandle } from "@/features/media/components/upload-zone"
import { cn } from "@/lib/utils"

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

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files")

// The tab's part between the tabs and the box's bottom: what is in it scrolls, its footer stays
const TAB = "flex min-h-0 flex-1 flex-col gap-6 data-[state=inactive]:hidden"

/**
 * Mounted on each opening: a fresh search, choice and upload list. One
 * height whatever the tab (the size scale's `xl` at `--dialog-max-height`),
 * the title, the tabs, the search and the footer fixed, only the grid
 * scrolling; files dropped anywhere on it go up (the owner, 2026-11-05).
 */
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
  const [over, setOver] = useState(false)
  const zone = useRef<UploadZoneHandle>(null)
  return (
    <DialogContent
      size="xl"
      pane="fixed"
      className={cn(over && "ring-2 ring-primary")}
      onDragOver={(event) => {
        if (hasFiles(event)) {
          event.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={(event) => {
        // Only on leaving the box, not on moving between its parts
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOver(false)
        }
      }}
      onDrop={(event) => {
        setOver(false)
        // The upload tab's own zone took it already
        if (!hasFiles(event) || event.defaultPrevented) {
          return
        }
        event.preventDefault()
        setSource("upload")
        zone.current?.upload(Array.from(event.dataTransfer.files))
      }}
    >
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
        className="min-h-0 flex-1 gap-5"
      >
        <TabsList className="w-full shrink-0 sm:w-fit">
          <TabsTrigger value="library">{t("media.picker.library")}</TabsTrigger>
          <TabsTrigger value="upload">{t("media.picker.upload")}</TabsTrigger>
          <TabsTrigger value="address">{t("media.picker.addressTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className={TAB}>
          <LibraryTab multiple={multiple} max={max} onChoose={onChoose} />
        </TabsContent>
        {/* Kept mounted: a drop on another tab is handed to its zone */}
        <TabsContent value="upload" forceMount className={TAB}>
          <UploadTab multiple={multiple} max={max} onChoose={onChoose} zone={zone} />
        </TabsContent>
        <TabsContent value="address" className={TAB}>
          <AddressTab onChoose={onChoose} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  )
}
