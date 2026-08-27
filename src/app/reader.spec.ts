import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, UrlSegment } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Reader } from './reader';

/**
 * The reader is one iframe, and every assertion here is about WHERE it points and WHETHER it is the
 * same element as a moment ago. Both have been wrong in production: it once pointed at itself, and
 * a src rebuilt on every recomputation throws away a loaded document for nothing.
 */
describe('Reader', () => {
  const SITE = '@qits/ui-components';

  function segments(path: string): UrlSegment[] {
    return path.split('/').map((part) => new UrlSegment(part, {}));
  }

  /** A route, drivable — the reader reads `url`, which the router re-emits on every match. */
  async function render(path = `read/${SITE}`) {
    const url = new BehaviorSubject(segments(path));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { url, snapshot: { url: url.value } } },
      ],
    });
    // Deferred blocks (@defer) compile their dependencies asynchronously.
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(Reader);
    fixture.detectChanges();
    return { fixture, url, http: TestBed.inject(HttpTestingController) };
  }

  function frame(fixture: ComponentFixture<Reader>): HTMLIFrameElement {
    const element = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement | null;
    if (!element) throw new Error('no iframe rendered');
    return element;
  }

  function answerVersions(http: HttpTestingController, ...versions: string[]): void {
    http
      .expectOne((request) => request.url === '/docs/api/versions')
      .flush({
        name: SITE,
        versions: versions.map((version) => ({
          version,
          fileCount: 1,
          totalBytes: 1,
          publishedAt: '2026-08-07T00:00:00Z',
        })),
      });
  }

  /**
   * Nothing is known yet, so nothing is loaded. The alternative — guessing an address before the
   * version list answers — is how the frame ends up somewhere it should not be.
   */
  it('renders about:blank until the versions arrive', async () => {
    const { fixture } = await render();
    expect(frame(fixture).getAttribute('src')).toBe('about:blank');
  });

  /**
   * `/docs/<site>` is the service's redirect TO the reader. An iframe pointed there loads
   * this page inside this page — it actually happened — so the address must always carry a version.
   */
  it('resolves the newest version rather than the bare site URL', async () => {
    const { fixture, http } = await render();
    answerVersions(http, '2026.807.0', '2026.806.0');
    await fixture.whenStable();

    const src = frame(fixture).getAttribute('src');
    expect(src).toBe(`/docs/${SITE}/-/2026.807.0/`);
    expect(src).not.toBe(`/docs/${SITE}`);
    expect(src).not.toBe(`/docs/${SITE}/`);
  });

  it('takes the version out of the URL when there is one', async () => {
    const { fixture, http } = await render(`read/${SITE}/-/2026.806.0`);
    answerVersions(http, '2026.807.0', '2026.806.0');
    await fixture.whenStable();

    expect(frame(fixture).getAttribute('src')).toBe(`/docs/${SITE}/-/2026.806.0/`);
  });

  /**
   * The trap `bundleHref`/`bundleUrl` exist separately to avoid: `bypassSecurityTrustResourceUrl`
   * returns a new object every call, so a single computed would hand `[src]` an unequal value on
   * every recomputation and the browser would reload a document that had not moved.
   */
  it('keeps the same iframe element when the route re-emits the same URL', async () => {
    const { fixture, url, http } = await render();
    answerVersions(http, '2026.807.0');
    await fixture.whenStable();
    const before = frame(fixture);

    url.next(segments(`read/${SITE}`));
    await fixture.whenStable();

    expect(frame(fixture)).toBe(before);
  });

  /** The rail and the picker moved to the platform sidebar. Nothing of them may grow back here. */
  it('carries no navigation of its own', async () => {
    const { fixture, http } = await render();
    answerVersions(http, '2026.807.0');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.rail')).toBeNull();
    expect(fixture.nativeElement.querySelector('qits-picker')).toBeNull();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });
});
