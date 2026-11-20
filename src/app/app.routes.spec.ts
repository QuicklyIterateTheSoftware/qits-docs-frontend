import { provideZonelessChangeDetection } from '@angular/core';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { DocsReaderRedirect } from './docs-reader-redirect';
import { ProjectDocsRedirect } from './project-docs-redirect';
import { Reader } from './reader';
import { Scopes } from './scopes';
import { Section } from './section';

/**
 * Every page of this application is addressable three times — its own path, the same path under a
 * project, and the same path under a repository — and all three used to land on the SAME
 * component. `read/**` stays {@link Reader} unscoped, as it always has, but under a project or a
 * repository it now hops to {@link DocsReaderRedirect} too (qits-2337) — unless the site is a
 * storybook one, which keeps rendering {@link Reader} there, since the landing app's own reader
 * has no frame renderer and links back here for that kind. The landing page and every section page
 * hop as well: both the project form (qits-2318) and the repository form (qits-2336) are
 * {@link ProjectDocsRedirect} redirects to the landing app's own docs screen, and only the unscoped
 * form still renders {@link Scopes} and {@link Section} itself. A second component for the reader,
 * which IS meant to agree everywhere even now that it isn't always this app's own, is the failure
 * this guards against — it would compile, render, and drift.
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

  it('serves the landing page unscoped', async () => {
    expect(await resolve('/')).toBe(Scopes);
  });

  it('serves every section page unscoped', async () => {
    const router = TestBed.inject(Router);
    for (const section of ['storybook', 'apidocs', 'userflows', 'guides', 'contracts', 'routes']) {
      expect(await resolve(`/${section}`)).toBe(Section);
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
   * The repository form's own landing page and section pages redirect too now (qits-2336), the
   * same hop as the project form one segment out — the middle segment being the repository's
   * component rather than its archetype category makes no difference, since both spellings reach
   * the same route. `read/**` is the one address this form still renders itself.
   */
  it('redirects the repository form’s landing page and section pages, but still serves the reader', async () => {
    const router = TestBed.inject(Router);
    expect(await resolve('/qits/qits-docs/qits-docs-service')).toBe(ProjectDocsRedirect);
    expect(await resolve('/qits/qits-docs/qits-docs-service/storybook')).toBe(ProjectDocsRedirect);
    let node = router.routerState.snapshot.root;
    while (node.firstChild) node = node.firstChild;
    expect(node.data['section']).toBe('storybook');
    expect(
      await resolve('/qits/qits-ui-components/qits-spa-ui-components/read/@qits/ui-components'),
    ).toBe(Reader);
  });

  /**
   * The point of {@link isStorybookRead}: a storybook address — any site no DOC_SECTIONS scope
   * claims — keeps rendering this application's own {@link Reader} under both forms, because the
   * landing app's own reader has no frame renderer and links back here for exactly that kind.
   * Everything else hops to {@link DocsReaderRedirect}, with the repository form dropping the
   * repository (a reader is addressed by site, never by the repository that published it), and the
   * unscoped form is untouched either way.
   */
  it('redirects a non-storybook read address under a project, keeping the version', async () => {
    expect(await resolve('/qits/read/@userflows/qits-projects')).toBe(DocsReaderRedirect);
    expect(await resolve('/qits/read/@changelog/qits-ci-service/-/2026.1119.181434')).toBe(
      DocsReaderRedirect,
    );
  });

  it('redirects a non-storybook read address under the repository form too', async () => {
    expect(await resolve('/qits/qits-ci/qits-ci-service/read/@contracts/qits-ci')).toBe(
      DocsReaderRedirect,
    );
  });

  it('keeps serving the reader for a storybook address under a project, and unscoped', async () => {
    expect(await resolve('/qits/read/@qits/ui-components')).toBe(Reader);
    expect(await resolve('/read/@userflows/x')).toBe(Reader);
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
   * A middle segment naming no component of the project still reads as the repository form — the
   * guard only tells a group from one of this app's own pages, never a real component from a
   * typo'd one — so it redirects the same as any other repository address rather than falling
   * back to anything local.
   */
  it('redirects a repository address that names nothing, the same as any other', async () => {
    expect(await resolve('/qits/nonsense/qits-docs')).toBe(ProjectDocsRedirect);
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
