import { Module } from "@medusajs/framework/utils"
import ProductQaModuleService from "./service"

/** Product questions and answers (F10.10, adr/0037 §4). */
export const PRODUCT_QA_MODULE = "product_qa"

export default Module(PRODUCT_QA_MODULE, { service: ProductQaModuleService })
