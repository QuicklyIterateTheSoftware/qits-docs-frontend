import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Marked } from 'marked';
import { baseUrl } from 'marked-base-url';
import DOMPurify from 'dompurify';
import { categoriesOf, pageBaseUrl, pagesInCategory, storyPages, type StoryPage } from './bundle-files';
import { CatalogService } from './catalog';

/** One story, rendered: its jump anchor, its display title, and its sanitized-then-trusted body. */
interface StorySection {
  readonly anchor: string;
  readonly title: string;
  readonly html: SafeHtml;
}

/** The story's own h1 when it has one — the slug loses punctuation the title keeps. */
export function storyTitle(markdown: string, fallback: string): string {
  return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() || fallback;
}

/**
 * A markdown bundle, read — the userflows kind: no `index.html` to frame, so the client renders
 * the markdown itself with standard libraries (marked for the parsing, marked-base-url so each
 * page's relative screenshots and video links resolve into the served bundle, DOMPurify over the
 * output because a bundle is publishable by anything on qits-net, and mermaid — lazy-loaded, only
 * when a page carries a diagram — for the sequence diagrams the userflows framework emits).
 *
 * <p>The selected category's stories all render on ONE page, with a legend of jump links at the
 * top instead of a selector — a reader scans the list, clicks, and lands on the story, and the
 * whole category stays scannable by scrolling. Categories remain the sidebar's rows and the
 * `?category=` query parameter.
 */
@Component({
  selector: 'docs-markdown-bundle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sections(); as list) {
      @if (list.length > 1) {
        <nav class="legend" aria-label="Stories">
          <span class="legend-label">Stories</span>
          @for (section of list; track section.anchor) {
            <a
              class="jump"
              [attr.href]="'#' + section.anchor"
              (click)="onJump($event, section.anchor)"
              >{{ section.title }}</a
            >
          }
        </nav>
      }
      @for (section of list; track section.anchor) {
        <article class="page" [id]="section.anchor" [innerHTML]="section.html"></article>
      } @empty {
        <p class="hint">No pages in this bundle.</p>
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
    }
    .legend {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 900px;
      margin: 16px auto 0;
      padding: 10px 24px;
    }
    .legend-label {
      color: #6b7280;
      font-size: 0.75rem;
    }
    /* The sidebar's rail idiom, borrowed: a jump link is a row pointing into the page below. */
    .jump {
      align-self: flex-start;
      padding: 2px 10px;
      border-left: 2px solid #e5e7eb;
      font-size: 13px;
      color: #4b5563;
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .jump:hover {
      background: #f3f4f6;
      color: #111827;
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
    .page + .page {
      border-top: 1px solid #e5e7eb;
      padding-top: 24px;
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
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly site = input.required<string>();
  readonly version = input.required<string>();

  private readonly detail = toSignal(
    toObservable(computed(() => ({ site: this.site(), version: this.version() }))).pipe(
      switchMap(({ site, version }) => this.catalogService.version(site, version)),
    ),
  );

  protected readonly files = computed(() => this.detail()?.files);
  protected readonly pages = computed(() => storyPages(this.files() ?? []));

  private readonly categories = computed(() => categoriesOf(this.pages()));

  /** The route's ?category= — the sidebar's category rows navigate here; absent = the first. */
  private readonly queryCategory = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('category') ?? undefined)),
    { initialValue: this.route.snapshot.queryParamMap.get('category') ?? undefined },
  );

  protected readonly selectedCategory = computed(() => {
    const asked = this.queryCategory();
    if (asked && this.categories().includes(asked)) {
      return asked;
    }
    return this.categories()[0] ?? '';
  });

  /** The selected category's stories — the whole list for a flat (pre-category) bundle. */
  protected readonly visiblePages = computed(() =>
    pagesInCategory(this.pages(), this.selectedCategory()),
  );

  /**
   * Every visible story, fetched and rendered — the whole category is one page. The pipeline per
   * story is the libraries': marked parses (with the story's own served directory as the base for
   * relative links and images), DOMPurify sanitizes, and only then does the string become trusted
   * — the bypass wraps DOMPurify's output, never the network's. A story that fails to load keeps
   * its slot with a hint rather than sinking its whole category.
   */
  protected readonly sections = toSignal<StorySection[] | undefined>(
    toObservable(
      computed(() =>
        this.files() === undefined
          ? undefined
          : { site: this.site(), version: this.version(), pages: this.visiblePages() },
      ),
    ).pipe(
      switchMap((at) => {
        if (!at) {
          return of(undefined);
        }
        if (at.pages.length === 0) {
          return of([]);
        }
        return forkJoin(at.pages.map((page) => this.renderStory(at.site, at.version, page)));
      }),
    ),
  );

  private renderStory(site: string, version: string, page: StoryPage) {
    const base = pageBaseUrl(site, version, page.path);
    return this.http.get(`/docs/${site}/-/${version}/${page.path}`, { responseType: 'text' }).pipe(
      map((markdown) => {
        const rendered = new Marked(baseUrl(base)).parse(markdown, { async: false });
        return {
          anchor: page.story,
          title: storyTitle(markdown, page.story),
          html: this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(rendered)),
        };
      }),
      catchError(() =>
        of({
          anchor: page.story,
          title: page.story,
          html: this.sanitizer.bypassSecurityTrustHtml(
            '<p class="hint">This page could not be loaded.</p>',
          ),
        }),
      ),
    );
  }

  /**
   * A legend click scrolls within this component's own scroll container — the href carries the
   * fragment for semantics, but letting it navigate would hand the jump to the router.
   */
  protected onJump(event: Event, anchor: string): void {
    event.preventDefault();
    this.host.nativeElement
      .querySelector(`#${CSS.escape(anchor)}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Another category or bundle is another document — start it at the top, not mid-scroll. */
  private readonly resetScrollOnListChange = effect(() => {
    this.sections();
    this.host.nativeElement.scrollTop = 0;
  });

  /**
   * The diagram pass: once the rendered stories are in the DOM, their `language-mermaid` code
   * blocks are drawn in place. Mermaid is imported lazily — a page without a diagram never loads
   * the library — and initialized `securityLevel: 'strict'`, its own sanitizing mode, over text
   * that already passed DOMPurify above.
   */
  private readonly drawDiagrams = effect(() => {
    this.sections();
    const host = this.host.nativeElement;
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
