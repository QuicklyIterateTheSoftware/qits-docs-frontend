import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, of, switchMap } from 'rxjs';
import { QITS_SCOPE, scopeCommands, scopePath } from '@qits/ui-components';
import { categoriesOf, storyPages } from './bundle-files';
import { CatalogService, type Catalog, type DocEntry } from './catalog';
import {
  APIDOCS_SCOPE,
  DOC_SECTIONS,
  USERFLOWS_SCOPE,
  kindOf,
  siteBelongsToRepository,
} from './doc-kind';
import { parseReadPath, readCommands } from './doc-url';
import { defaultVersion } from './reader';

/** One sub-navigation entry: a section, with its sites (shown when the section is the open one). */
export interface NavSection {
  readonly label: string;
  readonly route: string;
  readonly docs: readonly DocEntry[];
}

/**
 * The catalog folded into the three sub-navigation entries — narrowed to one repository's own
 * sites when one is given, because under a repository scope another repository's docs are noise
 * with a misleading address. Sites keep the catalog's order; the two special scopes' sites drop
 * their scope prefix from display (repeating `@userflows` under an entry that says Userflows would
 * be saying it twice), and storybook keeps full names since its scopes vary.
 */
export function navSections(catalog: Catalog | undefined, repository?: string): NavSection[] {
  const scopes = catalog?.scopes ?? [];
  return DOC_SECTIONS.map((section) => ({
    label: section.label,
    route: section.route,
    docs: (section.kind === 'storybook'
      ? scopes
          .filter((group) => group.scope !== APIDOCS_SCOPE && group.scope !== USERFLOWS_SCOPE)
          .flatMap((group) => group.docs)
      : (scopes.find(
          (group) =>
            group.scope === (section.kind === 'apidocs' ? APIDOCS_SCOPE : USERFLOWS_SCOPE),
        )?.docs ?? [])
    ).filter((entry) => !repository || siteBelongsToRepository(entry.shortName, repository)),
  }));
}

/**
 * The docs sub-menu under this application's entry in the platform navigation: the three section
 * entries, and — only under the OPEN section — its next level as child rows. That is the platform
 * sidebar's own shape one level down: `repositoryRows()` shows a repository's detail entries only
 * for the repository in scope, and a child row is the same 2px-rail indent idiom.
 *
 * <p><b>Under a repository scope there is no site layer, and the tree is always open.</b> The
 * scope IS the site selection — sections hold only that repository's docs, a section link opens
 * its one site directly, and a userflows section's children are the categories themselves,
 * visible without clicking into the section first. All three sections stay listed even when the
 * repository has published nothing of that kind: the row is the map, and its page says what is
 * missing and how it gets here. Unscoped, the menu keeps all three levels — section, site,
 * category — expanding only the open section, because there the catalog can be long.
 *
 * <p><b>Nothing here selects a version.</b> A site link opens its newest content (the reader
 * defaults userflows to the latest `main` bundle), and switching branch or version is the reader's
 * own header — the code pages' pattern: the sidebar holds places, the page holds the controls, and
 * a rev is a path segment the router carries.
 */
