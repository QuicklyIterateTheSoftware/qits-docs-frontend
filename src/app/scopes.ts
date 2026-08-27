import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { QITS_SCOPE, scopeCommands } from '@qits/ui-components';
import { CatalogService } from './catalog';
import { DOC_SECTIONS, kindOf } from './doc-kind';
import { readCommands } from './doc-url';

/**
 * The landing page: a door sign unscoped, and one repository's documentation when a repository is
 * in scope.
 *
 * <p>Unscoped it is deliberately almost nothing. Browsing the catalog is the sidebar's job — it is
 * on screen here and on every other page, so repeating the list would be a second view of one
 * response that can only ever agree or be a bug. What is left is the one message an empty sidebar
 * cannot carry: an empty tree looks the same whether nothing is published or nothing has answered,
 * and only one of those is worth explaining.
 *
 * <p>Under a repository scope it earns a list, because there the question is narrow enough to
 * answer: which of the published sites are <i>this repository's</i>. That is a question the sidebar
 * does not ask.
 */
@Component({
  selector: 'qits-docs-scopes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>Documentation</h1>

    @if (catalog(); as loaded) {
      @if (!loaded.length) {
        <p class="empty">
          Nothing is published yet. A release pipeline declares
          <code>{{ '{' }} type: docs {{ '}' }}</code> and pushes its bundle to qits-artifacts.
        </p>
      } @else if (repository(); as repo) {
        @if (matching().length) {
          <p class="lede">Published by {{ repo }}:</p>
          <ul class="sites">
            @for (entry of matching(); track entry.name) {
              <li>
                <a [routerLink]="commands(entry.name)">{{ entry.name }}</a>
                <span class="meta">{{ entry.latestVersion }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="empty">No docs published for {{ repo }}.</p>
          <p class="lede">Everything published in this environment:</p>
          <ul class="sites">
            @for (entry of catalog(); track entry.name) {
              <li>
                <a [routerLink]="commands(entry.name)">{{ entry.name }}</a>
                <span class="meta">{{ entry.latestVersion }}</span>
              </li>
            }
          </ul>
        }
      } @else {
        <!-- The unscoped landing: the three sections as cards, each an address of its own. The
             per-site browsing stays the sidebar's; what this page owns is the map. -->
        <div class="sections">
          @for (section of sections(); track section.route) {
            <a class="card" [routerLink]="sectionCommands(section.route)">
              <span class="card-title">{{ section.label }}</span>
              <span class="card-description">{{ section.description }}</span>
              <span class="card-count">
                {{ section.count }} site{{ section.count === 1 ? '' : 's' }}
              </span>
            </a>
          }
        </div>
      }
    } @else {
      <p class="empty">Loading…</p>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 24px;
      max-width: 760px;
      margin: 0 auto;
      color: #111827;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 16px;
    }
    .lede,
    .empty {
      color: #6b7280;
      font-size: 14px;
    }
    .sites {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
    }
    .sites li {
      display: flex;
      gap: 8px;
      align-items: baseline;
      padding: 4px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .sites a {
      color: #111827;
      text-decoration: none;
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .sites a:hover {
      text-decoration: underline;
    }
    .meta {
      color: #6b7280;
      font-size: 12px;
    }
    code {
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 4px;
    }
    .sections {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 8px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
    }
    .card:hover {
      border-color: #c7d2fe;
      background: #f8faff;
    }
    .card-title {
      font-weight: 600;
      font-size: 15px;
      color: #111827;
    }
    .card-description {
      font-size: 13px;
      color: #6b7280;
      flex: 1;
    }
    .card-count {
      font-size: 12px;
      color: #6b7280;
    }
  `,
})
export class Scopes {
  private readonly catalogService = inject(CatalogService);
  private readonly scopeSource = inject(QITS_SCOPE, { optional: true });

  /**
   * Undefined until the first response, which is what the template's `@else` renders as "Loading…".
   * No initial value is given on purpose: an empty catalog and an unanswered one look identical if
   * both start as `[]`, and only one of them should say "nothing is published yet".
   *
   * Flattened out of its scopes, because what this page groups by is the repository rather than the
   * npm scope — that grouping is the sidebar's, and it is on screen beside this.
   */
  private readonly loaded = toSignal(this.catalogService.catalog());

  protected readonly catalog = computed(() => this.loaded()?.scopes.flatMap((group) => group.docs));

  protected readonly repository = computed(() => this.scopeSource?.scope().repository);

  /**
   * The sites this repository published.
   *
   * <p>Matched on the short name — the part after the npm scope — against the repository name, in
   * both directions of containment. A repository called `qits-spa-ui-components` publishes
   * `@qits/ui-components`, and one called `qits-cli` publishes `qits-cli-bootstrap`; neither is an
   * equality, and no field on either side records the link. So this is a heuristic, said out loud:
   * when it finds nothing the page shows the whole catalog rather than an empty screen, because a
   * missing match is far more likely than a repository that published nothing.
   */
  protected readonly matching = computed(() => {
    const repo = this.repository();
    const entries = this.catalog() ?? [];
    if (!repo) return [];
    return entries.filter((entry) => {
      const short = entry.shortName;
      return short === repo || repo.endsWith(short) || repo.startsWith(short);
    });
  });

  protected commands(site: string): string[] {
    return readCommands(site, undefined, scopeCommands(this.scopeSource?.scope()));
  }

  /** The three section cards, each with how many sites it currently holds. */
  protected readonly sections = computed(() =>
    DOC_SECTIONS.map((section) => ({
      ...section,
      count: (this.catalog() ?? []).filter((entry) => kindOf(entry.name) === section.kind).length,
    })),
  );

  protected sectionCommands(route: string): string[] {
    return [...scopeCommands(this.scopeSource?.scope()), route];
  }
}
