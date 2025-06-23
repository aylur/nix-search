import Adw from "gi://Adw"
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import { createBinding, For, This } from "gnim"
import { property, register } from "gnim/gobject"
import { useSettings } from "./settings"
import { Nixpkg, NixSearch } from "./nix"

interface AppWindowProps {
  application: Adw.Application
  nixSearch: NixSearch
}

@register()
export default class AppWindow extends Adw.ApplicationWindow {
  @property(String) searchText = ""

  constructor({ application, nixSearch }: AppWindowProps) {
    super({ application })

    const { nixpkgsBranch } = useSettings()

    void (
      <This this={this as AppWindow} defaultWidth={400} defaultHeight={500} title={_("Nix Search")}>
        <Adw.ToolbarView>
          <Adw.HeaderBar $type="top">
            <Gtk.Button $type="start">
              <Gtk.Image iconName="settings-symbolic" />
            </Gtk.Button>
            <Adw.Clamp $type="title" hexpand maximumSize={380}>
              <Gtk.SearchEntry
                hexpand
                searchDelay={250}
                text={createBinding(this, "searchText")}
                placeholderText={nixpkgsBranch((b) => _("Start searching on %s").format(b))}
                onSearchChanged={({ text }) => nixSearch.setSearch((this.searchText = text))}
                onNotifyText={(self) => !self.has_focus && self.grab_focus()}
                $={(self) => self.set_key_capture_widget(this)}
              />
            </Adw.Clamp>
          </Adw.HeaderBar>
          <Adw.ToastOverlay>
            <Gtk.ScrolledWindow hexpand vexpand>
              <Gtk.Box
                marginTop={4}
                marginBottom={10}
                marginStart={10}
                marginEnd={10}
                valign={Gtk.Align.START}
              >
                <Adw.Clamp maximumSize={520}>
                  <Gtk.ListBox hexpand class="boxed-list" selectionMode={Gtk.SelectionMode.NONE}>
                    <For each={nixSearch((v) => v.slice(0, 20))}>
                      {(pkg: Nixpkg) => (
                        <Gtk.ListBoxRow>
                          <Gtk.EventControllerKey
                            onKeyPressed={(_, key) => {
                              if (key === Gdk.KEY_Return || key === Gdk.KEY_ISO_Enter) {
                                nixSearch.activate(pkg.id).then(() => this.application.quit())
                              }
                            }}
                          />
                          <Gtk.GestureClick
                            onPressed={() =>
                              nixSearch.activate(pkg.id).then(() => this.application.quit())
                            }
                          />
                          <Gtk.Box css="padding:6px;" orientation={Gtk.Orientation.VERTICAL}>
                            <Gtk.Box>
                              <Gtk.Label
                                halign={Gtk.Align.START}
                                class="heading"
                                hexpand
                                label={pkg.pname}
                              />
                              <Gtk.Label opacity={0.8} halign={Gtk.Align.END} label={pkg.version} />
                            </Gtk.Box>
                            <Gtk.Label
                              halign={Gtk.Align.START}
                              wrap
                              opacity={0.8}
                              label={pkg.description}
                            />
                          </Gtk.Box>
                        </Gtk.ListBoxRow>
                      )}
                    </For>
                  </Gtk.ListBox>
                </Adw.Clamp>
              </Gtk.Box>
            </Gtk.ScrolledWindow>
          </Adw.ToastOverlay>
        </Adw.ToolbarView>
      </This>
    )
  }
}
