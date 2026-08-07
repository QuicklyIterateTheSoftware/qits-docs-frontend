import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

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

/** One site's version list, as `api/versions?site=…` answers it. */
export interface SiteVersions {
  readonly name: string;
  readonly versions: readonly DocVersion[];
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
 *
 * <p><b>Both answers are cached for the life of the page, and that is a correctness measure before
 * it is a saving.</b> An `HttpClient` observable is cold — one subscriber, one GET — and each of
 * these is now read by two components at once: the sidebar tree and the reader. Uncached, the two
 * would issue separate requests and could be told different things about which version is newest,
 * so the picker would name one version and the iframe would load another. Caching is safe because a
 * published bundle is immutable: a version's contents never change, and one that appears later is a
 * new entry, which the next page load picks up.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  private catalogOnce?: Observable<Catalog>;
  private readonly versionsBySite = new Map<string, Observable<SiteVersions>>();

  /**
   * Everything published, grouped by scope — the service does the grouping, not this client.
   *
   * `shareReplay` alone would not be enough: it is the *piped observable* that has to be reused, so
   * the pipeline is built once and handed out. A fresh `shareReplay` per call shares nothing.
   */
  catalog(): Observable<Catalog> {
    return (this.catalogOnce ??= this.http
      .get<Catalog>('api/sites')
      // refCount: false — the reader unsubscribing when a page is torn down must not throw the
      // answer away and make the next subscriber re-fetch it.
      .pipe(shareReplay({ bufferSize: 1, refCount: false })));
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
  versions(site: string): Observable<SiteVersions> {
    let cached = this.versionsBySite.get(site);
    if (!cached) {
      cached = this.http
        .get<SiteVersions>('api/versions', { params: new HttpParams().set('site', site) })
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.versionsBySite.set(site, cached);
    }
    return cached;
  }
}
