import { checkVideoTools, createSlots, majorOf, versionOf, videoToolPaths } from ".."
import { fakeSpawn } from "./fake-spawn"

const VERSION = (name: string, version: string) =>
  `${name} version ${version} Copyright (c) 2000-2025 the FFmpeg developers\nbuilt with gcc\n`
const ENCODERS = [
  "Encoders:",
  " V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC (codec h264)",
  " V....D libvpx-vp9           libvpx VP9 (codec vp9)",
  " A....D aac                  AAC (Advanced Audio Coding)",
].join("\n")

// What ffprobe says of the self-test's clip (64 × 48, one second, MPEG-4 Part 2)
const SELF_TEST_ANSWER = JSON.stringify({
  streams: [
    {
      index: 0,
      codec_name: "mpeg4",
      codec_type: "video",
      width: 64,
      height: 48,
      avg_frame_rate: "5/1",
      r_frame_rate: "5/1",
      duration: "1.000000",
      nb_frames: "5",
      disposition: { attached_pic: 0 },
    },
  ],
  format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "1.000000", nb_streams: 1 },
})

/** Healthy programs: versions, encoders, the self-test's clip made and read. */
const healthy = (command: string, args: readonly string[]) => ({
  stdout: args.includes("-encoders")
    ? ENCODERS
    : args.includes("-show_entries")
      ? SELF_TEST_ANSWER
      : args.includes("lavfi")
        ? ""
        : VERSION(command, "7.1.1"),
})

describe("ffmpeg and ffprobe on this machine (adr/0069 §4)", () => {
  it("finds them at the env's paths, else on PATH", () => {
    expect(videoToolPaths({})).toEqual({ ffmpeg: "ffmpeg", ffprobe: "ffprobe" })
    expect(
      videoToolPaths({ FFMPEG_PATH: "/usr/bin/ffmpeg", FFPROBE_PATH: " /usr/bin/ffprobe " })
    ).toEqual({ ffmpeg: "/usr/bin/ffmpeg", ffprobe: "/usr/bin/ffprobe" })
    expect(videoToolPaths({ FFMPEG_PATH: "  " }).ffmpeg).toBe("ffmpeg")
  })

  it("is available when both answer and ffmpeg has both encoders", async () => {
    const { spawn, calls } = fakeSpawn(healthy)
    await expect(checkVideoTools({ env: {}, spawn })).resolves.toEqual({
      available: true,
      missing: [],
      version: "7.1.1",
    })
    expect(calls.map((call) => [call.command, ...call.args])).toEqual(
      expect.arrayContaining([
        ["ffprobe", "-version"],
        ["ffmpeg", "-version"],
        ["ffmpeg", "-hide_banner", "-encoders"],
      ])
    )
    // The self-test: ffmpeg makes a clip, ffprobe reads it with an upload's very bounds
    const probe = calls.find((call) => call.command === "ffprobe" && call.args.includes("-i"))
    expect(probe?.args).toEqual(
      expect.arrayContaining(["-codec_whitelist", "-max_streams", "-max_pixels", "-max_alloc"])
    )
    expect(calls.some((call) => call.command === "ffmpeg" && call.args.includes("lavfi"))).toBe(
      true
    )
  })

  it("stays closed when ffprobe cannot run with the upload's bounds (an old build)", async () => {
    const old = fakeSpawn((command, args) =>
      args.includes("-show_entries") ? { stdout: "", code: 1 } : healthy(command, args)
    )
    await expect(checkVideoTools({ env: {}, spawn: old.spawn })).resolves.toMatchObject({
      available: false,
      missing: ["probe_options"],
    })
    // A self-test clip read as something else is no pass either
    const odd = fakeSpawn((command, args) =>
      args.includes("-show_entries") ? { stdout: "{}" } : healthy(command, args)
    )
    await expect(checkVideoTools({ env: {}, spawn: odd.spawn })).resolves.toMatchObject({
      available: false,
      missing: ["probe_options"],
    })
  })

  it("is unavailable without ffprobe, without ffmpeg, or without an encoder", async () => {
    const noProbe = fakeSpawn((command, args) =>
      command === "ffprobe"
        ? { startError: "ENOENT" }
        : { stdout: args.includes("-encoders") ? ENCODERS : VERSION(command, "7.1") }
    )
    await expect(checkVideoTools({ env: {}, spawn: noProbe.spawn })).resolves.toMatchObject({
      available: false,
      missing: ["ffprobe"],
    })
    const none = fakeSpawn(() => ({ startError: "ENOENT" }))
    await expect(checkVideoTools({ env: {}, spawn: none.spawn })).resolves.toMatchObject({
      available: false,
      missing: ["ffprobe", "ffmpeg"],
      version: null,
    })
    const noVp9 = fakeSpawn((command, args) => ({
      stdout: args.includes("-encoders")
        ? ENCODERS.replace("libvpx-vp9", "libvpx")
        : VERSION(command, "6.1.1"),
    }))
    await expect(checkVideoTools({ env: {}, spawn: noVp9.spawn })).resolves.toMatchObject({
      available: false,
      missing: ["libvpx-vp9"],
    })
    const failing = fakeSpawn(() => ({ stdout: "", code: 1 }))
    await expect(checkVideoTools({ env: {}, spawn: failing.spawn })).resolves.toMatchObject({
      available: false,
    })
  })

  it("reads the version safely, and its major number", () => {
    expect(versionOf(VERSION("ffmpeg", "7.1.1-1ubuntu1"))).toBe("7.1.1-1ubuntu1")
    expect(versionOf(VERSION("ffmpeg", "n7.0.2"))).toBe("n7.0.2")
    expect(versionOf("ffmpeg version 8.0<script> Copyright")).toBe("8.0")
    expect(versionOf("nothing here")).toBeNull()
    expect(versionOf("")).toBeNull()
    expect(majorOf("7.1.1")).toBe(7)
    expect(majorOf("n6.1")).toBe(6)
    expect(majorOf("N-112345-gabc")).toBeNull()
    expect(majorOf(null)).toBeNull()
  })
})

describe("slots: a bounded number at once, a bounded queue", () => {
  const busy = () => new Error("busy")

  it("runs up to the limit, queues the rest in order, refuses past the queue", async () => {
    const slots = createSlots({ concurrency: 1, maxWaiting: 1, waitTimeoutMs: 1_000, busy })
    const first = await slots.take()
    const order: string[] = []
    const second = slots.take().then((release) => {
      order.push("second")
      return release
    })
    await expect(slots.take()).rejects.toThrow("busy")
    expect(slots.state()).toEqual({ running: 1, waiting: 1 })
    first()
    // Released twice: the second call does nothing
    first()
    const release = await second
    expect(order).toEqual(["second"])
    expect(slots.state()).toEqual({ running: 1, waiting: 0 })
    release()
    expect(slots.state()).toEqual({ running: 0, waiting: 0 })
  })

  it("gives up waiting after its time", async () => {
    const slots = createSlots({ concurrency: 1, maxWaiting: 2, waitTimeoutMs: 20, busy })
    const held = await slots.take()
    await expect(slots.take()).rejects.toThrow("busy")
    expect(slots.state()).toEqual({ running: 1, waiting: 0 })
    held()
  })

  it("with no queue, refuses at once when full", async () => {
    const slots = createSlots({ concurrency: 1, maxWaiting: 0, waitTimeoutMs: 1_000, busy })
    const held = await slots.take()
    await expect(slots.take()).rejects.toThrow("busy")
    held()
    const again = await slots.take()
    again()
  })
})
