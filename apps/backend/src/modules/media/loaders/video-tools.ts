import { videoTools } from "../../../lib/media/video/tools"

/**
 * At start (adr/0069 §4): ffmpeg and ffprobe are looked for once, without
 * holding the start up; the answer is kept, and their absence is logged
 * once (`media.video_unavailable`). Uploads read the kept answer.
 */
export default function videoToolsLoader(): Promise<void> {
  void videoTools()
  return Promise.resolve()
}
