import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** One documented thing, as `/platform-docs/api/sites` reports it. */
export interface DocEntry {
  /** The full site name, e.g. `@qits/ui-components` — what a URL path carries. */
  readonly name: string;
  /** The name without its scope, e.g. `ui-components` — what a list shows. */
  readonly shortName: string;
  readonly versionCount: number;
  readonly latestVersion: string;
}

/** One scope and the docs under it. The empty scope holds names published without one. */
export interface DocScope {
  readonly scope: string;
  readonly docs: readonly DocEntry[];
}

export interface Catalog {
  readonly scopes: readonly DocScope[];
}

/** One published version of one site. */
export interface DocVersion {
  readonly version: string;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly publishedAt: string;
}

/**
 * The one thing this client fetches.
 *
 * <p>Both URLs are <b>relative</b>, which is what makes the segment a deployment decision rather
 * than a value compiled in: the document's `<base href="/platform-docs/">` resolves them, so moving
 * the service is a `baseHref` change here and a route change in the gateway, and nothing else.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  /** Everything published, grouped by scope — the service does the grouping, not this client. */
  catalog(): Observable<Catalog> {
    return this.http.get<Catalog>('api/sites');
  }

  /**
   * Every published version of one site, newest first.
   *
   * The site goes in a QUERY parameter, not the path, and that is forced rather than chosen: a name
   * carries slashes and usually a leading `@`, so a path spelling would need the same `/-/` grammar
   * the reading routes use — and `/platform-docs/<site>` is already taken by the redirect a browser
   * wants. `HttpParams` encodes it, which is what keeps `@qits/ui-components` intact.
   *
   * Ordering is the store's contract, not this client's: re-sorting here would be a second opinion
   * about which version is newest, and `latest` is defined as the first element.
   */
  versions(site: string): Observable<{ name: string; versions: DocVersion[] }> {
    return this.http.get<{ name: string; versions: DocVersion[] }>('api/versions', {
      params: new HttpParams().set('site', site),
    });
  }
}
