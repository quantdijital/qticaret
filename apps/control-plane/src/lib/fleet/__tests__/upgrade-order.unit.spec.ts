import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { controlPlaneVersion } from "../control-plane-release"
import { compareVersions } from "../releases"

describe("upgrade order (audit 3.1, adr/0061 Ek C21)", () => {
  it("orders versions by semver precedence", () => {
    const ordered = [
      "0.0.0",
      "0.0.1",
      "0.9.0",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.2.0",
      "1.10.0",
      "2.0.0",
    ]
    for (let i = 0; i < ordered.length; i++) {
      for (let j = 0; j < ordered.length; j++) {
        expect(Math.sign(compareVersions(ordered[i] ?? "", ordered[j] ?? ""))).toBe(
          Math.sign(i - j)
        )
      }
    }
  })

  it("reads the control plane's own version, null when it is not strict semver", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qt-cp-release-"))
    try {
      expect(controlPlaneVersion(dir)).toBeNull()
      await writeFile(join(dir, "package.json"), JSON.stringify({ version: "1.4.0" }))
      expect(controlPlaneVersion(dir)).toBe("1.4.0")
      await writeFile(join(dir, "package.json"), JSON.stringify({ version: "1.4" }))
      expect(controlPlaneVersion(dir)).toBeNull()
      await writeFile(join(dir, "package.json"), "{")
      expect(controlPlaneVersion(dir)).toBeNull()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
