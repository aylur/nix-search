import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Fuse from "fuse.js/basic"
import { Accessor, createState, onCleanup } from "gnim"
import { Settings, useSettings } from "./settings"

Gio._promisify(Gio.File.prototype, "create_async")
Gio._promisify(Gio.File.prototype, "load_contents_async")
Gio._promisify(Gio.File.prototype, "replace_contents_async")
Gio._promisify(Gio.File.prototype, "make_directory_async")
Gio._promisify(Gio.OutputStream.prototype, "write_bytes_async")

const cacheDir = `${GLib.get_user_cache_dir()}/${import.meta.name}`
const system = await exec(["nix", "eval", "--impure", "--expr", "builtins.currentSystem"])
const prefix = `legacyPackages.${JSON.parse(system)}.`

export type Nixpkg = {
  id: string
  description: string
  pname: string
  version: string
}

function exec(argv: string[]): Promise<string> {
  const proc = Gio.Subprocess.new(
    argv,
    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
  )

  return new Promise((resolve, reject) => {
    proc.communicate_utf8_async(null, null, (_, res) => {
      const [, stdout, stderr] = proc.communicate_utf8_finish(res)
      if (!proc.get_successful()) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}

async function getCache(settings: Settings) {
  const branch = settings.nixpkgsBranch.get()
  const cache = settings.cacheTimestamps.get()

  const filePath = `${cacheDir}/${branch}.json`
  const dir = GLib.path_get_dirname(filePath)
  const now = GLib.DateTime.new_now_local().to_unix()
  const timestamp = cache[branch] ?? 0
  const exists = GLib.file_test(filePath, GLib.FileTest.EXISTS)

  try {
    if (timestamp < now || !exists) {
      settings.setCacheTimestamps((prev) => ({ ...prev, [branch]: now }))

      if (!GLib.file_test(dir, GLib.FileTest.IS_DIR)) {
        await Gio.File.new_for_path(dir).make_directory_async(GLib.PRIORITY_DEFAULT, null)
      }

      const pkgs = await exec(["nix", "search", branch, "^", "--json"])
      const file = Gio.File.new_for_path(filePath)
      const contents = new GLib.Bytes(pkgs as unknown as Uint8Array)

      await file.replace_contents_async(
        contents as unknown as string,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      )

      return JSON.parse(pkgs)
    }

    const [contents] = await Gio.File.new_for_path(filePath).load_contents_async(null)
    const decoder = new TextDecoder("utf-8")
    return JSON.parse(decoder.decode(contents))
  } catch (error) {
    console.error(error)
    return {}
  }
}

async function getPackages(settings: Settings) {
  const pkgs = (await getCache(settings)) as Record<string, Omit<Nixpkg, "id">>
  const list = Object.entries(pkgs).map(([id, pkg]) => ({ id: id.replace(prefix, ""), ...pkg }))
  const dict = Object.fromEntries(list.map((pkg) => [pkg.id, pkg]))
  return [list, dict] as const
}

export class NixSearch extends Accessor<Array<Nixpkg>> {
  private subscribers = new Set<() => void>()
  private list = new Array<Nixpkg>()
  private pkgs?: Record<string, Nixpkg>
  private fuse?: Fuse<Nixpkg>
  private branch!: string

  loading: Accessor<boolean>

  constructor() {
    super(
      () => this.list,
      (callback) => {
        this.subscribers.add(callback)
        return () => this.subscribers.delete(callback)
      },
    )

    const settings = useSettings()
    const [loading, setLoading] = createState(true)
    this.loading = loading

    const init = async () => {
      setLoading(true)
      try {
        const [list, dict] = await getPackages(settings)
        this.branch = settings.nixpkgsBranch.get()
        this.pkgs = dict
        this.fuse = new Fuse(list, { keys: ["id"] })
        setLoading(false)
      } catch (error) {
        logError(error)
      }
    }

    init()
    onCleanup(settings.nixpkgsBranch.subscribe(init))
    onCleanup(settings.cacheTimestamps.subscribe(init))
  }

  setSearch(pattern: string) {
    if (!this.fuse) return

    const res = this.fuse.search(pattern)
    this.list = res.map((i) => i.item)
    this.subscribers.forEach((cb) => cb())
  }

  async getInitial(terms: string[]): Promise<string[]> {
    if (!this.fuse) return [] // TODO: wait for fuse

    const res = terms.flatMap((term) => this.fuse!.search(term))
    const ids = new Set(res.map((i) => i.item.id))
    return [...ids.values()]
  }

  async getPkgs(ids: string[]): Promise<Nixpkg[]> {
    if (!this.pkgs) return [] // TODO: wait for pkgs
    return ids.map((id) => this.pkgs![id])
  }

  async activate(id: string): Promise<void> {
    await exec(["systemd-run", "--user", "nix", "run", `${this.branch}#${id}`])
  }
}
