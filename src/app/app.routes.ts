import { Routes, type CanMatchFn, type UrlSegment } from '@angular/router';
import { QitsMainLayout, QITS_CATEGORIES, type QitsCategory } from '@qits/ui-components';
import { DOC_SECTIONS } from './doc-kind';
import { Reader } from './reader';
import { Scopes } from './scopes';
import { Section } from './section';

/**
 * QitsMainLayout is the ROOT ROUTE COMPONENT, not a tag wrapped around the pages — the platform's
 * convention, stated in the component's own docs. Mounted this way the chrome survives navigation
 * and only its `<router-outlet />` changes; wrapping each page in a tag would rebuild the whole
 * skeleton on every hop and lose the sidebar's state with it.
 *
 * Its links leave this SPA on purpose: every destination is a different Angular application on a
 * host of its own, so they are plain `<a href>` full-document navigations. The list comes from
 * `provideQitsNavigation()` — see app.config.ts — and this client passes no `links` of its own.
 *
 * Two pages, and one of them is a wildcard because a site name is not one segment. `read/**`
 * captures `@qits/ui-components/-/2026.807.0` whole and `doc-url.ts` splits it on the platform's
 * `/-/` separator; no `:param` route can, since the name's depth varies.
 *
 * There is no scope route any more. Browsing scope by scope is the sidebar's job now, and a page
 * built from the same `catalog()` was a second implementation of the same list.
 *
 * The three SECTION routes (`storybook`, `apidocs`, `userflows`) are addresses on purpose — the
 * landing page's cards and the sidebar's section headers link to them, and a section URL is one a
 * person can hand someone. Derived from DOC_SECTIONS so a fourth kind arrives as one entry there.
 */
const OWN: Routes = [
  { path: '', component: Scopes },
  ...DOC_SECTIONS.map((section) => ({
    path: section.route,
    component: Section,
    data: { kind: section.kind },
  })),
  { path: 'read/**', component: Reader },
];

/**
 * This application's own second segments, derived from its own routes so a page added to `OWN` can
 * never be shadowed by the group form: `read`, and one per documentation section.
 */
const OWN_SEGMENTS: ReadonlySet<string> = new Set(
  OWN.map((route) => (route.path ?? '').split('/')[0]).filter((segment) => segment.length > 0),
);

/**
 * Whether the address is really `/<slug>/<group>/<repo>/…` and not a page of this app's own.
 *
 * The middle segment is the repository's **component** — `qits-docs` — where the platform gives it
 * one, and its archetype category where it does not. Component names are an OPEN set that only the
 * platform knows, so nothing compiled in can prove one and the closed-set test this guard used to
 * make would 404 every component address. The test runs the other way round now: a second segment
 * is a group unless it spells a page of this application's own — which is the same rule the route
 * ORDER already states, said once more where the group form could otherwise take `/qits/read/…`.
 *
 * The chrome reads the same address the same way — `parseScope` proves a component once the
 * repository list answers — so a middle segment naming no component of the project leaves the pages
 * below unscoped rather than turned away here.
 */
export const isRepositoryAddress: CanMatchFn = (_route, segments: UrlSegment[]) => {
  const project = segments[0]?.path;
  const group = segments[1]?.path;
  if (!project || !group) return false;
  // A project is never a category and never a page of this app's own, which is the rule the chrome
  // states from the other side: qits-projects refuses a slug that spells either.
  if (OWN_SEGMENTS.has(project) || QITS_CATEGORIES.includes(project as QitsCategory)) return false;
  return !OWN_SEGMENTS.has(group);
};

/**
 * The platform's URL grammar: every page of this application is addressable three times —
 * unscoped, under a project, and under the repository whose documentation it shows.
 *
 * The project form is what the chrome's project picker navigates to: `UrlScope.select(slug)` goes
 * to `/<slug>/`, and without this route that pick would fall through to the wildcard.
 *
 * Order is the whole grammar. OWN routes come FIRST so a literal first segment always wins —
 * `/read/@qits/ui-components` is this app's reader, never a project called `read`. The repository
 * form follows, guarded off this app's own segments so `/qits/read/…` stays the reader, then the
 * project form takes what is left, and the wildcard closes the list.
 *
 * The pages read `inject(QITS_SCOPE).scope()` rather than these params, so the same components serve
 * every spelling and none has a component of its own.
 */
export const routes: Routes = [
  {
    path: '',
    component: QitsMainLayout,
    children: [
      ...OWN,
      { path: ':project/:group/:repository', canMatch: [isRepositoryAddress], children: OWN },
      { path: ':project', children: OWN },
      // Anything else is a mistyped URL; the index is the useful answer, not a 404 nobody wrote.
      { path: '**', redirectTo: '' },
    ],
  },
];
