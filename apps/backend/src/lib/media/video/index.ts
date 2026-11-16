/** Product videos (adr/0069): limits, what a file is, ffprobe's check, the tools on this machine. */
export * from "./limits"
export { videoSignature } from "./signature"
export type { VideoDemuxer, VideoSignature, VideoSourceFormat } from "./signature"
export { assessProbe, decimalOf, probeOutputSchema, rateOf } from "./probe-verdict"
export type { ProbeOutput, ProbeVerdict } from "./probe-verdict"
export { probeArgs, probeVideo } from "./probe"
export type { ProbeOptions } from "./probe"
export { ToolStartError, runTool } from "./run-tool"
export type { Spawner, ToolOptions, ToolRun } from "./run-tool"
export { createSlots } from "./slots"
export type { SlotOptions, Slots } from "./slots"
export {
  REQUIRED_ENCODERS,
  checkVideoTools,
  majorOf,
  resetVideoToolsCheck,
  versionOf,
  videoToolPaths,
  videoTools,
  videoUploadAvailable,
} from "./tools"
export type { VideoToolCheck, VideoToolPaths } from "./tools"
export { canMoveVideo, openingStatus } from "./status"
export type { VideoStatus } from "./status"
export { makeVideoTempDir, readHead, receiveVideo, removeVideoTempDir } from "./receive"
export type { ReceivedVideo } from "./receive"
