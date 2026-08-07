import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CatalogService } from './catalog';

/**
 * Layer two: what one scope publishes.
 *
 * <p>Each entry links straight to the bundle's own URL rather than to a third route of this client's
 * — `/platform-docs/<site>` is the service's redirect to the newest version, so following it is what
 * makes "the docs" mean the newest ones without this page having to know which those are.
 *
 * <p>The scope comes from the route as `-` for the unscoped group, because an empty path segment is
 * not addressable. That is a URL detail and it stops here: what is rendered is the real scope, or
 * nothing.
 */
@Component({
  selector: 'qits-docs-scope',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav class="crumbs"><a routerLink="/">Documentation</a> <span>/</span> <span>{{ heading() }}</span></nav>
    <h1>{{ heading() }}</h1>

    @if (docs(); as entries) {
      @if (entries.length) {
        <ul class="list">
          @for (entry of entries; track entry.name) {
            <li>
              <!-- To the READER, not to the bundle. Linking straight at the service's redirect served
                   a full-viewport Storybook with no rail — so opening a doc took the version picker
                   away, which is the one thing this page exists to lead to. -->
              <!-- SPLIT, not passed whole: routerLink treats one array element as one segment and
                   percent-encodes any slash in it, so a whole name comes out with its scope
                   separator escaped. The reader parses either, but only one of them is a URL a
                   person would copy. (No backticks in this comment: the template is a backtick
                   literal, and one here terminates it — NG1002, from a decorator that then has the
                   wrong number of arguments.) -->
              <a class="row" [routerLink]="['/read', ...entry.name.split('/')]">
                <span class="name">{{ entry.shortName }}</span>
                <span class="meta">
                  {{ entry.latestVersion }} ·
                  {{ entry.versionCount }} {{ entry.versionCount === 1 ? 'version' : 'versions' }}
                </span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <p class="empty">Nothing is published under this scope.</p>
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
    }
    .crumbs {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 8px;
      display: flex;
      gap: 6px;
    }
    .crumbs a {
      color: #6b7280;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 16px;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      text-decoration: none;
      color: #111827;
      background: #ffffff;
    }
    .row:hover {
      background: #f9fafb;
      border-color: #d1d5db;
    }
    .name {
      font-weight: 600;
    }
    .meta {
      font-size: 13px;
      color: #6b7280;
    }
    .empty {
      color: #6b7280;
      font-size: 14px;
    }
  `,
})
export class Scope {
  private readonly route = inject(ActivatedRoute);

  /**
   * From the route, read directly rather than bound as an input.
   *
   * `withComponentInputBinding()` is off — it wipes a route component's input defaults with
   * `undefined`, which broke QitsMainLayout — so params are read here. `-` is how the unscoped
   * group is spelled, since a URL segment cannot be empty.
   */
  protected readonly scope = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('scope') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('scope') ?? '' },
  );

  private readonly catalogService = inject(CatalogService);
  private readonly catalog = toSignal(this.catalogService.catalog());

  protected readonly heading = computed(() => (this.scope() === '-' ? 'ungrouped' : this.scope()));

  protected readonly docs = computed(() => {
    const loaded = this.catalog();
    if (!loaded) {
      return undefined;
    }
    const wanted = this.scope() === '-' ? '' : this.scope();
    return loaded.scopes.find((group) => group.scope === wanted)?.docs ?? [];
  });
}
