import { Routes } from '@angular/router';
import { QitsMainLayout } from '@qits/ui-components';
import { Reader } from './reader';
import { Scope } from './scope';
import { Scopes } from './scopes';

/**
 * QitsMainLayout is the ROOT ROUTE COMPONENT, not a tag wrapped around the pages — the platform's
 * convention, stated in the component's own docs. Mounted this way the chrome survives navigation
 * and only its `<router-outlet />` changes; wrapping each page in a tag would rebuild the whole
 * skeleton on every hop and lose the sidebar's state with it.
 *
 * Its links leave this SPA on purpose: every destination is a different Angular application behind
 * its own base path, so they are plain `<a href>` full-document navigations. `QITS_NAV_LINKS` is the
 * default and this client passes no `links` of its own.
 *
 * Three layers under it, and one of them is a wildcard because a site name is not one segment.
 * `read/**` captures `@qits/ui-components/-/2026.807.0` whole and the component splits it on the
 * platform's `/-/` separator; no `:param` route can, since the name's depth varies.
 *
 * `:scope` is last so it cannot shadow `read`. It is also the ONE route the service hands over
 * rather than answering: `/platform-docs/@qits` is a scope page, and the service falls through for
 * a single segment beginning with `@` precisely so this route gets it.
 */
export const routes: Routes = [
  {
    path: '',
    component: QitsMainLayout,
    children: [
      { path: '', component: Scopes },
      { path: 'read/**', component: Reader },
      { path: ':scope', component: Scope },
      // Anything else is a mistyped URL; the index is the useful answer, not a 404 nobody wrote.
      { path: '**', redirectTo: '' },
    ],
  },
];
