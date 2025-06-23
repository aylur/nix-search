import { onCleanup } from "gnim"
import { Service, Variant, iface, methodAsync } from "gnim/dbus"
import { NixSearch } from "./nix"

type ResultMeta = {
  id: Variant<"s">
  name: Variant<"s">
  description: Variant<"s">
}

type SearchProviderProps = {
  onLaunchSearch: (term: string) => void
  onServeFailed: (error: unknown) => void
  nixSearch: NixSearch
}

@iface("org.gnome.Shell.SearchProvider2")
export default class SearchProvider extends Service {
  onLaunchSearch?: (term: string) => void
  nixSearch: NixSearch

  constructor({ onLaunchSearch, onServeFailed, nixSearch }: SearchProviderProps) {
    super()

    this.nixSearch = nixSearch
    this.onLaunchSearch = onLaunchSearch

    const server = this.serve({
      name: import.meta.domain,
      objectPath: `${import.meta.resource}/SearchProvider`,
    })

    server.catch(onServeFailed)
    onCleanup(() => this.stop())
  }

  @methodAsync([{ type: "as", name: "terms" }], [{ type: "as", name: "results" }])
  async GetInitialResultSet(terms: string[]): Promise<[string[]]> {
    return [await this.nixSearch.getInitial(terms)]
  }

  @methodAsync(
    [
      { type: "as", name: "previous_results" },
      { type: "as", name: "terms" },
    ],
    [{ type: "as", name: "results" }],
  )
  async GetSubsearchResultSet(_: string[], terms: string[]): Promise<[string[]]> {
    return this.GetInitialResultSet(terms)
  }

  @methodAsync([{ type: "as", name: "identifiers" }], [{ type: "aa{sv}", name: "metas" }])
  async GetResultMetas(identifiers: string[]): Promise<[Array<ResultMeta>]> {
    const pkgs = await this.nixSearch.getPkgs(identifiers)
    return [
      pkgs.map(({ id, pname, description }) => ({
        id: Variant.new("s", id),
        name: Variant.new("s", pname),
        description: Variant.new("s", description),
      })),
    ]
  }

  @methodAsync(
    { type: "s", name: "idetintifier" },
    { type: "as", name: "terms" },
    { type: "u", name: "timestamp" },
  )
  async ActivateResult(identifier: string): Promise<void> {
    this.nixSearch.activate(identifier)
  }

  @methodAsync({ type: "as", name: "terms" }, { type: "u", name: "timestamp" })
  async LaunchSearch([term]: string[]): Promise<void> {
    this.onLaunchSearch?.(term)
  }
}
