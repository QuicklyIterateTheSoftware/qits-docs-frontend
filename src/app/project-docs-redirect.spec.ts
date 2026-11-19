import { DOCUMENT } from '@angular/common';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideQitsNavigationTree, type QitsNavigation } from '@qits/ui-components';
import { ProjectDocsRedirect } from './project-docs-redirect';

/**
 * Where the project form's own landing page and section pages land now that the catalog browser
 * moved to the landing app (qits-2318).
 *
 * **No router here, on purpose.** The component reads `:project` off `ActivatedRoute.snapshot.parent`
 * and its own section off `ActivatedRoute.snapshot.data`, both of which this suite can shape
 * directly — mounting the whole route table through a harness would additionally have to stand up
 * `QitsMainLayout` just to reach a page that is leaving before it would ever be drawn. See
 * `app.routes.spec.ts` for the routing side of this: which URLs resolve to this component at all.
 *
 * **`DOCUMENT` is a proxy over the real one, not a bare replacement.** jsdom's own
 * `location.replace` cannot be spied on at all, but the real `DOCUMENT` is also what Angular's own
 * test renderer uses to attach and tear down the fixture's root element — a fake carrying nothing
 * but a `location` breaks `TestBed.createComponent` itself before this page gets a chance to run.
 * The proxy forwards every other read straight to `document`, methods bound to it so their native
 * internals still see the object they expect, and answers only `location` itself.
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

describe('ProjectDocsRedirect', () => {
  let replace: ReturnType<typeof vi.fn<(url: string) => void>>;

  /** `section` left out is the project's own landing page, the `''` child of `:project`. */
  function mount(options: {
    readonly project: string;
    readonly section?: string;
    readonly navigation?: QitsNavigation;
  }): ComponentFixture<ProjectDocsRedirect> {
    replace = vi.fn<(url: string) => void>();
    const route = {
      snapshot: {
        data: options.section === undefined ? {} : { section: options.section },
        parent: { paramMap: convertToParamMap({ project: options.project }) },
      },
    } as unknown as ActivatedRoute;

    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: DOCUMENT, useValue: fakeDocument(replace) },
        provideQitsNavigationTree(options.navigation ?? {}),
      ],
    });
    const fixture = TestBed.createComponent(ProjectDocsRedirect);
    fixture.detectChanges();
    return fixture;
  }

  const LANDING_ORIGIN: QitsNavigation = {
    applications: { 'qits-landing': { origin: 'https://qits.example.test' } },
  };

  it('redirects the landing page under a project to the landing app’s docs screen', () => {
    mount({ project: 'qits', navigation: LANDING_ORIGIN });

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('https://qits.example.test/projects/qits/docs');
  });

  it('redirects a section page under a project, carrying the section as a `?section=` lens', () => {
    mount({ project: 'qits', section: 'apidocs', navigation: LANDING_ORIGIN });

    expect(replace).toHaveBeenCalledWith(
      'https://qits.example.test/projects/qits/docs?section=apidocs',
    );
  });

  it('encodes the project slug', () => {
    mount({ project: 'a/b', navigation: LANDING_ORIGIN });

    expect(replace).toHaveBeenCalledWith('https://qits.example.test/projects/a%2Fb/docs');
  });

  it('falls back to the environment origin where the landing app has none of its own', () => {
    mount({ project: 'qits', navigation: { origin: 'https://dev.qits.example' } });

    expect(replace).toHaveBeenCalledWith('https://dev.qits.example/projects/qits/docs');
  });

  it('waits rather than redirecting to a relative URL when neither origin ever resolves', () => {
    const fixture = mount({ project: 'qits', navigation: {} });

    expect(replace).not.toHaveBeenCalled();
    // The message stays up rather than a blank page — it is the whole point of rendering anything.
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'The docs moved to the landing app',
    );
  });

  it('shows the destination it is about to leave for, so the line is never just a promise', () => {
    const fixture = mount({ project: 'qits', navigation: LANDING_ORIGIN });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'https://qits.example.test/projects/qits/docs',
    );
  });
});
