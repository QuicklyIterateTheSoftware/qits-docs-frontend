import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { QitsPicker, type QitsPickerOption } from '@qits/ui-components';
import { CatalogService } from './catalog';

/**
 * Layer three: one bundle, read.
 *
 * <p><b>Two navigations, side by side, and that is the arrangement rather than an accident.</b> A
 * documentation bundle is a whole application — Storybook ships its own full-height sidebar — so this
 * client cannot put the version picker inside it and must not try. What it owns is a narrow rail on
 * the far left: where you are, and which version you are reading. The bundle keeps everything else.
 *
 * <p>The bundle is an `<iframe>` for the same reason: it brings its own router, its own styles and
 * its own keyboard handling, and hosting it any other way would mean this client inheriting all
 * three. The iframe's `src` is the service's version-addressed directory URL, so the bundle's own
 * relative asset URLs resolve exactly as they do when it is opened directly.
 */
@Component({
  selector: 'qits-docs-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, QitsPicker],
  template: `
    <aside class="rail">
      <nav class="crumbs">
        <a routerLink="/">Documentation</a>
        <a [routerLink]="['/', scopeOf() || '-']">{{ scopeOf() || 'ungrouped' }}</a>
      </nav>
      <h1>{{ shortName() }}</h1>

      <label class="label" for="version">Version</label>
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

      <p class="hint">
        Reading <code>{{ reading() }}</code
        >. Every version is kept at its own address, so a link into these docs never changes meaning.
      </p>
    </aside>

    <iframe class="bundle" [src]="bundleUrl()" [title]="site() + ' documentation'"></iframe>
  `,
  styles: `
    /* Inside QitsMainLayout's content area, which already scrolls and pads — so this fills the
       space it is given rather than claiming the viewport. The negative margins undo that padding:
       a reader is one surface edge to edge, and a 16px gutter around an iframe reads as a mistake. */
    :host {
      display: grid;
      grid-template-columns: 230px 1fr;
      height: 100%;
      margin: -16px;
      min-height: 0;
      color: #111827;
    }
    .rail {
      border-right: 1px solid #e5e7eb;
      background: #f9fafb;
      padding: 16px;
      overflow-y: auto;
      min-width: 0;
    }
    .crumbs {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .crumbs a {
      color: #6b7280;
      text-decoration: none;
    }
    .crumbs a:hover {
      color: #111827;
      text-decoration: underline;
    }
    h1 {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 18px;
      overflow-wrap: anywhere;
    }
    .label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 6px;
    }
    .hint {
      font-size: 12px;
      color: #6b7280;
      margin: 12px 0 0;
      line-height: 1.5;
    }
    code {
      background: #eef2f7;
      padding: 1px 4px;
      border-radius: 4px;
      overflow-wrap: anywhere;
    }
    /* The bundle owns everything to the right of the rail, including its own sidebar. */
    .bundle {
      border: 0;
      width: 100%;
      height: 100%;
      min-width: 0;
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
   * capture it, and a wildcard is what is left. The `/-/` between the name and the version is the
   * SAME separator the service and the store use, reused here so one URL shape means one thing
   * everywhere: `read/@qits/ui-components/-/2026.807.0`, and without the `/-/` part, the newest.
   */
  private readonly url = toSignal(this.route.url, { initialValue: this.route.snapshot.url });

  /**
   * The matched path with its own route prefix removed.
   *
   * <p>`route.url` under `read/**` includes the literal `read` segment. Leaving it in made the site
   * `read/@qits/ui-components`, which 404s — and, worse, made the iframe's src point back at this
   * very page, so the reader rendered itself inside itself until the browser gave up. Stripping it
   * here is what keeps `site` meaning the site.
   */
  private readonly path = computed(() => {
    const segments = this.url().map((segment) => segment.path);
    return (segments[0] === 'read' ? segments.slice(1) : segments).join('/');
  });

  protected readonly site = computed(() => {
    const path = this.path();
    const marker = path.indexOf('/-/');
    return marker < 0 ? path : path.slice(0, marker);
  });

  protected readonly version = computed(() => {
    const path = this.path();
    const marker = path.indexOf('/-/');
    return marker < 0 ? undefined : path.slice(marker + 3);
  });

  private readonly loaded = toSignal(
    // Re-fetched when the site changes; the version list is small and this page is not hot.
    toObservable(this.site).pipe(switchMap((site) => this.catalogService.versions(site))),
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
   * have it say nothing is selected on a page that is displaying something. It resolves to the same
   * value the iframe loads, from the same list, so the two cannot disagree.
   */
  protected readonly selected = computed(
    () => this.version() ?? this.loaded()?.versions[0]?.version,
  );

  /**
   * What the hint says. A URL with no version is reading the newest one, and the reader has not
   * been told which that is — the service resolved it inside the iframe. Naming it "the newest"
   * rather than rendering an empty box is the honest answer to a question this page cannot see.
   */
  protected readonly reading = computed(
    () => this.version() ?? this.loaded()?.versions[0]?.version ?? 'the newest version',
  );

  protected readonly scopeOf = computed(() => {
    const name = this.site();
    const slash = name.startsWith('@') ? name.indexOf('/') : -1;
    return slash > 0 ? name.slice(0, slash) : '';
  });

  protected readonly shortName = computed(() => {
    const name = this.site();
    const slash = name.startsWith('@') ? name.indexOf('/') : -1;
    return slash > 0 ? name.slice(slash + 1) : name;
  });

  /**
   * The bundle's own entry point — always version-addressed, never the bare site URL.
   *
   * <p><b>That is not an optimisation, it is what stops the page loading itself.</b>
   * `/platform-docs/<site>` is the human entry point and redirects HERE, to the reader; an iframe
   * pointed at it would load this page inside this page, which is exactly what happened the first
   * time. So the newest version is resolved from the list this component already has — the same list
   * the picker is built from, so there is no second question and no second answer.
   *
   * <p>Until that list arrives there is no address to load, and {@code about:blank} is the honest
   * placeholder: a frame briefly empty, rather than one pointed somewhere it should not go.
   *
   * <p>The trailing slash is load-bearing. The bundle refers to its assets relatively, so a src
   * without it resolves every one of them a level too high.
   *
   * <p>`bypassSecurityTrustResourceUrl` is required for an iframe src and is safe here: the URL is
   * built from a route this client matched and a version the store named, against a path on its own
   * origin.
   */
  protected readonly bundleUrl = computed(() => {
    const site = this.site();
    const version = this.version() ?? this.loaded()?.versions[0]?.version;
    // The `read/` check is a backstop for the other direction of the same mistake: if a site ever
    // named this client's own route, the frame would nest again.
    if (!site || !version || site.startsWith('read/')) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `/platform-docs/${site}/-/${version}/`,
    );
  });

  protected onVersion(version: string | undefined): void {
    if (!version) {
      return;
    }
    // A full navigation rather than a router hop, so the iframe is rebuilt rather than asked to
    // change document — and so the address bar carries the version, which is the whole point of
    // being able to pick one. The `/-/` is the platform's separator, the same one the service and
    // the store use.
    window.location.assign(`/platform-docs/read/${this.site()}/-/${version}`);
  }
}
