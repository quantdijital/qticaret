import { Module } from "@medusajs/framework/utils"
import videoToolsLoader from "./loaders/video-tools"
import MediaModuleService from "./service"

/** Product images: masters, alt text and the versions they are served in (F3.3); videos (adr/0069). */
export const MEDIA_MODULE = "media"

export default Module(MEDIA_MODULE, {
  service: MediaModuleService,
  loaders: [videoToolsLoader],
})
