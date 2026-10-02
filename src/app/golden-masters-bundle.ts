import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { CatalogService } from './catalog';

/** One operation's frozen fields — the parts a recording pins so a replay can still match it. */
export interface GoldenMasterFrozen {
  readonly ids?: readonly string[];
  readonly instants?: readonly string[];
  readonly listFilteredTo?: string | null;
  // Tolerate whatever else the recorder adds — this renders the fields it knows and ignores
  // the rest, rather than failing closed on an index it does not fully understand.
  readonly [key: string]: unknown;
}

/** One recorded call against a state. */
export interface GoldenMasterOperation {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  /** Relative to `golden-masters/` — the only thing that says where the recorded JSON lives. */
  readonly file: string;
  readonly frozen?: GoldenMasterFrozen;
}

/** A state this provider's recording depends on being set up first. */
export interface GoldenMasterDependency {
  readonly provider: string;
  readonly state: string;
}

/** One provider state and every operation recorded against it. */
export interface GoldenMasterState {
  readonly name: string;
  readonly slug: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly dependsOn?: readonly GoldenMasterDependency[];
  readonly operations: readonly GoldenMasterOperation[];
}

/** `golden-masters/index.json`, as a provider's pact run publishes it. */
export interface GoldenMastersIndex {
  readonly formatVersion: number;
  readonly provider: string;
  readonly states: readonly GoldenMasterState[];
}

/** The only format this renderer reads; anything else falls back to the plain file list. */
export const GOLDEN_MASTERS_FORMAT_VERSION = 1;

/** One package `contract-docs` published alongside the bundle at this version. */
export interface ContractsPackage {
  readonly ecosystem: 'maven' | 'npm';
  readonly coordinate: string;
  readonly version: string;
  readonly published: boolean;
}

/**
 * `contracts.json`, at the bundle's root — the "how to depend on this" manifest `contract-docs`
 * writes beside `golden-masters/index.json`. Fetched separately from the index, and read
 * independently of it: a bundle can carry one, the other, both or neither.
 */
export interface ContractsManifest {
  readonly formatVersion: number;
  readonly application: string;
  readonly version: string;
  readonly packages: readonly ContractsPackage[];
}

/** The only format this renderer reads; any other value (or a missing file) renders nothing. */
export const CONTRACTS_MANIFEST_FORMAT_VERSION = 1;

/** `<dependency>groupId:artifactId</dependency>`, split at the first `:` — never the last. */
export function splitMavenCoordinate(coordinate: string): { groupId: string; artifactId: string } {
  const at = coordinate.indexOf(':');
  return at === -1
    ? { groupId: coordinate, artifactId: '' }
    : { groupId: coordinate.slice(0, at), artifactId: coordinate.slice(at + 1) };
}

/** The copyable block for one declared package — a maven `<dependency>` or an npm install line. */
export function dependencySnippet(pkg: ContractsPackage): string {
  if (pkg.ecosystem === 'npm') {
    return `npm install --save-dev ${pkg.coordinate}@${pkg.version}`;
  }
  const { groupId, artifactId } = splitMavenCoordinate(pkg.coordinate);
  return (
    `<dependency>\n` +
    `  <groupId>${groupId}</groupId>\n` +
    `  <artifactId>${artifactId}</artifactId>\n` +
    `  <version>${pkg.version}</version>\n` +
    `  <scope>test</scope>\n` +
    `</dependency>`
  );
}

/**
 * Frozen fields, read compactly: which paths were pinned as ids or instants, and how a list was
 * matched — "" when a recording carries none, which the template treats as nothing to show.
 */
export function frozenSummary(frozen: GoldenMasterFrozen | undefined): string {
  if (!frozen) {
    return '';
  }
  const parts: string[] = [];
  if (frozen.ids?.length) {
    parts.push(`frozen ids: ${frozen.ids.join(', ')}`);
  }
  if (frozen.instants?.length) {
    parts.push(`frozen instants: ${frozen.instants.join(', ')}`);
  }
  if (frozen.listFilteredTo) {
    parts.push(`matched as contains: ${frozen.listFilteredTo}`);
  }
  return parts.join(' · ');
}

/** A state's declared dependencies, read compactly — "" when there are none. */
export function dependsOnSummary(dependsOn: readonly GoldenMasterDependency[] | undefined): string {
  if (!dependsOn?.length) {
    return '';
  }
  return dependsOn.map((dep) => `${dep.provider}: ${dep.state}`).join(', ');
}

/** The recorded JSON, pretty-printed — the raw text stands in when it does not parse. */
export function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** One operation's recorded-content fetch, as the template reads it. */
interface RecordedContent {
  readonly status: 'loading' | 'done' | 'error';
  readonly text?: string;
}

