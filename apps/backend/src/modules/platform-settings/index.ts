import { Module } from "@medusajs/framework/utils"
import PlatformSettingsModuleService from "./service"

/** Store and SEO settings and feature flags (F2.3, adr/0012). */
export const PLATFORM_SETTINGS_MODULE = "platformSettings"

export default Module(PLATFORM_SETTINGS_MODULE, {
  service: PlatformSettingsModuleService,
})
