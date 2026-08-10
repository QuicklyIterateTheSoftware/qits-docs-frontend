import { Routes } from '@angular/router';
import { QitsMainLayout } from '@qits/ui-components';
import { Reader } from './reader';
import { Scopes } from './scopes';

/**
 * QitsMainLayout is the ROOT ROUTE COMPONENT, not a tag wrapped around the pages — the platform's
 * convention, stated in the component's own docs. Mounted this way the chrome survives navigation
 * and only its `<router-outlet />` changes; wrapping each page in a tag would rebuild the whole
 * skeleton on every hop and lose the sidebar's state with it.
 *
 * Its links leave this SPA on purpose: every destination is a different Angular application behind
 * its own base path, so they are plain `<a href>` full-document navigations. The list comes from
 * `provideQitsNavigation()` — see app.config.ts — and this client passes no `links` of its own.
 *
 * Two routes, and one of them is a wildcard because a site name is not one segment. `read/**`
 * captures `@qits/ui-components/-/2026.807.0` whole and `doc-url.ts` splits it on the platform's
 * `/-/` separator; no `:param` route can, since the name's depth varies.
 *
 * There is no scope route any more. Browsing scope by scope is the sidebar's job now, and a page
 * built from the same `catalog()` was a second implementation of the same list. `/docs/@qits`
 * therefore falls to the wildcard and lands on the index — where the sidebar already shows it.
 * NOTE: qits-docs still falls through for a single `@`-prefixed path segment, which it
 * added so that route could claim it. That fallthrough is now dead weight; it is a different
 * repository, and harmless where it is.
 */
export const routes: Routes = [
  {
    path: '',
    component: QitsMainLayout,
    children: [
      { path: '', component: Scopes },
      { path: 'read/**', component: Reader },
      // Anything else is a mistyped URL; the index is the useful answer, not a 404 nobody wrote.
      { path: '**', redirectTo: '' },
    ],
  },
];
