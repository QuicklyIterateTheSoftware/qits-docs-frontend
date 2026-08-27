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

/** The branch a version was published from, when its publisher recorded one. */
export function branchOf(version: {
  readonly metadata?: Readonly<Record<string, string>>;
}): string | undefined {
  return version.metadata?.['git.branch.name'];
}

/** The distinct branches of a version list, in list (newest-first) order, unbranched skipped. */
export function distinctBranches(
  versions: readonly { readonly metadata?: Readonly<Record<string, string>> }[],
): string[] {
  const seen: string[] = [];
  for (const version of versions) {
    const branch = branchOf(version);
    if (branch && !seen.includes(branch)) {
      seen.push(branch);
    }
  }
  return seen;
}

/**
 * Whether a site is a repository's own, matched on the short name — the part after the npm scope —
 * because no field on either side records the link. Three spellings occur in the wild: the exact
 * name (`@userflows/qits-githost` from qits-githost), a repository whose name carries a prefix the
 * site drops (`@qits/ui-components` from qits-spa-ui-components), and a site that extends its
 * repository's name (`qits-cli-bootstrap` from qits-cli). A heuristic, said out loud — and under a
 * repository scope a missed match must read as "nothing published", never as someone else's docs.
 */
export function siteBelongsToRepository(shortName: string, repository: string): boolean {
  return (
    shortName === repository ||
    repository.endsWith(shortName) ||
    shortName.startsWith(repository)
  );
}

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
