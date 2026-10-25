import { Module } from "@medusajs/framework/utils"
import AsyncJobModuleService from "./service"

/** Long-running task records: status, progress, result file (F2.8, adr/0014). */
export const ASYNC_JOB_MODULE = "asyncJob"

export default Module(ASYNC_JOB_MODULE, {
  service: AsyncJobModuleService,
})
