import Gio from "gi://Gio"
import { createSettings, createContext } from "gnim"

export function createAppSettings() {
  const s = new Gio.Settings({
    schemaId: import.meta.domain,
  })

  return createSettings(s, {
    "nixpkgs-branch": "s",
    "exit-on-launch": "b",
    "cache-timestamps": "a{su}",
  })
}

export type Settings = ReturnType<typeof createAppSettings>

export const SettingsContext = createContext<Settings | null>(null)

export function useSettings() {
  const settings = SettingsContext.use()
  if (!settings) throw Error("missing SettingsContext")
  return settings
}
