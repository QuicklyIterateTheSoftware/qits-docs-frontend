import { DOCUMENT } from '@angular/common';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, UrlSegment } from '@angular/router';
import { provideQitsNavigationTree, type QitsNavigation } from '@qits/ui-components';
import { DocsReaderRedirect } from './docs-reader-redirect';

/**
 * Where the project form's and the repository form's own `read/**` route lands now that the
 * landing app grew a reader of its own (qits-2337) — see `project-docs-redirect.spec.ts` for the
 * sibling it mirrors, including why this mounts no router and why `DOCUMENT` is a proxy rather
 * than a bare replacement. `app.routes.spec.ts` covers the routing side: which URLs resolve here
 * at all, and which stay {@link Reader} because they are storybook.
 */
function fakeDocument(replace: (url: string) => void): Document {
  const location = { replace };
  return new Proxy(document, {
    get(target, prop, receiver) {
      if (prop === 'location') return location;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as Document;
}

describe('DocsReaderRedirect', () => {
  let replace: ReturnType<typeof vi.fn<(url: string) => void>>;

  /**
   * `url` is this route's OWN segments — the literal `read` first, exactly as `ActivatedRoute.url`
   * carries it under a `read/**` route. `project` sits on the parent's paramMap, same shape as
   * {@link ProjectDocsRedirect}'s harness; there is no `:repository` here because this component
   * never reads one.
   */
  function mount(options: {
    readonly project: string;
    readonly url: readonly string[];
    readonly category?: string;
    readonly navigation?: QitsNavigation;
  }): ComponentFixture<DocsReaderRedirect> {
    replace = vi.fn<(url: string) => void>();
    const route = {
      snapshot: {
        url: options.url.map((segment) => new UrlSegment(segment, {})),
        queryParamMap: convertToParamMap(
          options.category === undefined ? {} : { category: options.category },
        ),
        parent: {
          paramMap: convertToParamMap({ project: options.project }),
        },
      },
    } as unknown as ActivatedRoute;

    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: DOCUMENT, useValue: fakeDocument(replace) },
        provideQitsNavigationTree(options.navigation ?? {}),
      ],
    });
    const fixture = TestBed.createComponent(DocsReaderRedirect);
    fixture.detectChanges();
    return fixture;
  }

  const LANDING_ORIGIN: QitsNavigation = {
    applications: { 'qits-landing': { origin: 'https://qits.example.test' } },
  };

  it('redirects a bare site to the landing app’s reader', () => {
    mount({
      project: 'qits',
      url: ['read', '@userflows', 'qits-projects'],
      navigation: LANDING_ORIGIN,
    });

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith(
      'https://qits.example.test/projects/qits/docs/read/@userflows/qits-projects',
    );
  });

  it('redirects a versioned address, carrying the `/-/` version along', () => {
    mount({
      project: 'qits',
      url: ['read', '@changelog', 'qits-ci-service', '-', '2026.1119.181434'],
      navigation: LANDING_ORIGIN,
    });

    expect(replace).toHaveBeenCalledWith(
      'https://qits.example.test/projects/qits/docs/read/@changelog/qits-ci-service/-/2026.1119.181434',
    );
  });

  it('keeps the `?category=` query parameter', () => {
    mount({
      project: 'qits',
      url: ['read', '@userflows', 'qits-projects'],
      category: 'authentication',
      navigation: LANDING_ORIGIN,
    });

    expect(replace).toHaveBeenCalledWith(
      'https://qits.example.test/projects/qits/docs/read/@userflows/qits-projects?category=authentication',
    );
  });

  it('encodes the project slug', () => {
    mount({ project: 'a/b', url: ['read', '@userflows', 'x'], navigation: LANDING_ORIGIN });

    expect(replace).toHaveBeenCalledWith(
      'https://qits.example.test/projects/a%2Fb/docs/read/@userflows/x',
    );
  });

  it('falls back to the environment origin where the landing app has none of its own', () => {
    mount({
      project: 'qits',
      url: ['read', '@userflows', 'x'],
      navigation: { origin: 'https://dev.qits.example' },
    });

    expect(replace).toHaveBeenCalledWith(
      'https://dev.qits.example/projects/qits/docs/read/@userflows/x',
    );
  });

  it('waits rather than redirecting to a relative URL when neither origin ever resolves', () => {
    const fixture = mount({ project: 'qits', url: ['read', '@userflows', 'x'], navigation: {} });

    expect(replace).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The docs moved to the landing app',
    );
  });

  it('shows the destination it is about to leave for, so the line is never just a promise', () => {
    const fixture = mount({
      project: 'qits',
      url: ['read', '@userflows', 'x'],
      navigation: LANDING_ORIGIN,
    });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'https://qits.example.test/projects/qits/docs/read/@userflows/x',
    );
  });
});
