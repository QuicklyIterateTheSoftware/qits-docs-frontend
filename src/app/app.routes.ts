import { Routes } from '@angular/router';
import { Reader } from './reader';
import { Scope } from './scope';
import { Scopes } from './scopes';

/**
 * Three layers, and one of them is a wildcard because a site name is not one segment.
 *
 * `read/**` captures `@qits/ui-components/-/2026.807.0` whole and the component splits it on the
 * platform's `/-/` separator; no `:param` route can, since the name's depth varies.
 *
 * `:scope` is last so it cannot shadow `read`. It is also the ONE route the service hands over
 * rather than answering: `/platform-docs/@qits` is a scope page, and the service falls through for
 * a single segment beginning with `@` precisely so this route gets it.
 */
export const routes: Routes = [
  { path: '', component: Scopes },
  { path: 'read/**', component: Reader },
  { path: ':scope', component: Scope },
  // Anything else is a mistyped URL; the index is the useful answer, not a 404 page nobody wrote.
  { path: '**', redirectTo: '' },
];
