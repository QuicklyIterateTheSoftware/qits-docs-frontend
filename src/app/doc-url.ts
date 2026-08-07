/**
 * The `/-/` grammar, in one place.
 *
 * <p>The separator is the platform's, not this client's — the store and the service already spell a
 * versioned site `<name>/-/<version>`, and reusing it here is what makes one URL shape mean one
 * thing everywhere. It lives in its own file because the sidebar tree writes these URLs and the
 * reader reads them: two implementations of the same grammar would eventually disagree, and the
 * failure would be a blank iframe with nothing to point at.
 */

/** A read URL, taken apart. No version means "the newest", which only the version list can name. */
export interface ReadPath {
  readonly site: string;
  readonly version?: string;
}

const SEPARATOR = '/-/';

/**
 * Split `read/@qits/ui-components/-/2026.807.0` into its site and version.
 *
 * <p>The leading literal `read` is dropped, and that is not cosmetic. Under a `read/**` route
 * `ActivatedRoute.url` includes it, and leaving it in made the site `read/@qits/ui-components` —
 * which 404s, and worse, pointed the reader's iframe back at the reader, so the page rendered
 * itself inside itself until the browser gave up.
 *
 * <p>Segments rather than a string, because that is what both callers have: the reader gets
 * `UrlSegment[]` from its route, the tree splits `Router.url`.
 */
export function parseReadPath(segments: readonly string[]): ReadPath {
  const path = (segments[0] === 'read' ? segments.slice(1) : segments).join('/');
  const marker = path.indexOf(SEPARATOR);
  return marker < 0
    ? { site: path }
    : { site: path.slice(0, marker), version: path.slice(marker + SEPARATOR.length) };
}

/**
 * The router commands that open a site — the inverse of {@link parseReadPath}.
 *
 * <p>The name is SPLIT on `/` rather than passed whole. `routerLink` treats one array element as
 * one segment and percent-encodes any slash inside it, so a whole name comes out with its scope
 * separator escaped: `%2F` in the address bar of a URL a person might copy. The reader parses
 * either, but only one of them is worth showing.
 */
export function readCommands(site: string, version?: string): string[] {
  const commands = ['/read', ...site.split('/')];
  return version ? [...commands, '-', version] : commands;
}

/** `@qits` out of `@qits/ui-components`; empty for a name published without a scope. */
export function scopeOf(name: string): string {
  const slash = name.startsWith('@') ? name.indexOf('/') : -1;
  return slash > 0 ? name.slice(0, slash) : '';
}

/** `ui-components` out of `@qits/ui-components` — what a list shows when the scope is its heading. */
export function shortNameOf(name: string): string {
  const slash = name.startsWith('@') ? name.indexOf('/') : -1;
  return slash > 0 ? name.slice(slash + 1) : name;
}
