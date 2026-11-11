import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { AsyncJob } from "@/features/settings/api/activity"

/** Product sheets (F3.9, adr/0018): what an import or export job tells the panel. */

export type SheetMode = "check" | "apply"

export interface ImportSummary {
  mode: SheetMode
  rows: number
  create: number
  update: number
  /** Products that exist and that the sheet leaves as they are. */
  unchanged: number
  problems: number
  failed: number
  /** New products past the package's product limit, left out (adr/0061 Ek C14); older jobs lack it. */
  limited?: number
  unknown_columns: string[]
  seo: {
    grades: Partial<Record<"excellent" | "good" | "needs_work" | "poor", number>>
    top: { rule: string; count: number; params: Record<string, string | number> }[]
  } | null
}

export type SheetJob = AsyncJob & { error_message: string | null }

const TYPES: Readonly<Record<string, string>> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
}

/**
 * Sends the file as it is (the server tells xlsx from CSV by its bytes) and
 * returns the job that checks or applies it. Not through the SDK: it would
 * send the body as JSON.
 */
export async function uploadSheet(file: File, mode: SheetMode): Promise<SheetJob> {
  const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
  const response = await fetch(`/admin/catalog/imports?mode=${mode}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": TYPES[extension] ?? "application/octet-stream" },
    body: file,
  })
  const data = (await response.json().catch(() => ({}))) as {
    async_job?: SheetJob
    message?: string
  }
  if (!response.ok || !data.async_job) {
    // The shape `errorText` reads from the SDK's errors
    throw Object.assign(new Error(data.message ?? "upload failed"), {
      status: response.status,
      message: data.message,
    })
  }
  return data.async_job
}

const isRunning = (job: SheetJob | undefined) =>
  job?.status === "queued" || job?.status === "running"

/** A job, looked at again every second while it runs. */
export const sheetJobQuery = (id: string | null) =>
  queryOptions({
    queryKey: ["sheet-jobs", id],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ async_job: SheetJob }>(
          `/admin/async-jobs/${encodeURIComponent(id ?? "")}`
        )
      ).async_job,
    enabled: id !== null,
    refetchInterval: (query) => (isRunning(query.state.data) ? 1000 : false),
  })

const POLL_MS = 1000
// An export of 50,000 rows takes minutes; past this the jobs page still has it
const MAX_WAIT_MS = 15 * 60 * 1000

/** The job once it has finished (or still running, past the wait). */
export async function finishedJob(id: string): Promise<SheetJob> {
  const started = Date.now()
  for (;;) {
    const { async_job: job } = await sdk.client.fetch<{ async_job: SheetJob }>(
      `/admin/async-jobs/${encodeURIComponent(id)}`
    )
    if (!isRunning(job) || Date.now() - started > MAX_WAIT_MS) {
      return job
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

/** Starts an export of the catalog; its file is the job's result. */
export const startExport = async (format: "xlsx" | "csv") =>
  (
    await sdk.client.fetch<{ async_job: SheetJob }>("/admin/async-jobs", {
      method: "POST",
      body: { type: "catalog.export", input: { format } },
    })
  ).async_job

/** The empty sheet with the shop's columns, saved as a file. */
export async function downloadTemplate(): Promise<void> {
  const response = await fetch("/admin/catalog/import-template", { credentials: "same-origin" })
  if (!response.ok) {
    throw Object.assign(new Error("template failed"), { status: response.status })
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = "urun-sablonu.xlsx"
  link.click()
  URL.revokeObjectURL(url)
}
