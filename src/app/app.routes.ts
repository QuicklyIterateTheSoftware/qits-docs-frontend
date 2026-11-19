import { Routes, type CanMatchFn, type UrlSegment } from '@angular/router';
import { QitsMainLayout, QITS_CATEGORIES, type QitsCategory } from '@qits/ui-components';
import { DOC_SECTIONS } from './doc-kind';
import { ProjectDocsRedirect } from './project-docs-redirect';
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
 * The four SECTION routes (`storybook`, `apidocs`, `userflows`, `guides`) are addresses on purpose
 * — the landing page's cards and the sidebar's section headers link to them, and a section URL is
 * one a person can hand someone. Derived from DOC_SECTIONS so a fourth kind arrives as one entry
 * there, which is exactly how `guides` did arrive: this file was not edited for it beyond this
 * sentence, and `OWN_SEGMENTS` below picked the new segment up on its own, so `/guides` is a page
 * of this app's own and can never be read as a project slug or a component group.
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
 * The project form's own children — `OWN`, with the landing page and every section page swapped
 * for {@link ProjectDocsRedirect} hops to the landing app's own `/projects/<slug>/docs` (qits-2318):
 * the full catalog unscoped, the catalog narrowed to one section with `?section=<route>` under
 * each DOC_SECTIONS entry. `read/**` is untouched — the reader stays this application's own, under
 * a project exactly as it always was — and so is the repository form two segments deeper, which
 * mounts `OWN` rather than this array and never sees a redirect.
 */
const PROJECT_OWN: Routes = [
  { path: '', component: ProjectDocsRedirect },
  ...DOC_SECTIONS.map((section) => ({
    path: section.route,
    component: ProjectDocsRedirect,
    data: { section: section.route },
  })),
  { path: 'read/**', component: Reader },
];

/**
 * The platform's URL grammar: every page of this application is addressable three times —
 * unscoped, under a project, and under the repository whose documentation it shows.
 *
 * The project form is what the chrome's project picker navigates to: `UrlScope.select(slug)` goes
 * to `/<slug>/`, and without this route that pick would fall through to the wildcard. It no longer
 * renders this application's own landing or section pages, though: `/<slug>` and `/<slug>/<section>`
 * are now {@link PROJECT_OWN}, each a {@link ProjectDocsRedirect} hop to the landing app's own docs
 * screen for that project (qits-2318) — the catalog browser moved there, and this address exists
 * only to carry an old bookmark or a picker navigation to it. `/<slug>/read/**` is the one address
 * this mount still renders itself, because the reader has no landing-app equivalent to send it to.
 *
 * Order is the whole grammar. OWN routes come FIRST so a literal first segment always wins —
 * `/read/@qits/ui-components` is this app's reader, never a project called `read`. The repository
 * form follows, guarded off this app's own segments so `/qits/read/…` stays the reader, then the
 * project form takes what is left, and the wildcard closes the list.
 *
 * The unscoped and repository-scoped pages read `inject(QITS_SCOPE).scope()` rather than route
 * params, so the same components serve both spellings and none has a component of its own.
 * {@link ProjectDocsRedirect} is the exception: it has no reason to wait on `QITS_SCOPE`'s project
 * list, since it is leaving this application either way, so it reads the `:project` segment the
 * route table already matched.
 */
export const routes: Routes = [
  {
    path: '',
    component: QitsMainLayout,
    children: [
      ...OWN,
      { path: ':project/:group/:repository', canMatch: [isRepositoryAddress], children: OWN },
      { path: ':project', children: PROJECT_OWN },
      // Anything else is a mistyped URL; the index is the useful answer, not a 404 nobody wrote.
      { path: '**', redirectTo: '' },
    ],
  },
];
