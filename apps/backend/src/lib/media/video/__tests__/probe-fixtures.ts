/**
 * ffprobe answers in the shape `probeArgs` asks for (`-show_entries` of
 * streams, their `attached_pic` disposition and the format; `-of json`).
 * No tags are asked, so none are here: no place, device or person.
 */

const MOV_FORMAT = "mov,mp4,m4a,3gp,3g2,mj2"

/** A phone's portrait clip: HEVC video, AAC audio and two data streams. */
export const PHONE_HEVC_MOV = {
  programs: [],
  stream_groups: [],
  streams: [
    {
      index: 0,
      codec_name: "hevc",
      codec_type: "video",
      width: 1920,
      height: 1080,
      r_frame_rate: "30/1",
      avg_frame_rate: "30/1",
      duration: "12.033333",
      nb_frames: "361",
      disposition: { attached_pic: 0 },
    },
    {
      index: 1,
      codec_name: "aac",
      codec_type: "audio",
      r_frame_rate: "0/0",
      avg_frame_rate: "0/0",
      duration: "12.046440",
      nb_frames: "565",
      disposition: { attached_pic: 0 },
    },
    {
      index: 2,
      codec_type: "data",
      r_frame_rate: "0/0",
      avg_frame_rate: "0/0",
      duration: "12.033333",
      nb_frames: "1",
      disposition: { attached_pic: 0 },
    },
    {
      index: 3,
      codec_type: "data",
      r_frame_rate: "0/0",
      avg_frame_rate: "0/0",
      duration: "12.033333",
      nb_frames: "361",
      disposition: { attached_pic: 0 },
    },
  ],
  format: { format_name: MOV_FORMAT, duration: "12.046440", nb_streams: 4 },
}

/** A browser-made WebM: VP9 with a header duration, no frame count. */
export const VP9_WEBM = {
  streams: [
    {
      index: 0,
      codec_name: "vp9",
      codec_type: "video",
      width: 1280,
      height: 720,
      r_frame_rate: "30000/1001",
      avg_frame_rate: "30000/1001",
      disposition: { attached_pic: 0 },
    },
  ],
  format: { format_name: "matroska,webm", duration: "8.008000", nb_streams: 1 },
}

/** An MP4 whose cover art is a picture stream beside the video. */
export const MP4_WITH_COVER = {
  streams: [
    {
      index: 0,
      codec_name: "h264",
      codec_type: "video",
      width: 1280,
      height: 720,
      avg_frame_rate: "25/1",
      r_frame_rate: "25/1",
      duration: "10.000000",
      nb_frames: "250",
      disposition: { attached_pic: 0 },
    },
    {
      index: 1,
      codec_name: "mjpeg",
      codec_type: "video",
      width: 600,
      height: 600,
      avg_frame_rate: "0/0",
      r_frame_rate: "90000/1",
      disposition: { attached_pic: 1 },
    },
  ],
  format: { format_name: MOV_FORMAT, duration: "10.000000", nb_streams: 2 },
}

type Fixture = typeof PHONE_HEVC_MOV

/** The phone clip with its first stream changed. */
export const phoneWith = (video: Record<string, unknown>, format: Record<string, unknown> = {}) => {
  const [first, ...rest] = PHONE_HEVC_MOV.streams
  return {
    ...PHONE_HEVC_MOV,
    streams: [{ ...first, ...video }, ...rest],
    format: { ...PHONE_HEVC_MOV.format, ...format },
  } as unknown as Fixture
}
