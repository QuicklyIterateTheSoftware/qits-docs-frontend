import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, of, switchMap } from 'rxjs';
import {
  QitsPicker,
  QITS_SCOPE,
  scopeCommands,
  scopePath,
  type QitsPickerOption,
} from '@qits/ui-components';
import { CatalogService, type Catalog, type DocEntry, type DocVersion } from './catalog';
import { APIDOCS_SCOPE, DOC_SECTIONS, USERFLOWS_SCOPE } from './doc-kind';
import { parseReadPath, readCommands } from './doc-url';

/** One sub-navigation section: its header, and its site groups (scope label null = unlabelled). */
export interface NavSection {
  readonly label: string;
  readonly groups: readonly { readonly scope: string | null; readonly docs: readonly DocEntry[] }[];
}

/**
 * The catalog folded into the three sub-navigation sections — Storybook keeps its scope grouping,
 * the two special scopes render flat under their own headers (repeating `@userflows` under a
 * header that says Userflows would be saying it twice). All three sections always exist, so the
 * navigation states what KINDS of documentation there are, not only what happens to be published.
 */
export function navSections(catalog: Catalog | undefined): NavSection[] {
  const scopes = catalog?.scopes ?? [];
  return DOC_SECTIONS.map((section) => {
    switch (section.kind) {
      case 'apidocs':
      case 'userflows': {
        const scope = section.kind === 'apidocs' ? APIDOCS_SCOPE : USERFLOWS_SCOPE;
        const docs = scopes.find((group) => group.scope === scope)?.docs ?? [];
        return { label: section.label, groups: docs.length ? [{ scope: null, docs }] : [] };
      }
      case 'storybook':
        return {
          label: section.label,
          groups: scopes
            .filter((group) => group.scope !== APIDOCS_SCOPE && group.scope !== USERFLOWS_SCOPE)
            .map((group) => ({ scope: group.scope, docs: group.docs })),
        };
    }
  });
}

/** The branch a version was published from, when its publisher recorded one. */
export function branchOf(version: DocVersion): string | undefined {
  return version.metadata?.['git.branch.name'];
}

/** The distinct branches of a version list, in list (newest-first) order, unbranched skipped. */
export function distinctBranches(versions: readonly DocVersion[]): string[] {
  const seen: string[] = [];
  for (const version of versions) {
    const branch = branchOf(version);
    if (branch && !seen.includes(branch)) {
      seen.push(branch);
    }
  }
  return seen;
}

/** The sentinel `branch` value meaning "no filter" — a real branch name is never empty. */
export const ALL_BRANCHES = '';

/**
 * The version picker's options: the list narrowed to one branch (or all of it), each labelled with
 * its branch beside the version, `(latest)` on the first element OF THE NARROWED LIST — that is
 * what a link without a version resolves to for a reader following this filter's answer.
 */
export function versionOptions(
  versions: readonly DocVersion[],
  branch: string,
): QitsPickerOption<string>[] {
  const narrowed =
    branch === ALL_BRANCHES ? [...versions] : versions.filter((v) => branchOf(v) === branch);
  return narrowed.map((v, index) => {
    const along = branchOf(v);
    const name = along ? `${v.version} — ${along}` : v.version;
    return { value: v.version, label: index === 0 ? `${name}  (latest)` : name };
  });
}

/**
 * The catalog, as the sub-menu under this application's entry in the platform navigation.
 *
 * <p><b>This replaced a second left column.</b> The reader used to carry its own 230px rail beside
 * the bundle — breadcrumbs, the site name, the version picker — which put three navigations on one
 * page: the platform's sidebar, this rail, and Storybook's own inside the iframe. Everything the
 * rail held lives here instead, in the one column the platform already has.
 *
 * <p>It is fed by the same `catalog()` the landing page reads, and that is the whole reason
 * `scope.ts` is gone: a scope page built from the same response was a second implementation of this
 * list that could disagree with it.
 *
 * <p>The version picker is nested under the site being read and nowhere else. A picker beside a
 * site nobody has opened is asking a question about a document that is not on screen, and answering
 * it would navigate somewhere the reader never asked to go.
 */
