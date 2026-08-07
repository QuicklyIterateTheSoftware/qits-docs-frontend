import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogService } from './catalog';

/**
 * Layer one: what publishes documentation.
 *
 * <p>A scope is a group, not a thing you can read — so an entry links one level down rather than
 * into a bundle. The unscoped group has no heading to show, because there is no name to show; it is
 * the bucket for a service that documents itself under a bare name.
 */
@Component({
  selector: 'qits-docs-scopes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>Documentation</h1>

    @if (catalog(); as loaded) {
      @if (loaded.scopes.length) {
        <ul class="list">
          @for (group of loaded.scopes; track group.scope) {
            <li>
              <a class="row" [routerLink]="['/', group.scope || '-']">
                <span class="name">{{ group.scope || 'ungrouped' }}</span>
                <span class="meta">{{ group.docs.length }} {{ group.docs.length === 1 ? 'doc' : 'docs' }}</span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <p class="empty">
          Nothing is published yet. A release pipeline declares
          <code>{{ '{' }} type: docs {{ '}' }}</code> and pushes its bundle to qits-artifacts.
        </p>
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
    code {
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 4px;
    }
  `,
})
export class Scopes {
  private readonly catalogService = inject(CatalogService);

  /**
   * Undefined until the first response, which is what the template's `@else` renders as "Loading…".
   * No initial value is given on purpose: an empty catalog and an unanswered one look identical if
   * both start as `{scopes: []}`, and only one of them should say "nothing is published yet".
   */
  protected readonly catalog = toSignal(this.catalogService.catalog());
}
