import { describe, expect, it } from "vitest"
import { describeUserAgent } from "./user-agent"

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Chrome 141 · macOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Edge 141 · Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      "Safari 18 · iOS",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
      "Samsung Internet 28 · Android",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      "Firefox 144 · Linux",
    ],
  ])("reads %s", (agent, expected) => {
    expect(describeUserAgent(agent)).toBe(expected)
  })

  it("says nothing of an agent it does not know", () => {
    expect(describeUserAgent("node-fetch/1.0")).toBeNull()
  })
})
