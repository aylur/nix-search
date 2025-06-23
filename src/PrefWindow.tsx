import Adw from "gi://Adw"
import { settings } from "./settings"

type PrefWindowProps = {
  ref: (self: Adw.Dialog) => void
}

export default function PrefWindow({ ref }: PrefWindowProps) {
  const { nixpkgsBranch, setNixpkgsBranch, exitOnLaunch, setExitOnLaunch, clearCacheTimestamps } =
    settings

  return (
    <Adw.PreferencesDialog $={ref}>
      <Adw.PreferencesPage title={_("Settings")} iconName="settings-symbolic">
        <Adw.PreferencesGroup>
          <Adw.EntryRow
            title={_("Nixpkgs Branch")}
            text={nixpkgsBranch}
            onEntryActivated={({ text }) => setNixpkgsBranch(text)}
          />
          <Adw.SwitchRow
            title={_("Exit on Launch")}
            subtitle={_("Upon launching a package exit the application")}
            active={exitOnLaunch}
            onNotifyActive={({ active }) => setExitOnLaunch(active)}
          />
          <Adw.ButtonRow title={_("Clear Cache")} onActivated={clearCacheTimestamps} />
        </Adw.PreferencesGroup>
      </Adw.PreferencesPage>
    </Adw.PreferencesDialog>
  )
}
