import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { QitsNavSubmenu } from '@qits/ui-components';
import { DocsNavTree } from './nav-tree';

/**
 * The shell: an outlet, and the catalog offered to the chrome as a sub-menu.
 *
 * <p><b>Declared here, rendered somewhere else, and that is the only arrangement available.</b>
 * `QitsMainLayout` is a route component — the pages are inside <i>its</i> outlet, and this shell is
 * outside it — so nothing can be projected upwards into the sidebar. The template is handed over
 * instead, and the layout renders it under whichever navigation entry is this application. Since
 * the gateway serves a `Docs` entry, that is the Docs entry; with no matching entry it goes to the
 * foot of the nav rather than nowhere.
 *
 * <p><b>The shell rather than a page</b>, and that part is a correctness one. `RouterOutlet`
 * destroys the outgoing component after creating the incoming one, so a declaration inside a page
 * is torn down and rebuilt on every hop — the tree would lose its scroll position and every open
 * group each time a reader opened a document, in a menu that did not itself change. Here it is
 * built once at bootstrap and never destroyed.
 *
 * <p>This is also what retired the reader's own rail. There was one navigation column too many —
 * the platform's, the reader's, and Storybook's inside the iframe — and now there is one.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, QitsNavSubmenu, DocsNavTree],
  template: `
    <ng-template qitsNavSubmenu><docs-nav-tree /></ng-template>
    <router-outlet />
  `,
})
export class App {}