@Component({
  selector: 'docs-nav-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (catalog()) {
      <ul class="entries">
        @for (section of sections(); track section.route) {
          <li>
            <a
              class="entry"
              [class.current]="sectionCurrent(section.route)"
              [attr.aria-current]="sectionCurrent(section.route) ? 'page' : null"
              [routerLink]="sectionLink(section)"
              >{{ section.label }}</a
            >
            @if (scopedRepository()) {
              <!-- Scoped below a repository the middle layer disappears and nothing waits for a
                   click: the section is the repository's own site, so its categories are the next
                   level directly, drawn whatever page is on screen. -->
              @if (section.route === userflowsRoute && categorySite(); as site) {
                @for (category of categories(); track category) {
                  <a
                    class="entry child"
                    [class.current]="category === activeCategory()"
                    [attr.aria-current]="category === activeCategory() ? 'page' : null"
                    [routerLink]="commands(site)"
                    [queryParams]="{ category }"
                    >{{ category }}</a
                  >
                }
              }
            } @else {
              @if (section.route === activeSection()) {
                @for (entry of section.docs; track entry.name) {
                  <a
                    class="entry child"
                    [class.current]="entry.name === currentSite() && !activeCategory()"
                    [attr.aria-current]="entry.name === currentSite() ? 'page' : null"
                    [routerLink]="commands(entry.name)"
                    >{{ displayName(section.route, entry) }}</a
                  >
                  <!-- The open userflows site's categories, one more child level — the same
                       rail idiom, addressed as ?category= (state within the place, the file-path
                       rule): a click lands on the site's newest content narrowed to the category. -->
                  @if (entry.name === currentSite()) {
                    @for (category of categories(); track category) {
                      <a
                        class="entry child grand"
                        [class.current]="category === activeCategory()"
                        [attr.aria-current]="category === activeCategory() ? 'page' : null"
                        [routerLink]="commands(entry.name)"
                        [queryParams]="{ category }"
                        >{{ category }}</a
                      >
                    }
                  }
                }
              }
            }
          </li>
        }
      </ul>
    } @else {
      <p class="hint">Loading…</p>
    }
  `,
  styles: `
    /* The layout contributes a bare block and no opinions, so every rule this menu needs is here.
       It renders inside a 240px column that already scrolls and pads 8px — hence no padding of its
       own. The link shape is the platform's flat sub-menu family (system-nav, maintenance-nav):
       a transparent left rail that turns indigo on the current entry. */
    :host {
      display: block;
      min-width: 0;
      padding: 4px 0 8px;
    }
    .entries {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    /* Every row here continues the layout's child-rail idiom: the Docs entry above carries the
       rail, so a section is one rail-layer below it, a site one below that, a category one more —
       nesting is the rail plus one indent step per level, and only the color marks the current
       row. */
    .entry {
      display: block;
      margin-left: 10px;
      padding: 4px 10px 4px 12px;
      border-left: 2px solid #e5e7eb;
      border-radius: 0 6px 6px 0;
      font-size: 13px;
      color: #4b5563;
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .entry:hover {
      background: #f3f4f6;
      color: #111827;
    }
    .entry.current {
      border-left-color: #4338ca;
      color: #111827;
      font-weight: 600;
    }
    .entry.child {
      margin-left: 22px;
    }
    .entry.child.current {
      background: #e5e7eb;
    }
    .entry.child.grand {
      margin-left: 34px;
      font-size: 12px;
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
   * under a repository address. Every link this menu writes carries it, so opening a document from
   * a scoped page stays in that scope rather than dropping out of it.
   */
  private readonly prefix = computed(() => scopeCommands(this.scopeSource?.scope()));

  /** The repository the address puts on screen — what narrows this menu to one component's docs. */
  protected readonly scopedRepository = computed(() => this.scopeSource?.scope().repository);

  protected commands(site: string): string[] {
    return readCommands(site, undefined, this.prefix());
  }

  protected sectionCommands(route: string): string[] {
    return [...this.prefix(), route];
  }

  /** Scoped, a section with exactly one site is that site — the link skips the listing page. */
  protected sectionLink(section: NavSection): string[] {
    if (this.scopedRepository() && section.docs.length === 1) {
      return this.commands(section.docs[0].name);
    }
    return this.sectionCommands(section.route);
  }

  /** Special-scope sites drop the scope from display; storybook keeps full names. */
  protected displayName(sectionRoute: string, entry: DocEntry): string {
    return sectionRoute === 'storybook' ? entry.name : entry.shortName;
  }

  protected readonly catalog = toSignal(this.catalogService.catalog());

  /**
   * All three sections always, scoped or not — an empty one is a place to explain what is
   * missing, and hiding it would make the menu's shape depend on what happens to be published.
   */
  protected readonly sections = computed(() =>
    navSections(this.catalog(), this.scopedRepository()),
  );

  /** The userflows section's route — the one section whose scoped children are categories. */
  protected readonly userflowsRoute = DOC_SECTIONS.find(
    (section) => section.kind === 'userflows',
  )?.route;

  /**
   * The URL, as a signal — Angular has no signal-valued `Router.url`, and this menu lives in the
   * shell above every routed component, so it reads NavigationEnd events with the current URL as
   * the seed (a reader landing directly on a deep link gets no event before the first render).
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** The URL's segments inside this app's own grammar — scope path and query/fragment trimmed. */
  private readonly insideSegments = computed(() => {
    const path = this.url().split('#')[0].split('?')[0];
    const base = scopePath(this.scopeSource?.scope());
    const inside = path.startsWith(base) ? path.slice(base.length) : path;
    return inside.split('/').filter(Boolean).map(decodeURIComponent);
  });

  /** The site being read, empty elsewhere — what marks a child row current. */
  protected readonly currentSite = computed(
    () => parseReadPath(this.insideSegments()).site || undefined,
  );

  private readonly readVersion = computed(
    () => parseReadPath(this.insideSegments()).version,
  );

  /**
   * The userflows site whose categories this menu shows: the one being read, or — under a
   * repository scope, where the rows show without a read in progress — the repository's own.
   */
  protected readonly categorySite = computed(() => {
    const read = this.currentSite();
    if (read && kindOf(read) === 'userflows') {
      return read;
    }
    if (!this.scopedRepository()) {
      return undefined;
    }
    // Scoped, the categories stay drawn whatever page is on screen — the repository's own site.
    return this.sections().find((section) => section.route === this.userflowsRoute)?.docs[0]
      ?.name;
  });

  /** The category site's version list — what resolves the bundle whose categories show. */
  private readonly siteVersions = toSignal(
    toObservable(this.categorySite).pipe(
      switchMap((site) => (site ? this.catalogService.versions(site) : of(undefined))),
    ),
  );

  private readonly bundleDetail = toSignal(
    toObservable(
      computed(() => {
        const site = this.categorySite();
        if (!site) {
          return undefined;
        }
        const version =
          (this.currentSite() === site ? this.readVersion() : undefined) ??
          defaultVersion(this.siteVersions()?.versions ?? []);
        return version ? { site, version } : undefined;
      }),
    ).pipe(
      switchMap((at) => (at ? this.catalogService.version(at.site, at.version) : of(undefined))),
    ),
  );

  protected readonly categories = computed(() =>
    categoriesOf(storyPages(this.bundleDetail()?.files ?? [])),
  );

  /**
   * The category in the URL's query, or the bundle's first — mirrors the reader's own default.
   * Only meaningful while READING: on a listing page no category is on screen, so none is current.
   */
  protected readonly activeCategory = computed(() => {
    if (!this.currentSite() || !this.categories().length) {
      return undefined;
    }
    const asked = new URLSearchParams(this.url().split('?')[1] ?? '').get('category');
    return asked && this.categories().includes(asked) ? asked : this.categories()[0];
  });

  /**
   * A section row is current when it is the open one and nothing below it claims the mark — a
   * child site unscoped, a category row scoped.
   */
  protected sectionCurrent(route: string): boolean {
    if (route !== this.activeSection()) {
      return false;
    }
    return this.scopedRepository() ? !this.activeCategory() : !this.currentSite();
  }

  /**
   * Which section is open: the section route in the URL, or — while reading — the read site's own
   * kind, so the tree stays expanded around the document on screen.
   */
  protected readonly activeSection = computed(() => {
    const first = this.insideSegments()[0];
    if (DOC_SECTIONS.some((section) => section.route === first)) {
      return first;
    }
    const site = this.currentSite();
    if (site) {
      const kind = kindOf(site);
      return DOC_SECTIONS.find((section) => section.kind === kind)?.route;
    }
    return undefined;
  });
}
