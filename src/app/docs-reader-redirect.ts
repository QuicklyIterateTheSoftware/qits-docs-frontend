import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { QitsAppLinks } from '@qits/ui-components';
import { parseReadPath } from './doc-url';

/**
 * Where the project form's and the repository form's own `read/**` route goes now that the
 * landing app grew a reader of its own (qits-2337), at
 * `/projects/<slug>/docs/read/<site>[/-/<version>]` — the project comes from the matched parent
 * route exactly as {@link ProjectDocsRedirect} reads it, and the site and version come from this
 * route's OWN url segments via `parseReadPath`, which already drops the leading `read` literal
 * that `route/**` carries.
 *
 * **The repository form drops the repository.** A reader is addressed by site, not by the
 * repository that happened to publish it — the same reason this app's own unscoped `read/**`
 * never took one — so unlike {@link ProjectDocsRedirect} this component reads only `:project` off
 * the parent chain, never `:repository`.
 *
 * **Storybook stays here, not there.** `app.routes.ts` guards this route with
 * `canMatch: [isStorybookRead]` ahead of it, so a storybook site's `read/**` never reaches this
 * component at all: the landing page's own docs screen links BACK to this app for exactly that
 * kind, which has no reader of its own there.
 *
 * `?category=` rides along unchanged when the address carried one — the sidebar's own narrowing
 * (see nav-tree.ts), kept rather than dropped so a category link copied from this app still lands
 * on the same reading after the hop.
 *
 * Everything else — the async origin, the full-document `location.replace`, the fallback template
 * — is identical to {@link ProjectDocsRedirect}; see its doc comment for why each of those is
 * shaped the way it is.
 */
@Component({
  selector: 'qits-docs-reader-redirect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      The docs moved to the landing app:
      @if (link(); as href) {
        <a [href]="href">{{ href }}</a>
      } @else {
        <span>resolving the landing app's address…</span>
      }
    </p>
  `,
})
export class DocsReaderRedirect {
  private readonly route = inject(ActivatedRoute);
  private readonly links = inject(QitsAppLinks);
  private readonly document = inject(DOCUMENT);

  /** The `:project` segment one or two levels up — always present, since only those mounts route here. */
  private readonly project = this.route.snapshot.parent?.paramMap.get('project') ?? '';

  /** This route's own url, which still carries the literal `read` first — `parseReadPath` drops it. */
  private readonly read = parseReadPath(this.route.snapshot.url.map((segment) => segment.path));

  /** The sidebar's own narrowing, carried through the hop unchanged. */
  private readonly category = this.route.snapshot.queryParamMap.get('category') ?? undefined;

  /** The landing app's reader for this site, once an origin is known. */
  protected readonly link = computed<string | undefined>(() => {
    const origin = this.links.origin('qits-landing') ?? this.links.environmentOrigin();
    if (!origin) {
      return undefined;
    }
    const version = this.read.version ? `/-/${encodeURIComponent(this.read.version)}` : '';
    const path =
      `/projects/${encodeURIComponent(this.project)}/docs/read/` +
      `${encodeSitePath(this.read.site)}${version}`;
    const search = this.category ? `?category=${encodeURIComponent(this.category)}` : '';
    return `${origin.replace(/\/+$/, '')}${path}${search}`;
  });

  constructor() {
    effect(() => {
      const link = this.link();
      if (link) {
        this.document.location.replace(link);
      }
    });
  }
}

/**
 * A site name, percent-encoded segment by segment rather than whole — a whole-string
 * `encodeURIComponent` would escape the name's own `/` separator into `%2F`, which the landing
 * app's path parser (segments after `read`, split again on `/-/`) would read as one segment, not
 * a scope and a short name. `@` is then put back: `encodeURIComponent('@')` is `%40`, and nothing
 * downstream needs it hidden, so leaving it escaped would only make a copied link harder to read.
 */
function encodeSitePath(site: string): string {
  return site
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
    .replace(/%40/g, '@');
}
