import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, of, switchMap } from 'rxjs';
import { QitsPicker, type QitsPickerOption } from '@qits/ui-components';
import { CatalogService } from './catalog';
import { parseReadPath, readCommands } from './doc-url';

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
    @if (catalog(); as loaded) {
      @for (group of loaded.scopes; track group.scope) {
        <p class="scope">{{ group.scope || 'ungrouped' }}</p>
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
    .scope {
      margin: 10px 0 2px;
      padding: 0 10px;
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

  /** Bound in the template; `readCommands` is a function, and a template can only reach a member. */
  protected readonly commands = readCommands;

  protected readonly catalog = toSignal(this.catalogService.catalog());

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
    const path = this.url().split('#')[0].split('?')[0];
    return parseReadPath(path.split('/').filter(Boolean).map(decodeURIComponent));
  });

  /** Empty on the landing page, which is how the template knows to nest the picker nowhere. */
  protected readonly site = computed(() => this.read().site);
  private readonly version = computed(() => this.read().version);

  private readonly loaded = toSignal(
    toObservable(this.site).pipe(
      switchMap((site) => (site ? this.catalogService.versions(site) : of(undefined))),
    ),
  );

  protected readonly options = computed<QitsPickerOption<string>[]>(
    () =>
      this.loaded()?.versions.map((v) => ({
        value: v.version,
        // The newest is worth marking, because "latest" is what a link without a version resolves
        // to and a reader arriving that way should be able to see that is where they are.
        label: v === this.loaded()?.versions[0] ? `${v.version}  (latest)` : v.version,
      })) ?? [],
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
    void this.router.navigate(readCommands(site, version));
  }
}
