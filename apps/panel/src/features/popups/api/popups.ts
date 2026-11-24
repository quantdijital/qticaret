import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { responseFailure } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import type { Popup, PopupDetail, PopupInput, PopupList, PopupType } from "./types"

export const POPUPS_PAGE_SIZE = 50

const KEY = "popups"
const BASE = "/admin/popups"
const path = (id: string, action?: string) =>
  `${BASE}/${encodeURIComponent(id)}${action ? `/${action}` : ""}`

/** The list, newest first; the name and the type filtered by the server. */
export const popupsQuery = ({
  q,
  type,
  page,
}: {
  q: string | null
  type: PopupType | null
  page: number
}) =>
  queryOptions({
    queryKey: [KEY, "list", { q, type, page }],
    queryFn: () =>
      sdk.client.fetch<PopupList>(BASE, {
        query: {
          ...(q ? { q } : {}),
          ...(type ? { type } : {}),
          offset: page * POPUPS_PAGE_SIZE,
          limit: POPUPS_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const popupQuery = (id: string) =>
  queryOptions({
    queryKey: [KEY, "detail", id],
    queryFn: async () => (await sdk.client.fetch<{ popup: PopupDetail }>(path(id))).popup,
  })

/**
 * A save, not through the SDK: its error keeps only the sentence, and the
 * form needs the backend's key beside it (`code`, adr/0021) to put a
 * refusal under its field (`popups.promotion_unknown`, `popups.image_unknown`).
 */
export async function savePopup(url: string, input: Partial<PopupInput>): Promise<PopupDetail> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw await responseFailure(response)
  }
  const data = (await response.json()) as { popup: PopupDetail }
  return data.popup
}

/** Lists read again; the saved one put in place. */
function useChanged() {
  const client = useQueryClient()
  return (popup?: PopupDetail) => {
    if (popup) {
      client.setQueryData(popupQuery(popup.id).queryKey, popup)
    }
    void client.invalidateQueries({ queryKey: [KEY, "list"] })
  }
}

export function useCreatePopup() {
  const changed = useChanged()
  return useMutation({
    mutationFn: (input: PopupInput) => savePopup(BASE, input),
    onSuccess: changed,
  })
}

export function useUpdatePopup(id: string) {
  const changed = useChanged()
  return useMutation({
    mutationFn: (input: Partial<PopupInput>) => savePopup(path(id), input),
    onSuccess: changed,
  })
}

/** The list's switch and the page's: on or off, nothing else. */
export function useSetPopupActive() {
  const changed = useChanged()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      (
        await sdk.client.fetch<{ popup: PopupDetail }>(path(id, "status"), {
          method: "POST",
          body: { is_active },
        })
      ).popup,
    onSuccess: changed,
  })
}

export function useDeletePopup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (popup: Pick<Popup, "id">) =>
      sdk.client.fetch(path(popup.id), { method: "DELETE" }),
    onSuccess: (_, popup) => {
      client.removeQueries({ queryKey: popupQuery(popup.id).queryKey })
      void client.invalidateQueries({ queryKey: [KEY, "list"] })
    },
  })
}
