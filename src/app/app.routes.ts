import { Routes, type CanMatchFn, type UrlSegment } from '@angular/router';
import { QitsMainLayout, QITS_CATEGORIES, type QitsCategory } from '@qits/ui-components';
import { Reader } from './reader';
import { Scopes } from './scopes';

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
 */
const OWN: Routes = [
  { path: '', component: Scopes },
  { path: 'read/**', component: Reader },
];

/**
 * Whether the address is really `/<slug>/<category>/<repo>/…` and not a page of this app's own.
 *
 * The second segment is the discriminator, because it is the only one whose vocabulary is closed:
 * a project slug can be anything, a repository name can be anything, and `services` is a category
 * on this platform and nothing else. qits-projects refuses a slug that spells one, so the two
 * vocabularies cannot collide from the other side either.
 */
export const categoryIsKnown: CanMatchFn = (_route, segments: UrlSegment[]) =>
  QITS_CATEGORIES.includes(segments[1]?.path as QitsCategory);

/**
 * The platform's URL grammar: every page of this application is addressable twice — unscoped, and
 * under the repository whose documentation it shows.
 *
 * OWN routes come FIRST so a literal first segment always wins: `/read/@qits/ui-components` is this
 * app's reader, never a project called `read`. The scoped form follows, guarded on the category, and
 * the wildcard closes the list.
 *
 * The pages read `inject(QITS_SCOPE).scope()` rather than these params, so the same components serve
 * both spellings and neither has a component of its own.
 */
export const routes: Routes = [
  {
    path: '',
    component: QitsMainLayout,
    children: [
      ...OWN,
      { path: ':project/:category/:repository', canMatch: [categoryIsKnown], children: OWN },
      // Anything else is a mistyped URL; the index is the useful answer, not a 404 nobody wrote.
      { path: '**', redirectTo: '' },
    ],
  },
];
