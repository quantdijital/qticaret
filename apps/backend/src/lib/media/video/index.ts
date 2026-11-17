/** Product videos (adr/0069): limits, what a file is, ffprobe's check, the tools on this machine. */
export * from "./limits"
export { videoSignature } from "./signature"
export type { VideoDemuxer, VideoSignature, VideoSourceFormat } from "./signature"
export { assessProbe, decimalOf, probeOutputSchema, rateOf } from "./probe-verdict"
export type { ProbeOutput, ProbeVerdict } from "./probe-verdict"
export { inputBounds, probeArgs } from "./probe-args"
export { probeVideo } from "./probe"
export { videoToolPaths } from "./paths"
export type { VideoToolPaths } from "./paths"
export { probeSelfTest } from "./self-test"
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
  videoTools,
  videoUploadAvailable,
} from "./tools"
export type { VideoToolCheck } from "./tools"
export { canMoveVideo, openingStatus } from "./status"
export type { VideoStatus } from "./status"
export { CLOSE_WAIT_MS, RECEIVE_TIMEOUTS, fileClosed, receiveVideo } from "./receive"
export type { ReceiveTimeouts, ReceivedVideo } from "./receive"
export {
  COMMON_OUTPUT_ARGS,
  FFMPEG_CPU_LIMIT_S,
  MP4_ENCODER_ARGS,
  OUTPUT_DEMUXER,
  WEBM_ENCODER_ARGS,
  encodeArgs,
  filePath,
  outputProbeArgs,
  posterArgs,
  scaleFilter,
  scaledSize,
} from "./transcode-args"
export type { OutputKind } from "./transcode-args"
export {
  PROCESSING_FAILED,
  VideoJobError,
  afterFailure,
  classifyFailure,
  infraError,
  inputError,
} from "./transcode-errors"
export type { AfterFailure, Failure, FailureKind } from "./transcode-errors"
export { STRUCTURAL_TAGS, assessOutput, strayTags } from "./output-verdict"
export type { OutputVerdict } from "./output-verdict"
export {
  encodeActivity,
  frameBrightness,
  freeDiskBytes,
  niced,
  resetEncodeActivity,
  systemNice,
  transcodeClip,
} from "./transcode"
export { ProbeStoppedError } from "./probe"
export type { MadeOutput, TranscodeOptions, TranscodedClip } from "./transcode"
export { makePoster, videoFileBase } from "./poster"
export type { PosterImages } from "./poster"
export {
  makeVideoTempDir,
  readHead,
  removeVideoTempDir,
  sweepStaleVideoTempDirs,
} from "./temp-files"
