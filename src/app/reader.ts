import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { QITS_SCOPE, scopeCommands } from '@qits/ui-components';
import { CatalogService, type DocVersion } from './catalog';
import { branchOf, distinctBranches, kindOf } from './doc-kind';
import { parseReadPath, readCommands } from './doc-url';
import { MarkdownBundle } from './markdown-bundle';
import { SwaggerBundle } from './swagger-bundle';

/** A version's display label: a sha is shortened, anything else (calver) reads as itself. */
export function versionLabel(version: string): string {
  return /^[0-9a-f]{40}$/.test(version) ? version.slice(0, 12) : version;
}

/**
 * The versions a branch pick narrows to, newest first — unbranched versions show under every
 * branch (they predate metadata and hiding them would make old bundles unreachable).
 */
export function versionsOnBranch(
  versions: readonly DocVersion[],
  branch: string | undefined,
): DocVersion[] {
  if (!branch) {
    return [...versions];
  }
  return versions.filter((v) => (branchOf(v) ?? branch) === branch);
}

/**
 * The default version of a list: the newest of `main` when anything carries that branch, else the
 * newest overall — "a link without a version opens the latest main".
 */
export function defaultVersion(versions: readonly DocVersion[]): string | undefined {
  return (
    versions.find((v) => branchOf(v) === 'main')?.version ?? versions[0]?.version
  );
}

/**
 * One bundle, read.
 *
 * <p>The page owns its controls, the code pages' pattern: the header carries the branch and
 * version selects (native {@code <select>}s — the platform's on-page selector, deliberately not
 * {@code qits-picker}, whose open-when-empty list is right for a sidebar and wrong above content),
 * and a pick NAVIGATES — the version is a place, so it goes in the path and the sidebar never
 * holds a picker. A URL without a version reads the newest of {@code main}.
 *
 * <p>Three kinds, three bodies — see doc-kind.ts: Storybook stays a whole-application
 * {@code <iframe>}; userflows render their markdown in place; apidocs hand their OpenAPI document
 * to swagger-ui.
 */
