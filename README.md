# qits-spa-docs

The client for **qits-docs** — the platform's reading room. Two pages over one store, each
addressable twice:

    /                                          the door sign
    /read/<site>/-/<version>                   one bundle, in a frame
    /<slug>/<category>/<repo>/                 one repository's documentation
    /<slug>/<category>/<repo>/read/<site>/…    the same bundle, in that scope

Angular 21.2, standalone, no SSR, `baseHref: /`. Served by Quinoa from qits-docs at
`src/main/webui`, at the **root of the docs host** (`docs.<env>.<domain>`); this repository is a
submodule there and in the superproject at `frontends/qits-spa-docs`.

    npm ci && npm run build      # needs the platform's npm registry — see .npmrc

## The two things worth knowing

**There is one left navigation, and it is the platform's.** The catalog — scopes, sites, and the
version picker under whichever site is open — is a *sub-menu* hung under this application's entry in
`QitsMainLayout`'s sidebar (`nav-tree.ts`, offered through `<ng-template qitsNavSubmenu>` in
`app.ts`). It used to be a 230px rail of the reader's own beside the frame, which made three
navigation columns on one page: the platform's, the rail, and Storybook's inside the iframe. The
reader is now the frame and nothing else. The frame stays an `<iframe>` for the original reason: a
documentation bundle brings its own router, styles and keyboard handling.

The template is declared in the app shell and rendered in the sidebar because nothing can be
projected the other way — `QitsMainLayout` is a route component, so the pages are inside *its*
outlet. The shell rather than a page, because a page's declaration is destroyed and rebuilt on every
navigation and the tree would lose its scroll position each time someone opened a document.

**A site name is not one URL segment.** `@qits/ui-components` is two, and depth varies, so
`read/**` is a wildcard route and `doc-url.ts` splits the path on `/-/` — the same separator the
service and the store use, so one URL shape means one thing everywhere. That file is the only place
the grammar is written: the tree builds these URLs and the reader takes them apart, and two
implementations would eventually disagree.

**The scope is the address, and the pages read it rather than their route params.** `app.routes.ts`
mounts the same two children twice — once at the root, once under
`:project/:category/:repository` guarded on the category — so there is exactly one component per
page and `app.routes.spec.ts` pins that. `readCommands` takes the scope prefix as an argument, which
is what keeps a link written inside a repository from dropping out of it, and `catalog.ts` asks for
`/docs/api/...` absolutely: relative would resolve against whatever scoped page the reader is on.

## Its dependency on @qits/ui-components

`QitsPicker`, `QitsNavSubmenu` and `provideQitsNavigation()`, from an **ordinary `^` range** on a
released version.

It was briefly an *exact* pin on a `main` prerelease (`…-main.g<sha>`), because the sub-menu slot
and the fetched navigation landed after the last release. That is worth remembering rather than
deleting, because the caret was the trap: `^X-main.gSHA` also admits the plain `X` the release
publishes, npm prefers the higher one, and that release predates everything this client imports —
so the build fails with "has no exported member QitsPicker", from a range that looks like it asked
for the newer thing. Pin a prerelease exactly, or not at all. The full account is in
`@qits/ui-components`' own README under *Install*.
