export interface VideoToolPaths {
  ffmpeg: string
  ffprobe: string
}

/**
 * Where ffmpeg and ffprobe are (adr/0069 §4): the env's absolute paths
 * (checked at start, lib/env.ts) or the programs' names, found on PATH.
 */
export function videoToolPaths(env: NodeJS.ProcessEnv = process.env): VideoToolPaths {
  const ffmpeg = env["FFMPEG_PATH"]?.trim() ?? ""
  const ffprobe = env["FFPROBE_PATH"]?.trim() ?? ""
  return {
    ffmpeg: ffmpeg === "" ? "ffmpeg" : ffmpeg,
    ffprobe: ffprobe === "" ? "ffprobe" : ffprobe,
  }
}
