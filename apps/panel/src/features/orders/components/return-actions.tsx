import { useQueryClient } from "@tanstack/react-query"
import { EllipsisVertical } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  returnLinesQuery,
  useApproveReturn,
  useRetryRefund,
  useReturnLabel,
} from "@/features/orders/api/returns"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { allRefused } from "@/features/orders/return-facts"
import { giftLineIds, isGiftRequest } from "@/features/orders/return-rules"
import { errorText } from "@/lib/errors"

const R = "orders.returns"

/** The dialog a request's action opens; `gift`: a gift card withdrawal's approval. */
export type Open = {
  kind: "reject" | "receive" | "exchange" | "gift"
  request: ReturnRequest
} | null

/** A request's actions by where it stands (adr/0032): decide, receive, refund again, label. */
export function ReturnActions({
  request,
  onOpen,
}: {
  request: ReturnRequest
  onOpen: (open: Open) => void
}) {
  const { t } = useTranslation()
  const approve = useApproveReturn()
  const retry = useRetryRefund()
  const label = useReturnLabel()
  const client = useQueryClient()
  const [checking, setChecking] = useState(false)
  const failed = (failure: unknown) => toast.error(errorText(t, failure))
  // A gift card withdrawal voids the cards and refunds at once: asked first (adr/0025 Ek 2026-11-03)
  const giftRequest = async (): Promise<boolean | null> => {
    if (isGiftRequest(request)) {
      return true
    }
    setChecking(true)
    try {
      // Whether a line is a gift card never changes: a cached read will do
      const lines = await client.query({
        ...returnLinesQuery(request.order_id),
        staleTime: "static",
      })
      return isGiftRequest(request, giftLineIds(lines))
    } catch (failure) {
      failed(failure)
      return null
    } finally {
      setChecking(false)
    }
  }
  const items: { key: string; label: string; run: () => void }[] = []
  if (request.status === "requested") {
    items.push(
      {
        key: "approve",
        label: t(`${R}.approve`),
        run: () => {
          // A swap shows what it costs first
          if (request.kind === "exchange") {
            onOpen({ kind: "exchange", request })
            return
          }
          void giftRequest().then((gift) => {
            if (gift) {
              onOpen({ kind: "gift", request })
            } else if (gift === false) {
              approve.mutate(
                { id: request.id },
                { onSuccess: () => toast.success(t(`${R}.approved`)), onError: failed }
              )
            }
          })
        },
      },
      {
        key: "reject",
        label: t(`${R}.reject`),
        run: () => {
          onOpen({ kind: "reject", request })
        },
      }
    )
  }
  if (request.status === "approved") {
    items.push({
      key: "receive",
      label: t(`${R}.receive`),
      run: () => {
        onOpen({ kind: "receive", request })
      },
    })
  }
  // A swap the shop owes nothing on is done once received; so is a return whose units were all refused
  if (
    request.status === "received" &&
    !allRefused(request) &&
    (request.kind === "return" || Number(request.difference ?? 0) < 0)
  ) {
    items.push({
      key: "refund",
      label: t(`${R}.retryRefund`),
      run: () => {
        retry.mutate(request.id, {
          onSuccess: () => toast.success(t(`${R}.refunded`)),
          onError: failed,
        })
      },
    })
  }
  if (request.return_label_file_id) {
    items.push({
      key: "label",
      label: t(`${R}.label`),
      run: () => {
        const tab = window.open("", "_blank")
        label.mutate(request.id, {
          onSuccess: (url) => {
            if (tab) {
              tab.opener = null
              tab.location.href = url
            } else {
              window.location.assign(url)
            }
          },
          onError: (failure) => {
            tab?.close()
            failed(failure)
          },
        })
      },
    })
  }
  if (items.length === 0) {
    return null
  }
  return (
    <span className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={t(`${R}.actions`)}
            disabled={approve.isPending || retry.isPending || checking}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map((item) => (
            <DropdownMenuItem key={item.key} onSelect={item.run}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}
