/**
 * A video's states and the moves between them (adr/0069 §1, §4): one
 * place the upload (slice 1), the transcoding job and its sweeper (slice
 * 2) and a retry from the panel read, so none moves a video in a way the
 * others do not expect.
 *
 * - `uploaded` → `processing`: the job took it (under the shop's lock)
 * - `processing` → `ready` | `failed`: the job finished, or gave up
 * - `processing` → `uploaded`: silent past 10 minutes, the sweeper puts it back
 * - `failed` → `uploaded`: "Yeniden dene" while the source is kept
 * - a YouTube video opens `ready` and stays so; nothing leaves `ready`
 */
export type VideoStatus = "uploaded" | "processing" | "ready" | "failed"

const MOVES: Readonly<Record<VideoStatus, readonly VideoStatus[]>> = {
  uploaded: ["processing"],
  processing: ["ready", "failed", "uploaded"],
  failed: ["uploaded"],
  ready: [],
}

/** The state a new video opens in: a clip waits for the job, a YouTube link is ready. */
export const openingStatus = (kind: "upload" | "youtube"): VideoStatus =>
  kind === "youtube" ? "ready" : "uploaded"

/** Whether a video may move from `from` to `to`. */
export const canMoveVideo = (from: VideoStatus, to: VideoStatus): boolean =>
  MOVES[from].includes(to)
