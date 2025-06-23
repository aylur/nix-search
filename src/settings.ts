import Gio from "gi://Gio"
import { Variant } from "gnim/dbus"
import { createBinding } from "gnim"

const NIXPKGS_BRANCH = "nixpkgs-branch"
const EXIT_ON_LAUNCH = "exit-on-launch"
const CACHE_TIMESTAMPS = "cache-timestamps"

export let settings: ReturnType<typeof createSettings>

export function initSettings() {
  return (settings = createSettings())
}

function createSettings() {
  const s = new Gio.Settings({
    schemaId: import.meta.domain,
  })

  const onClear = new Set<() => void>()

  return {
    nixpkgsBranch: createBinding<string>(s, NIXPKGS_BRANCH),
    setNixpkgsBranch: (v: string) => s.set_string(NIXPKGS_BRANCH, v),

    exitOnLaunch: createBinding<boolean>(s, EXIT_ON_LAUNCH),
    setExitOnLaunch: (v: boolean) => s.set_boolean(EXIT_ON_LAUNCH, v),

    onClear: (callback: () => void) => {
      onClear.add(callback)
      return () => onClear.delete(callback)
    },
    clearCacheTimestamps: () => {
      s.set_value(CACHE_TIMESTAMPS, Variant.new("a{su}", {}))
      onClear.forEach((cb) => cb())
    },
    cacheTimestamps: createBinding<Record<string, number>>(s, CACHE_TIMESTAMPS),
    setCacheTimestamp: (branch: string, v: number) => {
      s.set_value(
        CACHE_TIMESTAMPS,
        Variant.new("a{su}", {
          ...s.get_value(CACHE_TIMESTAMPS).recursiveUnpack(),
          [branch]: v,
        }),
      )
    },
  }
}
