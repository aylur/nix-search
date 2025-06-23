import Adw from "gi://Adw"
import Gio from "gi://Gio"
import { register } from "gnim/gobject"
import { createRoot } from "gnim"
import SearchProvider from "./SearchProvider"
import AppWindow from "./AppWindow"
import { createSettings, SettingsContext } from "./settings"
import { NixSearch } from "./nix"

@register({ GTypeName: "App" })
export class App extends Adw.Application {
  declare private provider?: SearchProvider
  declare private window?: AppWindow

  constructor() {
    super({
      applicationId: import.meta.domain,
      flags: Gio.ApplicationFlags.FLAGS_NONE,
    })
  }

  vfunc_startup(): void {
    super.vfunc_startup()

    createRoot((dispose) => {
      this.connect("shutdown", dispose)

      SettingsContext.provide(createSettings(), () => {
        const nix = new NixSearch()

        const win = (this.window = new AppWindow({
          application: this,
          nixSearch: nix,
        }))

        this.provider = new SearchProvider({
          nixSearch: nix,
          onServeFailed: (error) => {
            console.error(error)
            this.quit()
          },
          onLaunchSearch: (term) => {
            win.searchText = term
            win.present()
          },
        })
      })
    })
  }

  vfunc_activate(): void {
    this.window?.present()
  }
}
