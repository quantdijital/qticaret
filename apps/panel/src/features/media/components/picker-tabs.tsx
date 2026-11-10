import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import type { Ref } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody, DialogFooter } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { importToLibrary, mediaListQuery, useMediaChanged } from "@/features/media/api/media"
import type { MediaAsset } from "@/features/media/api/media"
import { MediaGrid } from "@/features/media/components/media-grid"
import { UploadZone } from "@/features/media/components/upload-zone"
import type { UploadZoneHandle } from "@/features/media/components/upload-zone"
import { errorText } from "@/lib/errors"

const P = "media.picker"
const PAGE_SIZE = 12

interface TabProps {
  multiple: boolean
  /** How many may still be chosen (a product's room left). */
  max: number
  onChoose: (assets: MediaAsset[]) => void
}

/** The library to choose from: search, pages, one or several marked, then "Seç". */
export function LibraryTab({ multiple, max, onChoose }: TabProps) {
  const { t } = useTranslation()
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [chosen, setChosen] = useState<Map<string, MediaAsset>>(new Map())
  const list = useQuery(mediaListQuery({ q, page, limit: PAGE_SIZE }))
  const toggle = (asset: MediaAsset) => {
    setChosen((current) => {
      if (!multiple) {
        return new Map([[asset.id, asset]])
      }
      const next = new Map(current)
      if (next.has(asset.id)) {
        next.delete(asset.id)
      } else if (next.size < max) {
        next.set(asset.id, asset)
      }
      return next
    })
  }
  return (
    <>
      {/* The search stays above the grid, which scrolls under it */}
      <SearchInput
        value={q}
        placeholder={t("media.search")}
        className="shrink-0 sm:max-w-none"
        onChange={(text) => {
          setQ(text)
          setPage(0)
        }}
      />
      <DialogBody list>
        {list.isError ? (
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        ) : (
          <MediaGrid
            dense
            items={list.data?.media}
            loading={list.isPending}
            stale={list.isPlaceholderData}
            selected={new Set(chosen.keys())}
            onItemClick={toggle}
            empty={
              <p className="text-sm text-muted-foreground">
                {t(q ? "media.noMatch" : `${P}.empty`)}
              </p>
            }
          />
        )}
        {list.data && list.data.count > PAGE_SIZE ? (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={list.data.count}
            onPageChange={setPage}
          />
        ) : null}
      </DialogBody>
      <DialogFooter className="sm:items-center">
        <span className="text-[13px] text-muted-foreground sm:mr-auto">
          {t(`${P}.chosen`, { count: chosen.size })}
        </span>
        <Button
          type="button"
          disabled={chosen.size === 0}
          onClick={() => {
            onChoose([...chosen.values()])
          }}
        >
          {t(`${P}.choose`)}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * Files from this computer: up into the library, then chosen. A drop where
 * some failed stays open on their reasons, with the rest one click away.
 * Files dropped anywhere on the dialog come here (`zone`).
 */
export function UploadTab({
  multiple,
  max,
  onChoose,
  zone,
}: TabProps & { zone?: Ref<UploadZoneHandle> }) {
  const { t } = useTranslation()
  const [uploaded, setUploaded] = useState<MediaAsset[]>([])
  return (
    <>
      <DialogBody list>
        <UploadZone
          ref={zone}
          fill
          multiple={multiple}
          onUploaded={(assets, failed) => {
            const usable = assets.slice(0, multiple ? max : 1)
            if (failed === 0) {
              onChoose(usable)
            } else {
              setUploaded(usable)
            }
          }}
        />
      </DialogBody>
      {uploaded.length > 0 ? (
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              onChoose(uploaded)
            }}
          >
            {t(`${P}.chooseUploaded`, { count: uploaded.length })}
          </Button>
        </DialogFooter>
      ) : null}
    </>
  )
}

/** An outside address: the server fetches the image into the library, then it is chosen. */
export function AddressTab({ onChoose }: Pick<TabProps, "onChoose">) {
  const { t } = useTranslation()
  const changed = useMediaChanged()
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const bring = useMutation({
    mutationFn: importToLibrary,
    onSuccess: async (asset) => {
      await changed()
      onChoose([asset])
    },
    onError: (failure) => {
      setError(errorText(t, failure))
    },
  })
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        bring.mutate(url.trim())
      }}
    >
      <DialogBody list>
        <Field
          label={t(`${P}.address`)}
          htmlFor="media-picker-address"
          hint={t(`${P}.addressHint`)}
          error={error ?? undefined}
        >
          <Input
            id="media-picker-address"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={url}
            maxLength={2048}
            onChange={(event) => {
              setUrl(event.target.value)
              setError(null)
            }}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="submit" disabled={url.trim() === "" || bring.isPending}>
          {bring.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(`${P}.import`)}
        </Button>
      </DialogFooter>
    </form>
  )
}
