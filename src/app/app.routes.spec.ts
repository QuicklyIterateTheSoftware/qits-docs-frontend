import { provideZonelessChangeDetection } from '@angular/core';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { ProjectDocsRedirect } from './project-docs-redirect';
import { Reader } from './reader';
import { Scopes } from './scopes';
import { Section } from './section';

/**
 * Every page of this application is addressable three times — its own path, the same path under a
 * project, and the same path under a repository — and all three must land on the SAME component,
 * with one exception: the project form's own landing page and section pages are
 * {@link ProjectDocsRedirect} hops to the landing app's own docs screen (qits-2318), where the
 * unscoped and repository forms still render {@link Scopes} and {@link Section} themselves. A
 * second component for either of the forms that ARE meant to agree is the failure this guards
 * against — it would compile, render, and drift.
 *
 * <p>Components are never created here. Without a `RouterOutlet` the router builds the state and
 * stops, so this reads what each URL resolves to without booting the chrome, the navigation fetch
 * or the project list.
 */
describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter(routes), provideLocationMocks()],
    });
  });

  async function resolve(url: string): Promise<unknown> {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    let node = router.routerState.snapshot.root;
    while (node.firstChild) node = node.firstChild;
    return node.component;
  }

  it('serves the landing page unscoped and under a repository', async () => {
    expect(await resolve('/')).toBe(Scopes);
    expect(await resolve('/qits/services/qits-docs')).toBe(Scopes);
  });

  it('serves every section page, unscoped and under a repository', async () => {
    const router = TestBed.inject(Router);
    for (const section of ['storybook', 'apidocs', 'userflows', 'guides', 'contracts', 'routes']) {
      expect(await resolve(`/${section}`)).toBe(Section);
      expect(await resolve(`/qits/services/qits-docs/${section}`)).toBe(Section);
      // The kind rides the route's data — the one component serves all of them.
      let node = router.routerState.snapshot.root;
      while (node.firstChild) node = node.firstChild;
      expect(node.data['kind']).toBe(section === 'apidocs' ? 'apidocs' : section);
    }
  });

  it('serves the reader in both spellings', async () => {
    expect(await resolve('/read/@qits/ui-components')).toBe(Reader);
    expect(
      await resolve('/qits/libs/qits-spa-ui-components/read/@qits/ui-components/-/1.0.0'),
    ).toBe(Reader);
  });

  it('redirects the landing page under a project to the landing app, instead of serving its own', async () => {
    // Where the chrome's project picker sends this app when a reader picks `qits` — it now hops
    // straight on to the landing app's own docs screen for that project (qits-2318).
    expect(await resolve('/qits')).toBe(ProjectDocsRedirect);
  });

  it('redirects a section page under a project to the landing app too, carrying the section along', async () => {
    const router = TestBed.inject(Router);
    expect(await resolve('/qits/apidocs')).toBe(ProjectDocsRedirect);
    // The section rides the route's data, the same way it used to for `Section` — the redirect
    // reads it to add `?section=` rather than hand-listing a case per section.
    let node = router.routerState.snapshot.root;
    while (node.firstChild) node = node.firstChild;
    expect(node.data['section']).toBe('apidocs');
  });

  it('serves the reader under a project', async () => {
    expect(await resolve('/qits/read/@qits/ui-components/-/1.0.0')).toBe(Reader);
    expect(await resolve('/qits/read/x')).toBe(Reader);
  });

  /**
   * The middle segment is the repository's component now, and the archetype form it had before
   * keeps working — the platform serves links in both spellings, and both land on the same page.
   */
  it('serves the pages under a repository addressed by its component', async () => {
    expect(await resolve('/qits/qits-docs/qits-docs-service')).toBe(Scopes);
    expect(await resolve('/qits/qits-docs/qits-docs-service/storybook')).toBe(Section);
    expect(
      await resolve('/qits/qits-ui-components/qits-spa-ui-components/read/@qits/ui-components'),
    ).toBe(Reader);
  });

  /**
   * A component is an open set, so this app's own pages are what the guard excludes — otherwise
   * `read` would read as a component and a three-segment reader address would show the index.
   * `storybook` now redirects rather than serving `Section` under a project, but it is still this
   * app's own second segment and not a group, which is the one thing this test pins.
   */
  it('keeps its own pages under a project out of the group form', async () => {
    expect(await resolve('/qits/read/qits-cli')).toBe(Reader);
    expect(await resolve('/qits/storybook')).toBe(ProjectDocsRedirect);
  });

  /**
   * The literal wins, which is why OWN routes come first. `read` is a plausible project slug and
   * `@qits` is not a category, so nothing scoped could claim this — but the ordering is what makes
   * that true rather than the guard.
   */
  it('reads a literal first segment as this app own page, not as a project', async () => {
    expect(await resolve('/read/qits-cli')).toBe(Reader);
    // Even against the project form, which would otherwise read `read` as a slug.
    expect(await resolve('/read/@qits/ui-components')).toBe(Reader);
  });

  /**
   * A middle segment naming no component of the project reads as a scope that never settles and
   * shows the landing page.
   */
  it('falls back to the landing page for a repository address that names nothing', async () => {
    expect(await resolve('/qits/nonsense/qits-docs')).toBe(Scopes);
  });

  /**
   * A first segment nobody has still reads as the project form, same as before this redirect
   * existed — it is just that mount's own `''` child that now redirects rather than rendering
   * `Scopes` locally, same as any other slug. There is no project list consulted here to tell a
   * real one from a typo, on either side of the hop.
   */
  it('reads a first segment nobody has as the project form, which redirects like any other slug', async () => {
    expect(await resolve('/nothing-here')).toBe(ProjectDocsRedirect);
  });
});
