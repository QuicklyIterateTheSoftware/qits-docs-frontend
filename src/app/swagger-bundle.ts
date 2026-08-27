import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { CatalogService } from './catalog';

/**
 * The OpenAPI document of an `@apidocs` bundle: a file named `openapi.*` wherever it sits, or —
 * for a bundle that named it something else — the first spec-shaped file there is.
 */
export function openapiPathOf(files: readonly string[]): string | undefined {
  const specShaped = files.filter((file) => /\.(json|ya?ml)$/.test(file));
  return specShaped.find((file) => /(^|\/)openapi\.(json|ya?ml)$/.test(file)) ?? specShaped[0];
}

/**
 * An OpenAPI bundle, rendered with swagger-ui — the standard renderer, handed the served file's
 * URL so parsing (YAML included) stays the library's. Loaded lazily: the bundle is heavy and only
 * the `@apidocs` kind ever needs it. Its stylesheet rides the global styles (angular.json), where
 * a package CSS belongs.
 */
@Component({
  selector: 'docs-swagger-bundle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (specUrl()) {
      <div class="spec" #spec></div>
    } @else if (files()) {
      <p class="hint">This bundle carries no OpenAPI document.</p>
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
    }
    .spec {
      max-width: 1100px;
      margin: 0 auto;
    }
    .hint {
      margin: 24px;
      color: #6b7280;
    }
  `,
})
export class SwaggerBundle {
  private readonly catalogService = inject(CatalogService);

  readonly site = input.required<string>();
  readonly version = input.required<string>();

  private readonly specHost = viewChild<ElementRef<HTMLElement>>('spec');

  private readonly detail = toSignal(
    toObservable(computed(() => ({ site: this.site(), version: this.version() }))).pipe(
      switchMap(({ site, version }) => this.catalogService.version(site, version)),
    ),
  );

  protected readonly files = computed(() => this.detail()?.files);

  protected readonly specUrl = computed(() => {
    const path = openapiPathOf(this.files() ?? []);
    return path ? `/docs/${this.site()}/-/${this.version()}/${path}` : undefined;
  });

  private readonly mount = effect(() => {
    const url = this.specUrl();
    const host = this.specHost()?.nativeElement;
    if (!url || !host) {
      return;
    }
    void import('swagger-ui-dist/swagger-ui-es-bundle.js').then(({ default: SwaggerUIBundle }) => {
      host.replaceChildren();
      SwaggerUIBundle({ url, domNode: host, presets: [SwaggerUIBundle.presets.apis] });
    });
  });
}
