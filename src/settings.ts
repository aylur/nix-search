import Gio from "gi://Gio"
import { createBinding, createContext } from "gnim"

const NIXPKGS_BRANCH = "nixpkgs-branch"

export type Settings = ReturnType<typeof createSettings>

export function createSettings() {
  const s = new Gio.Settings({
    schemaId: import.meta.domain,
  })

  return {
    nixpkgsBranch: createBinding<string>(s, NIXPKGS_BRANCH),
    setNixpkgsBranch: (v: string) => s.set_string(NIXPKGS_BRANCH, v),
  }
}

export const SettingsContext = createContext<Settings | null>(null)

export function useSettings() {
  const settings = SettingsContext.use()
  if (!settings) throw Error("missing settings context")
  return settings
}
