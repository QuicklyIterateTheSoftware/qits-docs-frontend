/**
 * The four kinds of documentation this app reads, told apart by the site's scope — the one fact
 * the publisher already states. A scope is an addressing convention, so classifying on it keeps
 * the byte plane opinion-free (the store serves files; what a bundle IS remains a reading choice,
 * which makes it this client's).
 *
 *  - `storybook` — an `index.html` site framed whole (component docs; the original kind).
 *  - `apidocs`   — an OpenAPI document under the `@apidocs` scope, rendered with swagger-ui.
 *  - `userflows` — a directory of per-story markdown under the `@userflows` scope, rendered with
 *                  a markdown library.
 *  - `guides`    — platform contracts and operating notes: hand-written markdown published from a
 *                  repository's `docs/guides`, under the `@guides` scope, rendered by the SAME
 *                  markdown renderer as userflows.
 *
 * <p>That last line is the point worth saying out loud: a fourth kind arrived and needed no fourth
 * renderer. What separates userflows from guides is who writes the markdown (a pipeline recording
 * a run, versus a person writing a contract down) and what addresses it (`@userflows` per commit,
 * `@guides` per release) — not how it is drawn. Both are a tree of `.md` under a served bundle
 * directory, so both go to `markdown-bundle.ts` and the difference stays where it belongs, in the
 * scope and in the words. A `guides` renderer forked off the userflows one would have been two
 * copies of marked/DOMPurify/mermaid wiring drifting apart over a distinction neither of them
 * draws; `rendererFor` below says the sharing once instead.
 */
export type DocKind = 'storybook' | 'apidocs' | 'userflows' | 'guides';

export const USERFLOWS_SCOPE = '@userflows';
export const APIDOCS_SCOPE = '@apidocs';
export const GUIDES_SCOPE = '@guides';

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
    shortName === repository || repository.endsWith(shortName) || shortName.startsWith(repository)
  );
}

/**
 * The sub-navigation sections, in display order: header, the route segment each is addressable
 * under (`/storybook`, `/apidocs`, `/userflows`, `/guides` — scope-prefixed like every page here),
 * a one-line description the landing page's cards carry, and — for every kind but storybook — the
 * npm scope that names it.
 *
 * <p><b>The scope lives HERE, on the section, and everything else derives it.</b> It used to be
 * written out three times in three shapes: `kindOf` matched scope prefixes in an if-ladder,
 * `navSections` in nav-tree.ts asked `section.kind === 'apidocs' ? APIDOCS_SCOPE : USERFLOWS_SCOPE`
 * for the claimed sections, and the storybook branch of that same fold listed the scopes it was
 * NOT — a `filter` naming `@apidocs` and `@userflows` one by one. Adding a kind was therefore a
 * four-place edit, and the fourth place was the dangerous one: forget the exclusion list and a
 * `@guides` site does not error, it falls quietly into Storybook, where it renders — an iframe
 * pointed at a bundle with no `index.html`, a wrong answer that looks like a working page and that
 * no type checker can see. Deriving the exclusion from "which scopes has some section claimed"
 * makes that failure unreachable: a section that declares a scope takes its docs, and storybook
 * gets exactly what is left over, by construction rather than by list maintenance.
 *
 * <p>Storybook's `scope` is `undefined` on purpose rather than a sentinel string — it is not one
 * scope, it is the complement of the others, and every scope in the wild that nobody claims is a
 * framed site.
 */
export const DOC_SECTIONS: readonly {
  kind: DocKind;
  label: string;
  route: string;
  scope?: string;
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
    scope: APIDOCS_SCOPE,
    description: 'OpenAPI documents per service, rendered with swagger-ui.',
  },
  {
    kind: 'userflows',
    label: 'Userflows',
    route: 'userflows',
    scope: USERFLOWS_SCOPE,
    description: 'Per-commit user stories with their recorded service interactions.',
  },
  {
    kind: 'guides',
    label: 'Guides',
    route: 'guides',
    scope: GUIDES_SCOPE,
    description: 'Platform contracts and operating notes.',
  },
];

/**
 * A site's kind, read off the scope its name starts with — the sections' own declarations, walked,
 * so this function has no scope literals of its own and a kind added to DOC_SECTIONS is classified
 * without editing anything here.
 *
 * <p>The `+ '/'` is the whole subtlety and it is deliberate: a bare `@userflows`, with no site
 * under it, is not a userflows document — it is a name that happens to spell a scope, and the only
 * safe reading of a name that addresses no bundle of a known kind is the unclaimed one. That
 * behaviour predates this refactor and the tests pin it.
 */
export function kindOf(site: string): DocKind {
  return (
    DOC_SECTIONS.find((section) => !!section.scope && site.startsWith(section.scope + '/'))?.kind ??
    'storybook'
  );
}

/**
 * How a kind is DRAWN — deliberately a different question from what a kind IS, and the reason the
 * reader's template has one arm per renderer rather than one per kind.
 *
 * <p>Kinds and renderers stopped being one-to-one the moment guides arrived: userflows and guides
 * are both a tree of `.md` served out of a bundle directory, so both hand the same inputs to the
 * same `<docs-markdown-bundle>`. Left as a switch on the kind, the reader would have grown a
 * second `@case` with a body copy-pasted from the first, and the next markdown kind a third — the
 * template silently becoming the place where "these render alike" is asserted, once per arm, with
 * nothing to keep the arms alike. Saying it once, here, means adding a markdown kind is a line in
 * this function and nothing in any template.
 */
export type DocRenderer = 'frame' | 'markdown' | 'swagger';

export function rendererFor(kind: DocKind): DocRenderer {
  switch (kind) {
    case 'userflows':
    case 'guides':
      return 'markdown';
    case 'apidocs':
      return 'swagger';
    default:
      return 'frame';
  }
}
