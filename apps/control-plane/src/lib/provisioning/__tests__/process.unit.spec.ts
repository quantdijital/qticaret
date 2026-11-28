import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { layoutOf } from "../local/layout"
import {
  backendProcess,
  healthOf,
  isPortFree,
  ownedPid,
  ownedProcessPid,
  panelArgs,
  panelEnv,
  panelProcess,
  startProcess,
  startShop,
  stopProcess,
  stopShop,
} from "../local/process"

jest.setTimeout(30_000)

// A stand-in for `medusa start -p <port>`: answers /health with 200
const SERVER = [
  "const port = Number(process.argv[process.argv.indexOf('-p') + 1])",
  "require('node:http').createServer((req, res) => res.writeHead(req.url === '/health' ? 200 : 404).end()).listen(port, '127.0.0.1')",
].join("\n")

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function freePort(): Promise<number> {
  for (let port = 9290; port <= 9299; port++) {
    if (await isPortFree(port)) {
      return port
    }
  }
  throw new Error("no free port in 9290-9299")
}

describe("a local shop's process (Ek C10)", () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "qt-c10-proc-"))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it("starts detached with a pid file, answers its health, and stops only its own pid", async () => {
    const layout = layoutOf("atolye-bicak", root)
    await mkdir(dirname(layout.cli), { recursive: true })
    await writeFile(layout.cli, SERVER)
    await mkdir(layout.serverDir, { recursive: true })
    const port = await freePort()

    const pid = await startShop(layout, port, { PATH: process.env["PATH"] ?? "" })
    expect(Number((await readFile(layout.pidFile, "utf8")).trim())).toBe(pid)
    let health = await healthOf(port)
    for (let i = 0; i < 40 && health.status !== 200; i++) {
      await pause(100)
      health = await healthOf(port)
    }
    expect(health.status).toBe(200)
    expect(await ownedPid(layout, port)).toBe(pid)
    // Another port is another shop: not this process
    expect(await ownedPid(layout, port + 1)).toBeNull()
    await expect(startShop(layout, port, {})).rejects.toMatchObject({
      code: "provisioning.port_in_use",
    })

    expect(await stopShop(layout, port)).toBe(true)
    expect(await isPortFree(port)).toBe(true)
    await expect(readFile(layout.pidFile, "utf8")).rejects.toThrow()
  })

  it("never signals a pid that is not the shop's", async () => {
    const layout = layoutOf("atolye-bicak", root)
    await mkdir(layout.dir, { recursive: true })
    // The test runner's own pid, as if the file pointed elsewhere
    await writeFile(layout.pidFile, `${String(process.pid)}\n`)
    expect(await ownedPid(layout, 9231)).toBeNull()
    expect(await stopShop(layout, 9231)).toBe(false)
    // Still here, and the file naming a live process is left alone
    expect(await readFile(layout.pidFile, "utf8")).toContain(String(process.pid))
  })

  it("runs the shop's panel beside it: Vite on port + 1000, pointed at the backend (Ek 2026-11-28)", () => {
    const layout = layoutOf("atolye-bicak", root)
    expect(panelArgs(layout, 10231)).toEqual([layout.panelVite, "--strictPort", "--port", "10231"])
    const panel = panelProcess(layout, 9231)
    expect(panel).toMatchObject({ port: 10231, pidFile: layout.panelPidFile, cwd: layout.panelDir })
    expect(panel.pidFile).not.toBe(backendProcess(layout, 9231).pidFile)
    expect(panelEnv(9231, { PATH: "/bin", HOME: "/home/x", SECRET: "no" })).toEqual({
      PATH: "/bin",
      HOME: "/home/x",
      NODE_ENV: "development",
      PANEL_PORT: "10231",
      PANEL_BACKEND_URL: "http://localhost:9231",
    })
  })

  it("starts and stops the panel's own process, never the backend's", async () => {
    const layout = layoutOf("atolye-bicak", root)
    await mkdir(dirname(layout.panelVite), { recursive: true })
    // A stand-in for Vite: listens on `--port`
    await writeFile(
      layout.panelVite,
      [
        "const port = Number(process.argv[process.argv.indexOf('--port') + 1])",
        "require('node:http').createServer((req, res) => res.end('panel')).listen(port, '127.0.0.1')",
      ].join("\n")
    )
    await mkdir(layout.panelDir, { recursive: true })
    await mkdir(layout.dir, { recursive: true })
    // A free backend port in 9290–9299; its panel's port + 1000 must be free too
    const port = await freePort()
    const panel = panelProcess(layout, port)
    expect(await isPortFree(panel.port)).toBe(true)

    const pid = await startProcess(panel, panelEnv(port))
    for (let i = 0; i < 40 && (await isPortFree(panel.port)); i++) {
      await pause(100)
    }
    expect(await ownedProcessPid(panel)).toBe(pid)
    // The backend's pid file is not the panel's
    expect(await ownedPid(layout, port)).toBeNull()
    expect(await stopShop(layout, port)).toBe(false)
    expect(await isPortFree(panel.port)).toBe(false)

    expect(await stopProcess(panel)).toBe(true)
    expect(await isPortFree(panel.port)).toBe(true)
    await expect(readFile(layout.panelPidFile, "utf8")).rejects.toThrow()
  })
})
