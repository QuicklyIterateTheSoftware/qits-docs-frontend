import { provideZonelessChangeDetection } from '@angular/core';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { Reader } from './reader';
import { Scopes } from './scopes';
import { Section } from './section';

/**
 * Every page of this application is addressable three times — its own path, the same path under a
 * project, and the same path under a repository — and all three must land on the SAME component. A
 * second component for a scoped form is the failure this guards against: it would compile, render,
 * and drift.
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

  it('serves the three section pages, unscoped and under a repository', async () => {
    const router = TestBed.inject(Router);
    for (const section of ['storybook', 'apidocs', 'userflows']) {
      expect(await resolve(`/${section}`)).toBe(Section);
      expect(await resolve(`/qits/services/qits-docs/${section}`)).toBe(Section);
      // The kind rides the route's data — the one component serves all three.
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

  it('serves the landing page under a project', async () => {
    // Where the chrome's project picker sends this app when a reader picks `qits`.
    expect(await resolve('/qits')).toBe(Scopes);
  });

  it('serves the reader under a project', async () => {
    expect(await resolve('/qits/read/@qits/ui-components/-/1.0.0')).toBe(Reader);
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

  /** A second segment that is not a category is not a scope, so the wildcard takes it. */
  it('falls back to the landing page for an address that is neither', async () => {
    expect(await resolve('/qits/nonsense/qits-docs')).toBe(Scopes);
    expect(await resolve('/nothing-here')).toBe(Scopes);
  });
});