@Component({
  selector: 'qits-docs-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownBundle, SwaggerBundle],
  template: `
    <header class="head">
      <h1>{{ site() }}</h1>
      @if (versions().length) {
        <div class="rev-actions">
          @if (kind() === 'userflows' && branches().length) {
            <label class="rev">
              <span class="rev-label">Branch</span>
              <select (change)="onBranchPicked($event)">
                @for (branch of branches(); track branch) {
                  <option [value]="branch" [selected]="branch === effectiveBranch()">
                    {{ branch }}
                  </option>
                }
              </select>
            </label>
          }
          <label class="rev">
            <span class="rev-label">Version</span>
            <select (change)="onVersionPicked($event)">
              @for (option of versionOptions(); track option.version) {
                <option [value]="option.version" [selected]="option.version === bundleVersion()">
                  {{ option.label }}
                </option>
              }
            </select>
          </label>
        </div>
      }
    </header>

    <div class="body">
      @switch (kind()) {
        @case ('userflows') {
          @if (bundleVersion(); as version) {
            <docs-markdown-bundle [site]="site()" [version]="version" />
          }
        }
        @case ('apidocs') {
          @if (bundleVersion(); as version) {
            <docs-swagger-bundle [site]="site()" [version]="version" />
          }
        }
        @default {
          <!-- A plain src-bound frame; see the git history for why it is not keyed per version
               (both re-point and re-create push a session history entry — measured). No backticks
               in this comment: the template is a backtick literal. -->
          <iframe class="bundle" [src]="bundleUrl()" [title]="site() + ' documentation'"></iframe>
        }
      }
    </div>
  `,
  styles: `
    /* Inside QitsMainLayout's content area, which already scrolls and pads — the negative margin
       undoes that padding so the bundle body runs edge to edge; the header carries its own. The
       header/selector shapes are the code pages' (.head/.rev-actions/.rev), the platform's on-page
       control row. */
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      margin: -16px;
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      padding: 12px 16px 10px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
    }
    .head h1 {
      margin: 0;
      font-size: 1.1rem;
      overflow-wrap: anywhere;
    }
    .rev-actions {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
    }
    .rev {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      align-items: flex-end;
    }
    .rev-label {
      color: #6b7280;
      font-size: 0.75rem;
    }
    .rev select {
      padding: 0.3rem 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.35rem;
      background: #fff;
      color: #111827;
      font: inherit;
      font-size: 0.85rem;
      max-width: 16rem;
    }
    .body {
      flex: 1;
      min-height: 0;
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
  private readonly router = inject(Router);
  private readonly scopeSource = inject(QITS_SCOPE, { optional: true });

  /**
   * The site and the version, read off the URL rather than bound as route parameters — a site
   * name spans segments, so no fixed `:param` route can capture it. `parseReadPath` owns the
   * grammar, including this route's own literal `read` segment.
   */
  private readonly url = toSignal(this.route.url, { initialValue: this.route.snapshot.url });

  private readonly read = computed(() =>
    parseReadPath(this.url().map((segment) => segment.path)),
  );

  protected readonly site = computed(() => this.read().site);
  private readonly urlVersion = computed(() => this.read().version);

  protected readonly kind = computed(() => kindOf(this.site()));

  private readonly loaded = toSignal(
    toObservable(this.site).pipe(switchMap((site) => this.catalogService.versions(site))),
  );

  protected readonly versions = computed<readonly DocVersion[]>(
    () => this.loaded()?.versions ?? [],
  );

  /**
   * The version being read: the URL's, or the newest of `main`, or the newest. Resolved in place
   * rather than by redirect — the URL without a version keeps meaning "the latest", which is what
   * a handed-around link should keep meaning.
   */
  protected readonly bundleVersion = computed(
    () => this.urlVersion() ?? defaultVersion(this.versions()),
  );

  protected readonly branches = computed(() => distinctBranches(this.versions()));

  /** The read version's own branch — what the branch select shows as chosen. */
  protected readonly effectiveBranch = computed(() => {
    const version = this.versions().find((v) => v.version === this.bundleVersion());
    return (version && branchOf(version)) ?? this.branches()[0];
  });

  /**
   * The version select's options: the current branch's versions (userflows) or all of them, with
   * the on-screen version prepended when the narrowing lost it — the platform's rule that a
   * selector never silently misreports what is on screen.
   */
  protected readonly versionOptions = computed(() => {
    const narrowed =
      this.kind() === 'userflows'
        ? versionsOnBranch(this.versions(), this.effectiveBranch())
        : [...this.versions()];
    const current = this.bundleVersion();
    if (current && !narrowed.some((v) => v.version === current)) {
      narrowed.unshift(
        this.versions().find((v) => v.version === current) ?? {
          version: current,
          fileCount: 0,
          totalBytes: 0,
          publishedAt: '',
        },
      );
    }
    return narrowed.map((v) => ({ version: v.version, label: versionLabel(v.version) }));
  });

  /** A pick in either select navigates: the version is a place, so it goes in the path. */
  protected onVersionPicked(event: Event): void {
    this.toVersion((event.target as HTMLSelectElement).value);
  }

  protected onBranchPicked(event: Event): void {
    const branch = (event.target as HTMLSelectElement).value;
    const newest = versionsOnBranch(this.versions(), branch)[0];
    if (newest) {
      this.toVersion(newest.version);
    }
  }

  private toVersion(version: string): void {
    const site = this.site();
    if (site && version) {
      void this.router.navigate(
        readCommands(site, version, scopeCommands(this.scopeSource?.scope())),
      );
    }
  }

  /**
   * The frame's entry point as a STRING — always version-addressed, never the bare site URL,
   * which redirects HERE (an iframe pointed at it would load this page inside this page — it
   * happened). The trailing slash is load-bearing: the bundle's relative assets resolve under it.
   */
  protected readonly bundleHref = computed(() => {
    const site = this.site();
    const version = this.bundleVersion();
    if (!site || !version || site.startsWith('read/')) {
      return 'about:blank';
    }
    return `/docs/${site}/-/${version}/`;
  });

  /**
   * The same address, trusted — computed SEPARATELY so the wrapper (a fresh object every call)
   * only reruns when the string changes; setting `src` reloads the frame.
   */
  protected readonly bundleUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.bundleHref()),
  );
}
