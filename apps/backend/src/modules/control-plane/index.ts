import { Module } from "@medusajs/framework/utils"
import ControlPlaneModuleService from "./service"

/** The control plane's plan document as this shop last received it (adr/0061 §5.1, Ek C9). */
export const CONTROL_PLANE_MODULE = "control_plane"

export default Module(CONTROL_PLANE_MODULE, { service: ControlPlaneModuleService })
