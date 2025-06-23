import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Fuse from "fuse.js/basic"
import { Accessor } from "gnim"

Gio._promisify(Gio.File.prototype, "create_async")
Gio._promisify(Gio.File.prototype, "load_contents_async")
Gio._promisify(Gio.File.prototype, "replace_contents_async")
Gio._promisify(Gio.File.prototype, "make_directory_async")
Gio._promisify(Gio.OutputStream.prototype, "write_bytes_async")

const branch = "nixpkgs"
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
        reject(Error(stderr))
      } else {
        resolve(stdout)
      }
    })
  })
}

// TODO: invalidate

async function getCache() {
  const filePath = `${cacheDir}/${branch}.json`

  if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
    if (!GLib.file_test(cacheDir, GLib.FileTest.IS_DIR)) {
      await Gio.File.new_for_path(cacheDir).make_directory_async(GLib.PRIORITY_DEFAULT, null)
    }

    const pkgs = await exec(["nix", "search", branch, "^", "--json"])

    const stream = await Gio.File.new_for_path(filePath).create_async(
      Gio.FileCreateFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
    )

    await stream.write_bytes_async(
      new GLib.Bytes(pkgs as unknown as Uint8Array),
      GLib.PRIORITY_DEFAULT,
      null,
    )

    return JSON.parse(pkgs)
  }

  const [contents] = await Gio.File.new_for_path(filePath).load_contents_async(null)
  const decoder = new TextDecoder("utf-8")
  return JSON.parse(decoder.decode(contents))
}

async function getPackages() {
  const pkgs = (await getCache()) as Record<string, Omit<Nixpkg, "id">>
  const list = Object.entries(pkgs).map(([id, pkg]) => ({ id: id.replace(prefix, ""), ...pkg }))
  const dict = Object.fromEntries(list.map((pkg) => [pkg.id, pkg]))
  return [list, dict] as const
}

export class NixSearch extends Accessor<Array<Nixpkg>> {
  private subscribers = new Set<() => void>()
  private list = new Array<Nixpkg>()
  private pkgs?: Record<string, Nixpkg>
  private fuse?: Fuse<Nixpkg>

  constructor() {
    super(
      () => this.list,
      (callback) => {
        this.subscribers.add(callback)
        return () => this.subscribers.delete(callback)
      },
    )

    getPackages().then(([list, dict]) => {
      this.pkgs = dict
      this.fuse = new Fuse(list, { keys: ["id"] })
    })
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
    await exec(["systemd-run", "--user", "nix", "run", `${branch}#${id}`])
  }
}
