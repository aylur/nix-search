import Adw from "gi://Adw"
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import { createBinding, createComputed, For, getScope, This } from "gnim"
import { property, register } from "gnim/gobject"
import { settings } from "./settings"
import { Nixpkg, NixSearch } from "./nix"
import PrefWindow from "./PrefWindow"

interface AppWindowProps {
  application: Adw.Application
  nixSearch: NixSearch
}

@register()
export default class AppWindow extends Adw.ApplicationWindow {
  @property(String) searchText = ""

  constructor({ application, nixSearch }: AppWindowProps) {
    super({ application })
    const scope = getScope()

    const { nixpkgsBranch, exitOnLaunch } = settings

    const visibleChildName = createComputed(
      [nixSearch, createBinding(this, "searchText")],
      ({ length }, text) => {
        if (text === "") return "search"
        if (nixSearch.loading.get()) return "list"
        return length > 0 ? "list" : "empty"
      },
    )

    const onSettings = () => {
      scope.run(() => PrefWindow({ ref: (dialog) => dialog.present(this) }))
    }

    const onActivate = async (id: string) => {
      await nixSearch.activate(id)
      if (exitOnLaunch.get()) application.quit()
    }

    void (
      <This this={this as AppWindow} defaultWidth={440} defaultHeight={500} title={_("Nix Search")}>
        <Adw.ToolbarView>
          <Adw.HeaderBar $type="top">
            <Gtk.Button
              $type="start"
              class="flat"
              tooltipText={_("Open Preferences")}
              onClicked={onSettings}
            >
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
          <Gtk.Overlay>
            <Gtk.Revealer
              $type="overlay"
              halign={Gtk.Align.END}
              valign={Gtk.Align.END}
              marginBottom={12}
              marginEnd={12}
              revealChild={nixSearch.loading}
              transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
            >
              <Adw.Spinner widthRequest={32} heightRequest={32} />
            </Gtk.Revealer>
            <Gtk.Stack visibleChildName={visibleChildName}>
              <Adw.StatusPage
                $type="named"
                name="search"
                iconName="system-search-symbolic"
                title={_("Start typing to search packages")}
              />
              <Adw.StatusPage
                $type="named"
                name="empty"
                iconName="system-search-symbolic"
                title={_("No match was found")}
              />
              <Gtk.ScrolledWindow $type="named" name="list" hexpand vexpand>
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
                                  onActivate(pkg.id)
                                }
                              }}
                            />
                            <Gtk.GestureClick onPressed={() => onActivate(pkg.id)} />
                            <Gtk.Box css="padding:6px;" orientation={Gtk.Orientation.VERTICAL}>
                              <Gtk.Box>
                                <Gtk.Label
                                  halign={Gtk.Align.START}
                                  class="heading"
                                  hexpand
                                  label={pkg.pname}
                                />
                                <Gtk.Label
                                  opacity={0.8}
                                  halign={Gtk.Align.END}
                                  label={pkg.version}
                                />
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
            </Gtk.Stack>
          </Gtk.Overlay>
        </Adw.ToolbarView>
      </This>
    )
  }
}
