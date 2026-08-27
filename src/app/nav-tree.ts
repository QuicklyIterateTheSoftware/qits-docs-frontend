import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { QITS_SCOPE, scopeCommands, scopePath } from '@qits/ui-components';
import { CatalogService, type Catalog, type DocEntry } from './catalog';
import { APIDOCS_SCOPE, DOC_SECTIONS, USERFLOWS_SCOPE, kindOf } from './doc-kind';
import { parseReadPath, readCommands } from './doc-url';

/** One sub-navigation entry: a section, with its sites (shown when the section is the open one). */
export interface NavSection {
  readonly label: string;
  readonly route: string;
  readonly docs: readonly DocEntry[];
}

/**
 * The catalog folded into the three sub-navigation entries. Sites keep the catalog's order; the
 * two special scopes' sites drop their scope prefix from display (repeating `@userflows` under an
 * entry that says Userflows would be saying it twice), and storybook keeps full names since its
 * scopes vary.
 */
export function navSections(catalog: Catalog | undefined): NavSection[] {
  const scopes = catalog?.scopes ?? [];
  return DOC_SECTIONS.map((section) => ({
    label: section.label,
    route: section.route,
    docs:
      section.kind === 'storybook'
        ? scopes
            .filter((group) => group.scope !== APIDOCS_SCOPE && group.scope !== USERFLOWS_SCOPE)
            .flatMap((group) => group.docs)
        : (scopes.find(
            (group) =>
              group.scope === (section.kind === 'apidocs' ? APIDOCS_SCOPE : USERFLOWS_SCOPE),
          )?.docs ?? []),
  }));
}

/**
 * The docs sub-menu under this application's entry in the platform navigation: the three section
 * entries, and — only under the OPEN section — its sites as child rows. That is the platform
 * sidebar's own shape one level down: `repositoryRows()` shows a repository's detail entries only
 * for the repository in scope, and a child row is the same 2px-rail indent idiom.
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
              [class.current]="section.route === activeSection() && !currentSite()"
              [attr.aria-current]="
                section.route === activeSection() && !currentSite() ? 'page' : null
              "
              [routerLink]="sectionCommands(section.route)"
              >{{ section.label }}</a
            >
            @if (section.route === activeSection()) {
              @for (entry of section.docs; track entry.name) {
                <a
                  class="entry child"
                  [class.current]="entry.name === currentSite()"
                  [attr.aria-current]="entry.name === currentSite() ? 'page' : null"
                  [routerLink]="commands(entry.name)"
                  >{{ displayName(section.route, entry) }}</a
                >
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
    .entry {
      display: block;
      padding: 4px 10px;
      border-left: 2px solid transparent;
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
    /* The child idiom the layout itself uses for a row belonging to the one above it. */
    .entry.child {
      margin-left: 10px;
      padding-left: 12px;
      border-left: 2px solid #e5e7eb;
      border-radius: 0 6px 6px 0;
    }
    .entry.child.current {
      border-left-color: #4338ca;
      background: #e5e7eb;
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

  protected commands(site: string): string[] {
    return readCommands(site, undefined, this.prefix());
  }

  protected sectionCommands(route: string): string[] {
    return [...this.prefix(), route];
  }

  /** Special-scope sites drop the scope from display; storybook keeps full names. */
  protected displayName(sectionRoute: string, entry: DocEntry): string {
    return sectionRoute === 'storybook' ? entry.name : entry.shortName;
  }

  protected readonly catalog = toSignal(this.catalogService.catalog());

  protected readonly sections = computed(() => navSections(this.catalog()));

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
