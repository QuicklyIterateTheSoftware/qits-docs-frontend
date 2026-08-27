import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { catchError, map, of, switchMap } from 'rxjs';
import { Marked } from 'marked';
import { baseUrl } from 'marked-base-url';
import DOMPurify from 'dompurify';
import { CatalogService } from './catalog';

/** The bundle's pages: every markdown file, labelled by its story directory (or its own name). */
export function storyPages(
  files: readonly string[],
): { readonly path: string; readonly label: string }[] {
  return files
    .filter((file) => file.endsWith('.md'))
    .map((path) => {
      const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      return { path, label: directory || path.replace(/\.md$/, '') };
    });
}

/**
 * Where a page's RELATIVE references resolve — the served bundle directory the page sits in, with
 * the trailing slash that keeps `screenshot.png` beside the page rather than a level up.
 */
export function pageBaseUrl(site: string, version: string, page: string): string {
  const directory = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
  return `/docs/${site}/-/${version}/${directory}`;
}

/**
 * A markdown bundle, read page by page — the userflows kind: no `index.html` to frame, so the
 * client renders the markdown itself with standard libraries (marked for the parsing,
 * marked-base-url so the page's relative screenshots and video links resolve into the served
 * bundle, DOMPurify over the output because a bundle is publishable by anything on qits-net, and
 * mermaid — lazy-loaded, only when a page carries a diagram — for the sequence diagrams the
 * userflows framework emits).
 */
@Component({
  selector: 'docs-markdown-bundle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pages().length > 1) {
      <!-- The platform's on-page selector shape (.rev, the code pages'), not a qits-picker: an
           open-when-empty option list is right for a sidebar and wrong above content. -->
      <div class="pages">
        <label class="rev">
          <span class="rev-label">Story</span>
          <select (change)="onPagePicked($event)">
            @for (page of pages(); track page.path) {
              <option [value]="page.path" [selected]="page.path === selectedPage()">
                {{ page.label }}
              </option>
            }
          </select>
        </label>
      </div>
    }
    @if (html(); as rendered) {
      <article class="page" #page [innerHTML]="rendered"></article>
    } @else {
      <p class="hint">{{ pages().length === 0 && files() ? 'No pages in this bundle.' : 'Loading…' }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
      background: #fff;
    }
    .pages {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px 24px 0;
    }
    .rev {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .rev-label {
      color: #6b7280;
      font-size: 0.75rem;
    }
    .rev select {
      align-self: flex-start;
      max-width: 100%;
      padding: 0.3rem 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.35rem;
      background: #fff;
      color: #111827;
      font: inherit;
      font-size: 0.85rem;
    }
    .page {
      max-width: 900px;
      margin: 0 auto;
      padding: 8px 24px 48px;
      font-size: 15px;
      line-height: 1.6;
      color: #111827;
      overflow-wrap: anywhere;
    }
    .page img {
      max-width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
    }
    .page pre {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
    }
    .page svg {
      max-width: 100%;
      height: auto;
    }
    .hint {
      margin: 24px;
      color: #6b7280;
    }
  `,
})
export class MarkdownBundle {
  private readonly http = inject(HttpClient);
  private readonly catalogService = inject(CatalogService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly site = input.required<string>();
  readonly version = input.required<string>();

  private readonly pageHost = viewChild<ElementRef<HTMLElement>>('page');

  private readonly detail = toSignal(
    toObservable(computed(() => ({ site: this.site(), version: this.version() }))).pipe(
      switchMap(({ site, version }) => this.catalogService.version(site, version)),
    ),
  );

  protected readonly files = computed(() => this.detail()?.files);
  protected readonly pages = computed(() => storyPages(this.files() ?? []));

  private readonly chosenPage = signal<string | undefined>(undefined);

  /** Another bundle is another page list — a choice carried across would name a missing file. */
  private readonly resetChoiceOnBundleChange = effect(() => {
    this.site();
    this.version();
    this.chosenPage.set(undefined);
  });

  protected readonly selectedPage = computed(
    () => this.chosenPage() ?? this.pages()[0]?.path,
  );

  protected onPagePicked(event: Event): void {
    const page = (event.target as HTMLSelectElement).value;
    if (page) {
      this.chosenPage.set(page);
    }
  }

  /**
   * The selected page, fetched and rendered. The whole pipeline is the libraries': marked parses
   * (with the page's own served directory as the base for relative links and images), DOMPurify
   * sanitizes, and only then does the string become trusted — the bypass wraps DOMPurify's output,
   * never the network's.
   */
  protected readonly html = toSignal<SafeHtml | undefined>(
    toObservable(
      computed(() => {
        const page = this.selectedPage();
        return page
          ? { site: this.site(), version: this.version(), page }
          : undefined;
      }),
    ).pipe(
      switchMap((at) => {
        if (!at) {
          return of(undefined);
        }
        const base = pageBaseUrl(at.site, at.version, at.page);
        return this.http
          .get(`/docs/${at.site}/-/${at.version}/${at.page}`, { responseType: 'text' })
          .pipe(
            map((markdown) => {
              const rendered = new Marked(baseUrl(base)).parse(markdown, {
                async: false,
              });
              return this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(rendered));
            }),
            catchError(() =>
              of(
                this.sanitizer.bypassSecurityTrustHtml(
                  '<p class="hint">This page could not be loaded.</p>',
                ),
              ),
            ),
          );
      }),
    ),
  );

  /**
   * The diagram pass: once a rendered page is in the DOM, its `language-mermaid` code blocks are
   * drawn in place. Mermaid is imported lazily — a page without a diagram never loads the library
   * — and initialized `securityLevel: 'strict'`, its own sanitizing mode, over text that already
   * passed DOMPurify above.
   */
  private readonly drawDiagrams = effect(() => {
    this.html();
    const host = this.pageHost()?.nativeElement;
    if (!host) {
      return;
    }
    requestAnimationFrame(() => void renderMermaidBlocks(host));
  });
}

async function renderMermaidBlocks(host: HTMLElement): Promise<void> {
  const blocks = Array.from(host.querySelectorAll('code.language-mermaid'));
  if (blocks.length === 0) {
    return;
  }
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  for (const [index, block] of blocks.entries()) {
    const definition = block.textContent ?? '';
    try {
      const { svg } = await mermaid.render(`docs-mermaid-${Date.now()}-${index}`, definition);
      const drawn = document.createElement('div');
      drawn.innerHTML = svg;
      (block.closest('pre') ?? block).replaceWith(drawn);
    } catch {
      // An undrawable diagram stays what it already is: the fenced definition, legible as text.
    }
  }
}
