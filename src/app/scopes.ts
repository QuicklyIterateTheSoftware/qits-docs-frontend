import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogService } from './catalog';

/**
 * The landing page, and deliberately almost nothing.
 *
 * <p>Browsing the catalog is the sidebar's job — it is on screen here and on every other page, so
 * repeating the list would be a second view of one response that can only ever agree or be a bug.
 * What is left is a door sign, plus the one message an empty sidebar cannot carry: an empty tree
 * looks the same whether nothing is published or nothing has answered, and only one of those is
 * worth explaining.
 */
@Component({
  selector: 'qits-docs-scopes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Documentation</h1>

    @if (catalog(); as loaded) {
      @if (loaded.scopes.length) {
        <p class="lede">Pick a package in the sidebar to read its documentation.</p>
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
