import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { QitsAppLinks } from '@qits/ui-components';

/**
 * Where the project form's own landing page and section pages go now that the landing app grew a
 * docs screen of its own, at `/projects/<slug>/docs` — the full catalog for that project, the
 * section narrowing it with `?section=<route>` exactly as this app's own `DOC_SECTIONS` names it
 * (qits-2318). `read/**` is untouched: the reader stays this application's own, under both forms.
 *
 * The repository form (`:project/:group/:repository`) mounts this same component now, for the same
 * two children (qits-2336): `/projects/<slug>/docs/repositories/<repository>`, again narrowed with
 * `?section=<route>`. One component serves both forms because the address differs only by whether
 * a `:repository` segment is there to add — everything else, including the wait for an origin and
 * the full-document navigation, is identical.
 *
 * **The project and repository come from the parent route, not from `QITS_SCOPE`.** Every page this
 * component replaces used to read the address through that token, which also has to parse the
 * repository form and wait on the project list. This page has nothing to wait for — it is leaving
 * the moment an origin for the landing app is known — so it reads `:project` (and, under the
 * repository form, `:repository`) off the parent route's `paramMap` directly: for the project form
 * that parent is the `:project` mount, and for the repository form it is the single
 * `:project/:group/:repository` route both of its own children (`''` and each section route) sit
 * under, which carries all three params on that one snapshot.
 *
 * **The destination's origin is an async answer, and this screen waits for it rather than
 * guessing.** `QitsAppLinks.origin('qits-landing')` and its `environmentOrigin()` fallback both
 * come from the platform's navigation, fetched after this application started, so `link` is
 * `undefined` until one of them resolves — and stays that way forever on a platform that never
 * answers. A relative address would be wrong on every host but this one, so there is no fallback
 * that guesses it.
 *
 * **A full-document navigation, not a router one.** The destination is a different application
 * entirely, so `Router.navigate` would compile a route this SPA does not have and go nowhere;
 * `document.location.replace` leaves no entry for the back button to return to this redirect.
 */
@Component({
  selector: 'qits-docs-project-redirect',
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
export class ProjectDocsRedirect {
  private readonly route = inject(ActivatedRoute);
  private readonly links = inject(QitsAppLinks);
  private readonly document = inject(DOCUMENT);

  /** The `:project` segment one level up — always present, since only that mount routes here. */
  private readonly project = this.route.snapshot.parent?.paramMap.get('project') ?? '';

  /**
   * The `:repository` segment one level up, when there is one — present under the repository
   * form's `:project/:group/:repository` parent, absent under the project form's `:project` one.
   */
  private readonly repository = this.route.snapshot.parent?.paramMap.get('repository') ?? undefined;

  /** The section route segment declared on this route's own data, or `undefined` at `''`. */
  private readonly section = this.route.snapshot.data['section'] as string | undefined;

  /** The landing app's docs screen for this project, or this repository, once an origin is known. */
  protected readonly link = computed<string | undefined>(() => {
    const origin = this.links.origin('qits-landing') ?? this.links.environmentOrigin();
    if (!origin) {
      return undefined;
    }
    const path = this.repository
      ? `/projects/${encodeURIComponent(this.project)}/docs/repositories/${encodeURIComponent(this.repository)}`
      : `/projects/${encodeURIComponent(this.project)}/docs`;
    const search = this.section ? `?section=${encodeURIComponent(this.section)}` : '';
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
