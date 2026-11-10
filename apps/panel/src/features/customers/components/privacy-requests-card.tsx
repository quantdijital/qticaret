import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { useCan } from "@/features/auth/api/staff"
import {
  PRIVACY_CHANNELS,
  privacyRequestsQuery,
  useRecordPrivacyRequest,
} from "@/features/customers/api/privacy"
import type { PrivacyRequest } from "@/features/customers/api/privacy"
import { errorText } from "@/lib/errors"
import { PrivacyRequestRow } from "./privacy-request-row"

const P = "customers.privacy"

/** Today in the browser's calendar, as a date input takes it. */
const today = () => new Date().toLocaleDateString("en-CA")

function RecordDialog({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const record = useRecordPrivacyRequest(customerId)
  const [kind, setKind] = useState<PrivacyRequest["kind"]>("export")
  const [channel, setChannel] = useState<PrivacyRequest["channel"]>("email")
  const [received, setReceived] = useState(today())
  const submit = () => {
    record.mutate(
      // Noon in Türkiye: the day as staff chose it, whatever the browser's zone
      { kind, channel, received_at: new Date(`${received}T12:00:00+03:00`).toISOString() },
      {
        onSuccess: () => {
          toast.success(t(`${P}.recorded`))
          onClose()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(`${P}.recordTitle`)}</DialogTitle>
            <DialogDescription>{t(`${P}.recordHint`)}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ToggleGroup
              type="single"
              variant="outline"
              value={kind}
              aria-label={t(`${P}.kind`)}
              onValueChange={(next) => {
                if (next) {
                  setKind(next as PrivacyRequest["kind"])
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="export" className="flex-1">
                {t(`${P}.kinds.export`)}
              </ToggleGroupItem>
              <ToggleGroupItem value="erasure" className="flex-1">
                {t(`${P}.kinds.erasure`)}
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="privacy-channel">{t(`${P}.channel`)}</Label>
                <Select
                  value={channel}
                  onValueChange={(next) => {
                    setChannel(next as PrivacyRequest["channel"])
                  }}
                >
                  <SelectTrigger id="privacy-channel" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIVACY_CHANNELS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`${P}.channels.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="privacy-received">{t(`${P}.receivedOn`)}</Label>
                <Input
                  id="privacy-received"
                  type="date"
                  max={today()}
                  value={received}
                  onChange={(event) => {
                    setReceived(event.target.value)
                  }}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!received || record.isPending}>
              {t(`${P}.record`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The customer's KVKK requests (F13.5, adr/0041 §6): a copy of their
 * data or its erasure, as they came, with the 30 days the law gives.
 * Recording and answering them is the owner's and admin's.
 */
export function PrivacyRequestsCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const canAct = useCan("privacy")
  const query = useQuery(privacyRequestsQuery(customerId))
  const [recording, setRecording] = useState(false)
  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(`${P}.hint`)}
      flush
      action={
        canAct ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRecording(true)
            }}
          >
            <Plus />
            {t(`${P}.record`)}
          </Button>
        ) : undefined
      }
    >
      {!query.data ? (
        <div className="border-t px-5 py-4">
          {query.isError ? (
            <p className="text-[13px] text-muted-foreground">{errorText(t, query.error)}</p>
          ) : (
            <Skeleton className="h-12 rounded-md" />
          )}
        </div>
      ) : query.data.length === 0 ? (
        <p className="border-t px-5 py-4 text-[13px] text-muted-foreground">{t(`${P}.empty`)}</p>
      ) : (
        <ul>
          {query.data.map((request) => (
            <PrivacyRequestRow
              key={request.id}
              customerId={customerId}
              request={request}
              canAct={canAct}
            />
          ))}
        </ul>
      )}
      {recording ? (
        <RecordDialog
          customerId={customerId}
          onClose={() => {
            setRecording(false)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
