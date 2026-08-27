/**
 * The three kinds of documentation this app reads, told apart by the site's scope — the one fact
 * the publisher already states. A scope is an addressing convention, so classifying on it keeps
 * the byte plane opinion-free (the store serves files; what a bundle IS remains a reading choice,
 * which makes it this client's).
 *
 *  - `storybook` — an `index.html` site framed whole (component docs; the original kind).
 *  - `apidocs`   — an OpenAPI document under the `@apidocs` scope, rendered with swagger-ui.
 *  - `userflows` — a directory of per-story markdown under the `@userflows` scope, rendered with
 *                  a markdown library.
 */
export type DocKind = 'storybook' | 'apidocs' | 'userflows';

export const USERFLOWS_SCOPE = '@userflows';
export const APIDOCS_SCOPE = '@apidocs';

export function kindOf(site: string): DocKind {
  if (site.startsWith(USERFLOWS_SCOPE + '/')) {
    return 'userflows';
  }
  if (site.startsWith(APIDOCS_SCOPE + '/')) {
    return 'apidocs';
  }
  return 'storybook';
}

/**
 * The sub-navigation sections, in display order: header, the route segment each is addressable
 * under (`/storybook`, `/apidocs`, `/userflows` — scope-prefixed like every page here), and a
 * one-line description the landing page's cards carry.
 */
export const DOC_SECTIONS: readonly {
  kind: DocKind;
  label: string;
  route: string;
  description: string;
}[] = [
  {
    kind: 'storybook',
    label: 'Storybook',
    route: 'storybook',
    description: 'Component workbenches and other published sites, framed whole.',
  },
  {
    kind: 'apidocs',
    label: 'API docs',
    route: 'apidocs',
    description: 'OpenAPI documents per service, rendered with swagger-ui.',
  },
  {
    kind: 'userflows',
    label: 'Userflows',
    route: 'userflows',
    description: 'Per-commit user stories with their recorded service interactions.',
  },
];