/**
 * A `@contracts` bundle, read straight off its index: `golden-masters/index.json` names every
 * recorded provider state and, per state, the operations run against it — this component never
 * infers anything from a file's path, because `index.json` is the one place that says what a file
 * MEANS. Everything else (status, frozen fields, the recorded JSON itself) is read through the
 * `file` field the index gives each operation.
 *
 * <p>Two failure shapes get the same fallback — a notice plus the bundle's own file list, read off
 * `CatalogService.version` the way every other renderer does — rather than a blank page: the index
 * missing entirely (an older or malformed publish), and an index present but carrying a
 * `formatVersion` this renderer does not understand. A silent blank page would read as "nothing
 * recorded" when the truth is "this renderer could not read what is there".
 *
 * <p>A recorded file's own JSON is fetched lazily, on first expand of its `<details>` — a state can
 * carry many operations, and a reader who came to look at one of them should not pay for the rest.
 *
 * <p>A second, independent file sits beside the index: `contracts.json`, the manifest
 * `contract-docs` writes naming which maven and npm packages this version of the application
 * declared, and whether each actually published at this version or is sitting unchanged on an
 * older one. Fetched right after the index — in the same request chain, so the two never race —
 * but read on its own terms: a bundle published before this epic, or one whose manifest this
 * reader does not recognise, simply renders no "how to depend on this" section, exactly as a
 * bundle with no manifest at all. The states below render exactly as they always have either way.
 */