@Component({
  selector: 'docs-nav-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, QitsPicker],
  template: `
    @if (catalog()) {
      @for (section of sections(); track section.label) {
        <p class="section">{{ section.label }}</p>
        @if (!section.groups.length) {
          <p class="hint">Nothing published yet</p>
        }
        @for (group of section.groups; track group.scope ?? '') {
          @if (group.scope !== null) {
            <p class="scope">{{ group.scope || 'ungrouped' }}</p>
          }
          <ul class="sites">
          @for (entry of group.docs; track entry.name) {
            <li>
              <a
                class="site"
                [class.current]="entry.name === site()"
                [attr.aria-current]="entry.name === site() ? 'page' : null"
                [routerLink]="commands(entry.name)"
                >{{ entry.shortName }}</a
              >

              @if (entry.name === site()) {
                <div class="versions">
                  @if (branches().length > 1) {
                    <qits-picker
                      [options]="branchOptions()"
                      [value]="selectedBranch()"
                      (valueChange)="onBranch($event)"
                      ariaLabel="Branch"
                      placeholder="All branches"
                    />
                  }
                  @if (options().length) {
                    <qits-picker
                      [options]="options()"
                      [value]="selected()"
                      (valueChange)="onVersion($event)"
                      ariaLabel="Documentation version"
                      placeholder="Pick a version"
                    />
                  } @else {
                    <p class="hint">Loading versions…</p>
                  }
                </div>
              }
            </li>
          }
          </ul>
        }
      }
    } @else {
      <p class="hint">Loading…</p>
    }
  `,
  styles: `
    /* The layout contributes a bare block and no opinions, so every rule this tree needs is here.
       It renders inside a 240px column that already scrolls and pads 8px — hence no padding of its
       own, and no height: the column is what scrolls. */
    :host {
      display: block;
      min-width: 0;
      padding: 4px 0 8px;
    }
    /* The three sub-navigation headers — one visual rank above a scope label. */
    .section {
      margin: 14px 0 2px;
      padding: 0 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #374151;
    }
    .section:first-child {
      margin-top: 4px;
    }
    .scope {
      margin: 10px 0 2px;
      padding: 0 10px 0 18px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #6b7280;
      overflow-wrap: anywhere;
    }
    .sites {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .site {
      display: block;
      padding: 4px 10px 4px 18px;
      font-size: 13px;
      color: #374151;
      text-decoration: none;
      border-radius: 6px;
      overflow-wrap: anywhere;
    }
    .site:hover {
      background: #f3f4f6;
      color: #111827;
    }
    .current {
      color: #111827;
      font-weight: 600;
    }
    /* The picker is not a dropdown: cleared, it renders its whole option list open inline, and a
       site with fifty versions would otherwise push the rest of the catalog off the column. A cap
       plus its own scroller keeps the cleared state a panel rather than a takeover. */
    .versions {
      margin: 4px 0 6px;
      padding-left: 18px;
      max-height: 40vh;
      overflow-y: auto;
    }
    .hint {
      margin: 6px 10px;
      font-size: 12px;
      color: #6b7280;
    }
  `,
})
export class DocsNavTree {
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly scopeSource = inject(QITS_SCOPE, { optional: true });

  /**
   * Where the reader lives on this host: `/read/…` unscoped, `/<slug>/<category>/<repo>/read/…`
   * under a repository address. Every link this tree writes carries it, so opening a document from
   * a scoped page stays in that scope rather than dropping out of it.
   */
  private readonly prefix = computed(() => scopeCommands(this.scopeSource?.scope()));

  /** Bound in the template; a template can only reach a member, not an imported function. */
  protected commands(site: string): string[] {
    return readCommands(site, undefined, this.prefix());
  }

  protected readonly catalog = toSignal(this.catalogService.catalog());

  /** The three sub-navigation sections; see {@link navSections}. */
  protected readonly sections = computed(() => navSections(this.catalog()));

