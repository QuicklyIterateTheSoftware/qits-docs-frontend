import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { CatalogService } from './catalog';
import { parseReadPath } from './doc-url';

/**
 * One bundle, read — and nothing else on the page.
 *
 * <p>This component used to own a navigation rail of its own beside the frame. It does not any
 * more: where you are and which version you are reading live in the platform sidebar's sub-menu
 * (see nav-tree.ts), because a rail here made three navigation columns on one page. What is left is
 * the frame, edge to edge.
 *
 * <p>The bundle is an `<iframe>` because it is a whole application: it brings its own router, its
 * own styles, its own keyboard handling and — in Storybook's case — its own full-height sidebar,
 * and hosting it any other way would mean this client inheriting all of them. The `src` is the
 * service's version-addressed directory URL, so the bundle's own relative asset URLs resolve
 * exactly as they do when it is opened directly.
 */
@Component({
  selector: 'qits-docs-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- A plain src-bound frame, and it was briefly wrapped in a keyed loop to force a NEW element
         per version on the theory that re-pointing an existing frame pushes a joint session history
         entry while creating a fresh one does not. MEASURED IN CHROME: both push. Opening a
         document takes history.length from 2 to 4, switching version from 4 to 6 — one entry for
         the router hop, one for the frame's load, either way. So the loop bought nothing and is
         gone; what it claimed to prevent is a trait of hosting a whole application in a frame.
         Reading a document costs two Back presses to leave, and that is not this binding's to fix.
         (No backticks in this comment: the template is a backtick literal, and one here terminates
         it — NG1010, from a decorator that then has the wrong number of arguments.) -->
    <iframe class="bundle" [src]="bundleUrl()" [title]="site() + ' documentation'"></iframe>
  `,
  styles: `
    /* Inside QitsMainLayout's content area, which already scrolls and pads — so this fills the
       space it is given rather than claiming the viewport. The negative margin undoes that padding:
       a reader is one surface edge to edge, and a 16px gutter around a documentation bundle reads
       as a mistake. */
    :host {
      display: block;
      height: 100%;
      min-height: 0;
      margin: -16px;
    }
    .bundle {
      display: block;
      border: 0;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Reader {
  private readonly catalogService = inject(CatalogService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);

  /**
   * The site and the version, read off the URL rather than bound as route parameters.
   *
   * <p>A site name spans segments — `@qits/ui-components` is two — so no fixed `:param` route can
   * capture it, and a wildcard is what is left. `parseReadPath` owns the rest of the grammar,
   * including stripping this route's own literal `read` segment; see doc-url.ts for why that one
   * matters.
   */
  private readonly url = toSignal(this.route.url, { initialValue: this.route.snapshot.url });

  private readonly read = computed(() =>
    parseReadPath(this.url().map((segment) => segment.path)),
  );

  protected readonly site = computed(() => this.read().site);
  private readonly version = computed(() => this.read().version);

  /**
   * The version list, still fetched here even though the sidebar picker is built from it too.
   *
   * <p>It is what resolves "no version in the URL" to a concrete directory URL, and there is no
   * second request: `CatalogService` caches per site, so this and the picker read one answer.
   */
  private readonly loaded = toSignal(
    toObservable(this.site).pipe(switchMap((site) => this.catalogService.versions(site))),
  );

  /**
   * The bundle's own entry point as a STRING — always version-addressed, never the bare site URL.
   *
   * <p><b>That is not an optimisation, it is what stops the page loading itself.</b>
   * `/docs/<site>` is the human entry point and redirects HERE, to the reader; an iframe
   * pointed at it would load this page inside this page, which is exactly what happened the first
   * time. So the newest version is resolved from the list this component already has.
   *
   * <p>Until that list arrives there is no address to load, and {@code about:blank} is the honest
   * placeholder: a frame briefly empty, rather than one pointed somewhere it should not go.
   *
   * <p>The trailing slash is load-bearing. The bundle refers to its assets relatively, so a src
   * without it resolves every one of them a level too high.
   */
  protected readonly bundleHref = computed(() => {
    const site = this.site();
    const version = this.version() ?? this.loaded()?.versions[0]?.version;
    // The `read/` check is a backstop for the other direction of the same mistake: if a site ever
    // named this client's own route, the frame would nest again.
    if (!site || !version || site.startsWith('read/')) {
      return 'about:blank';
    }
    return `/docs/${site}/-/${version}/`;
  });

  /**
   * The same address, trusted — and computed SEPARATELY from the string on purpose.
   *
   * <p>`bypassSecurityTrustResourceUrl` returns a new object every call, so a computed that both
   * built the URL and wrapped it would hand `[src]` a fresh, unequal value on any recomputation,
   * however unchanged the address. Setting `src` reloads the frame, so that is a document thrown
   * away and re-fetched for nothing. Splitting them means the wrapper only runs when the string
   * actually changes.
   *
   * <p>The bypass is safe here: the URL is built from a route this client matched and a version the
   * store named, against a path on its own origin.
   */
  protected readonly bundleUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.bundleHref()),
  );
}
