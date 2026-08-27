import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { QITS_SCOPE, scopeCommands } from '@qits/ui-components';
import { CatalogService, type DocEntry } from './catalog';
import { DOC_SECTIONS, kindOf, siteBelongsToRepository, type DocKind } from './doc-kind';
import { readCommands } from './doc-url';

/**
 * One documentation kind's page — what `/storybook`, `/apidocs` and `/userflows` render: the
 * section's description and every site of that kind, each a link into the reader. The kind
 * arrives as route data, read off the route directly — `withComponentInputBinding` is deliberately
 * off in this app (see app.config.ts) — so the three routes share one component.
 *
 * <p>This deliberately duplicates a slice of what the sidebar tree shows — the exception to the
 * "the sidebar is the catalog" rule that retired the old scope page — because a section is now an
 * <b>address</b>: something the landing page links to, a URL a person can hand someone ("the
 * userflows are under /userflows"), and a page that can say "nothing here yet" with room to
 * explain how something gets here.
 */
@Component({
  selector: 'qits-docs-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>{{ section().label }}</h1>
    <p class="lede">{{ section().description }}</p>

    @if (catalog()) {
      @if (entries().length) {
        <ul class="sites">
          @for (entry of entries(); track entry.name) {
            <li>
              <a [routerLink]="commands(entry.name)">{{ entry.name }}</a>
              <span class="meta">
                {{ entry.latestVersion }} · {{ entry.versionCount }}
                version{{ entry.versionCount === 1 ? '' : 's' }}
              </span>
            </li>
          }
        </ul>
      } @else {
        <p class="empty">{{ emptyHint() }}</p>
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
      margin: 0 0 4px;
    }
    .lede,
    .empty {
      color: #6b7280;
      font-size: 14px;
    }
    .sites {
      list-style: none;
      margin: 16px 0 0;
      padding: 0;
    }
    .sites li {
      display: flex;
      gap: 8px;
      align-items: baseline;
      padding: 6px 0;
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
      white-space: nowrap;
    }
  `,
})
export class Section {
  private readonly catalogService = inject(CatalogService);
  private readonly scopeSource = inject(QITS_SCOPE, { optional: true });
  private readonly route = inject(ActivatedRoute);

  /** The route's declared kind — the same component serves all three section routes. */
  protected readonly kind = toSignal(
    this.route.data.pipe(map((data) => data['kind'] as DocKind)),
    { initialValue: this.route.snapshot.data['kind'] as DocKind },
  );

  protected readonly section = computed(
    () => DOC_SECTIONS.find((section) => section.kind === this.kind()) ?? DOC_SECTIONS[0],
  );

  protected readonly catalog = toSignal(this.catalogService.catalog());

  /** Under a repository scope, only that repository's own sites — never someone else's docs. */
  protected readonly entries = computed<DocEntry[]>(() => {
    const repository = this.scopeSource?.scope().repository;
    return (this.catalog()?.scopes ?? [])
      .flatMap((group) => group.docs)
      .filter(
        (entry) =>
          kindOf(entry.name) === this.kind() &&
          (!repository || siteBelongsToRepository(entry.shortName, repository)),
      );
  });

  protected emptyHint(): string {
    switch (this.kind()) {
      case 'userflows':
        return 'No userflow reports yet — a repository publishes them per commit once it carries a ci-event-userflows pipeline.';
      case 'apidocs':
        return 'No API documents yet — a release pipeline publishes its openapi.yml under the @apidocs scope.';
      default:
        return 'Nothing is published here yet.';
    }
  }

  protected commands(site: string): string[] {
    return readCommands(site, undefined, scopeCommands(this.scopeSource?.scope()));
  }
}
