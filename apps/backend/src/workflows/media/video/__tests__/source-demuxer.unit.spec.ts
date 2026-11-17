import { VideoJobError } from "../../../../lib/media/video/transcode-errors"
import { sourceDemuxer } from "../process"

describe("sourceDemuxer (adr/0069 §4)", () => {
  it("reads MP4 and MOV as mov, WebM as matroska", () => {
    expect(sourceDemuxer("mp4")).toBe("mov")
    expect(sourceDemuxer("mov")).toBe("mov")
    expect(sourceDemuxer("webm")).toBe("matroska")
  })

  it("refuses a GIF or any other stored format as the input's fault (Kararlar 11)", () => {
    for (const format of ["gif", "avi", "toString", ""]) {
      let thrown: unknown
      try {
        sourceDemuxer(format)
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(VideoJobError)
      expect(thrown).toMatchObject({ kind: "input", code: "video.unsupported_type" })
    }
  })
})