@Component({
  selector: 'docs-golden-masters-bundle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (contracts(); as manifest) {
      <section class="contracts">
        <h2>How to depend on this</h2>
        @for (pkg of manifest.packages; track pkg.coordinate) {
          <div class="dependency">
            <div class="dependency-head">
              <span class="ecosystem">{{ pkg.ecosystem }}</span>
              @if (!pkg.published) {
                <span class="unchanged">unchanged since {{ pkg.version }}</span>
              }
            </div>
            <pre class="snippet">{{ dependencySnippet(pkg) }}</pre>
            <button type="button" class="copy" (click)="copySnippet(pkg)">
              {{ copiedCoordinate() === pkg.coordinate ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        }
      </section>
    }
    @if (indexError()) {
      <p class="hint">No golden-masters index found for this bundle.</p>
      <ul class="files">
        @for (file of files(); track file) {
          <li>{{ file }}</li>
        }
      </ul>
    } @else if (index(); as idx) {
      @if (idx.formatVersion !== supportedFormatVersion) {
        <p class="hint">
          This bundle's golden-masters index is format version {{ idx.formatVersion }}, which this
          reader does not understand.
        </p>
        <ul class="files">
          @for (file of files(); track file) {
            <li>{{ file }}</li>
          }
        </ul>
      } @else {
        <p class="provider">Provider: <strong>{{ idx.provider }}</strong></p>
        @for (state of idx.states; track state.slug) {
          <section class="state">
            <h2>{{ state.name }}</h2>
            @if (entriesOf(state.params); as params) {
              @if (params.length) {
                <dl class="params">
                  @for (entry of params; track entry[0]) {
                    <dt>{{ entry[0] }}</dt>
                    <dd>{{ entry[1] }}</dd>
                  }
                </dl>
              }
            }
            @if (dependsOnSummary(state.dependsOn); as deps) {
              @if (deps) {
                <p class="depends">Depends on: {{ deps }}</p>
              }
            }
            @for (op of state.operations; track op.operationId) {
              <details class="operation" (toggle)="onToggle($event, op.file)">
                <summary>
                  <span class="method">{{ op.method }}</span>
                  <span class="path">{{ op.path }}</span>
                  <span class="status">{{ op.status }}</span>
                </summary>
                @if (frozenSummary(op.frozen); as frozen) {
                  @if (frozen) {
                    <p class="frozen">{{ frozen }}</p>
                  }
                }
                @if (contentFor(op.file); as content) {
                  @if (content.status === 'loading') {
                    <p class="hint">Loading…</p>
                  } @else if (content.status === 'error') {
                    <p class="hint">This recording could not be loaded.</p>
                  } @else {
                    <pre class="recorded">{{ content.text }}</pre>
                  }
                }
              </details>
            } @empty {
              <p class="hint">No operations recorded for this state.</p>
            }
          </section>
        } @empty {
          <p class="hint">This bundle recorded no states.</p>
        }
      }
    } @else {
      <p class="hint">Loading…</p>
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
      background: #fff;
      padding: 8px 24px 48px;
    }
    .provider {
      color: #6b7280;
      font-size: 13px;
    }
    .state {
      max-width: 900px;
      margin: 0 auto 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .state h2 {
      font-size: 16px;
      margin: 0 0 6px;
    }
    .params {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 2px 10px;
      margin: 0 0 8px;
      font-size: 13px;
    }
    .params dt {
      color: #6b7280;
    }
    .params dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .depends {
      font-size: 13px;
      color: #6b7280;
      margin: 0 0 8px;
    }
    .operation {
      margin: 6px 0;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 6px 10px;
    }
    .operation summary {
      cursor: pointer;
      display: flex;
      gap: 8px;
      align-items: baseline;
      font-size: 13px;
    }
    .method {
      font-weight: 600;
      color: #4338ca;
    }
    .path {
      overflow-wrap: anywhere;
    }
    .status {
      margin-left: auto;
      color: #6b7280;
    }
    .frozen {
      margin: 6px 0 0;
      font-size: 12px;
      color: #6b7280;
    }
    .recorded {
      margin: 6px 0 0;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
      overflow-x: auto;
      font-size: 12px;
    }
    .files {
      margin: 8px 0 0;
      padding-left: 20px;
      font-size: 13px;
      color: #4b5563;
    }
    .hint {
      margin: 24px;
      color: #6b7280;
    }
    .contracts {
      max-width: 900px;
      margin: 0 auto 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .contracts h2 {
      font-size: 16px;
      margin: 0 0 6px;
    }
    .dependency {
      margin: 6px 0;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
    }
    .dependency-head {
      display: flex;
      gap: 8px;
      align-items: baseline;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .ecosystem {
      font-weight: 600;
      color: #4338ca;
    }
    .unchanged {
      color: #6b7280;
    }
    .snippet {
      margin: 0 0 6px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
      overflow-x: auto;
      font-size: 12px;
    }
    .copy {
      font-size: 12px;
      padding: 4px 10px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
    }
  `,
})
export class GoldenMastersBundle {
  private readonly http = inject(HttpClient);
  private readonly catalogService = inject(CatalogService);

  readonly site = input.required<string>();
  readonly version = input.required<string>();

  protected readonly supportedFormatVersion = GOLDEN_MASTERS_FORMAT_VERSION;

  private readonly at = computed(() => ({ site: this.site(), version: this.version() }));

  /** The bundle's whole file list — read only to back the fallback notice's listing. */
  private readonly detail = toSignal(
    toObservable(this.at).pipe(switchMap(({ site, version }) => this.catalogService.version(site, version))),
  );

  protected readonly files = computed(() => this.detail()?.files ?? []);

  private readonly bundleResult = toSignal(
    toObservable(this.at).pipe(
      switchMap(({ site, version }) =>
        this.http.get<GoldenMastersIndex>(`/docs/${site}/-/${version}/golden-masters/index.json`).pipe(
          map((index) => ({ index, error: false }) as const),
          catchError(() => of({ index: undefined, error: true } as const)),
          // The manifest is fetched right after the index settles, success or not — the two files
          // are unrelated, so one's absence must never block the other's request from going out.
          switchMap((indexOutcome) =>
            this.http.get<ContractsManifest>(`/docs/${site}/-/${version}/contracts.json`).pipe(
              map((manifest) => ({ ...indexOutcome, manifest }) as const),
              catchError(() => of({ ...indexOutcome, manifest: undefined } as const)),
            ),
          ),
        ),
      ),
    ),
  );

  protected readonly index = computed(() => this.bundleResult()?.index);
  protected readonly indexError = computed(() => this.bundleResult()?.error ?? false);

  /** `undefined` for a missing `contracts.json` or one this reader's formatVersion rejects. */
  protected readonly contracts = computed(() => {
    const manifest = this.bundleResult()?.manifest;
    return manifest?.formatVersion === CONTRACTS_MANIFEST_FORMAT_VERSION ? manifest : undefined;
  });

  protected readonly dependencySnippet = dependencySnippet;

  protected readonly copiedCoordinate = signal<string | null>(null);
  private copiedTimeout: ReturnType<typeof setTimeout> | null = null;

  protected async copySnippet(pkg: ContractsPackage): Promise<void> {
    await navigator.clipboard.writeText(dependencySnippet(pkg));
    this.copiedCoordinate.set(pkg.coordinate);
    if (this.copiedTimeout !== null) {
      clearTimeout(this.copiedTimeout);
    }
    this.copiedTimeout = setTimeout(() => this.copiedCoordinate.set(null), 2000);
  }

  protected readonly contents = signal<Record<string, RecordedContent>>({});

  protected contentFor(file: string): RecordedContent | undefined {
    return this.contents()[file];
  }

  protected entriesOf(params: Readonly<Record<string, unknown>> | undefined): [string, unknown][] {
    return Object.entries(params ?? {});
  }

  protected readonly frozenSummary = frozenSummary;
  protected readonly dependsOnSummary = dependsOnSummary;

  /** A first expand fetches the recorded file; collapsing and re-expanding reuses what is cached. */
  protected onToggle(event: Event, file: string): void {
    const opened = (event.target as HTMLDetailsElement).open;
    if (!opened || this.contents()[file]) {
      return;
    }
    this.contents.update((current) => ({ ...current, [file]: { status: 'loading' } }));
    const { site, version } = this.at();
    this.http
      .get(`/docs/${site}/-/${version}/golden-masters/${file}`, { responseType: 'text' })
      .subscribe({
        next: (raw) => {
          this.contents.update((current) => ({
            ...current,
            [file]: { status: 'done', text: prettyJson(raw) },
          }));
        },
        error: () => {
          this.contents.update((current) => ({ ...current, [file]: { status: 'error' } }));
        },
      });
  }
}
