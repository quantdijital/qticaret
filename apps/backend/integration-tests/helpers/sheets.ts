import type { Readable } from "node:stream"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { SHEET_COLUMNS, headerOf } from "../../src/lib/catalog-sheet"
import { readSheet, writeXlsx } from "../../src/lib/sheets"
import type { SheetCell } from "../../src/lib/sheets"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import type { HttpClient } from "./http"
import { settle } from "./http"

export interface SheetJob {
  id: string
  status: string
  error_code: string | null
  result_summary: Record<string, unknown> | null
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
export const HEADER = SHEET_COLUMNS.map((column) =>
  headerOf(column, { weight: "g", dimension: "cm" })
)
export const at = (key: string): number => SHEET_COLUMNS.findIndex((column) => column.key === key)
export const DIMENSIONS = { weight: 500, length: 20, width: 10, height: 5 }

/** A sheet row with these columns filled. */
export function row(values: Record<string, SheetCell>): SheetCell[] {
  const cells: SheetCell[] = HEADER.map(() => null)
  for (const [key, value] of Object.entries(values)) {
    cells[at(key)] = value
  }
  return cells
}

export async function bytesOf(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

export const xlsxOf = (rows: SheetCell[][]): Promise<Buffer> =>
  bytesOf(writeXlsx([{ name: "Ürünler", rows: [HEADER, ...rows] }]))

/** Uploading sheets and reading what their jobs did, as the panel does. */
export function sheetClient(
  http: HttpClient,
  container: () => MedusaContainer,
  headers: () => Record<string, string>
) {
  async function settled(id: string): Promise<SheetJob> {
    for (let attempt = 0; attempt < 1200; attempt++) {
      const { data } = await http.get<{ async_job: SheetJob }>(`/admin/async-jobs/${id}`, {
        headers: headers(),
      })
      if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
        return data.async_job
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error("job did not finish")
  }
  async function upload(buffer: Buffer, mode: "check" | "apply", type = XLSX_TYPE) {
    const queued = await settle(
      http.post<{ async_job: SheetJob; message?: string }>(
        `/admin/catalog/imports?mode=${mode}`,
        buffer,
        {
          headers: { ...headers(), "content-type": type },
        }
      )
    )
    expect(queued.status).toBe(202)
    return settled(queued.data.async_job.id)
  }
  /** The job's file as its rows (an import's report, an export's sheet), cells as an import reads them. */
  async function fileOf(job: SheetJob): Promise<string[][]> {
    const [record] = await container()
      .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
      .listAsyncJobs({ id: job.id }, { select: ["result_file_id"] })
    const bytes = await container()
      .resolve(Modules.FILE)
      .getAsBuffer(record?.result_file_id ?? "")
    const read = await readSheet(bytes, { maxRows: 10_000, maxCells: 200 })
    return read.ok ? read.rows.map((each) => each.cells) : []
  }
  async function fileBytes(job: SheetJob): Promise<Buffer> {
    const [record] = await container()
      .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
      .listAsyncJobs({ id: job.id }, { select: ["result_file_id"] })
    return container()
      .resolve(Modules.FILE)
      .getAsBuffer(record?.result_file_id ?? "")
  }
  return { settled, upload, fileOf, fileBytes }
}