  /**
   * The URL, as a signal, because Angular 21.2 has no signal-valued `Router.url` — only a string
   * getter and `currentNavigation`, which is null once a navigation has finished. So the events are
   * filtered to `NavigationEnd` and the getter read at each one.
   *
   * <p>This tree lives in the shell, above every routed component, so it has no `ActivatedRoute`
   * worth reading: its own route is the empty one. The seed matters as much as the stream — a
   * reader who lands directly on a read URL gets no `NavigationEnd` before the first render.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly read = computed(() => {
    // Query and fragment are not part of the grammar. Segments are decoded because the router
    // encoded them, and `parseReadPath` is written against the decoded names the reader also sees.
    //
    // The scope path is trimmed off FIRST. Under `/qits/services/qits-docs/read/@qits/…` the three
    // scope segments are not part of the site name, and left in they make the site
    // `qits/services/qits-docs/read/@qits/…` — which matches no entry, so the picker never appears.
    const path = this.url().split('#')[0].split('?')[0];
    const base = scopePath(this.scopeSource?.scope());
    const inside = path.startsWith(base) ? path.slice(base.length) : path;
    return parseReadPath(inside.split('/').filter(Boolean).map(decodeURIComponent));
  });

  /** Empty on the landing page, which is how the template knows to nest the picker nowhere. */
  protected readonly site = computed(() => this.read().site);
  private readonly version = computed(() => this.read().version);

  private readonly loaded = toSignal(
    toObservable(this.site).pipe(
      switchMap((site) => (site ? this.catalogService.versions(site) : of(undefined))),
    ),
  );

  /**
   * The branch filter — component state, deliberately not part of the URL grammar: a branch is a
   * way of narrowing the picker, not an address, and `doc-url`'s `/-/` grammar has no slot for it.
   * Filtering is LOCAL over the cached unfiltered list, also deliberately: the branch OPTIONS can
   * only be derived from that full list, so it is already in memory, and a per-selection fetch
   * through the upstream filter could disagree with the list the reader resolved `latest` from —
   * the exact hazard the cache exists to prevent. (`?branch=` on the API stays the machine door.)
   */
  protected readonly selectedBranch = signal<string>(ALL_BRANCHES);

  /** Another site is another version list — a filter carried across would narrow it to nothing. */
  private readonly resetFilterOnSiteChange = effect(() => {
    this.site();
    this.selectedBranch.set(ALL_BRANCHES);
  });

  protected readonly branches = computed(() => distinctBranches(this.loaded()?.versions ?? []));

  protected readonly branchOptions = computed<QitsPickerOption<string>[]>(() => [
    { value: ALL_BRANCHES, label: 'All branches' },
    ...this.branches().map((branch) => ({ value: branch, label: branch })),
  ]);

  protected onBranch(branch: string | undefined): void {
    this.selectedBranch.set(branch ?? ALL_BRANCHES);
  }

  // The newest of the narrowed list is marked `(latest)`, because "latest" is what a link without
  // a version resolves to and a reader arriving that way should see that is where they are.
  protected readonly options = computed<QitsPickerOption<string>[]>(() =>
    versionOptions(this.loaded()?.versions ?? [], this.selectedBranch()),
  );

  /**
   * Which version the picker shows as chosen.
   *
   * A URL with no version is still READING one — the newest — so leaving the picker empty would
   * have it say nothing is selected while a document is on screen. It resolves from the same list
   * the reader resolves from, through the same cached request, so the two cannot disagree.
   */
  protected readonly selected = computed(
    () => this.version() ?? this.loaded()?.versions[0]?.version,
  );

  protected onVersion(version: string | undefined): void {
    const site = this.site();
    if (!version || !site) {
      return;
    }
    // A router hop, not a full-document navigation. The predecessor reloaded the page on the
    // grounds that the iframe had to be rebuilt — which was never true: `[src]` is a property
    // binding (that is why it demands a SafeResourceUrl), and assigning an iframe's src navigates
    // the nested browsing context on its own. A reload would now also destroy this tree, which is
    // the one thing moving the picker into the sidebar was for.
    void this.router.navigate(readCommands(site, version, this.prefix()));
  }
}
