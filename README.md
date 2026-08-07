# qits-platform-spa-docs

The client for **qits-platform-docs** — the platform's reading room. Three layers over one store:

    /platform-docs/                          what publishes documentation
    /platform-docs/@qits                     what that scope publishes
    /platform-docs/read/<site>/-/<version>   one bundle, with a version picker beside it

Angular 21.2, standalone, no SSR, `baseHref: /platform-docs/`. Served by Quinoa from
qits-platform-docs at `src/main/webui`; this repository is a submodule there and in the
superproject at `frontends/qits-platform-spa-docs`.

    npm ci && npm run build      # needs the platform's npm registry — see .npmrc

## The two things worth knowing

**The reader shows two navigations side by side, and that is the arrangement.** A documentation
bundle is a whole application — Storybook ships its own full-height sidebar — so this client cannot
put the version picker inside it and must not try. It owns a narrow rail on the far left (where you
are, which version you are reading) and hands the rest to the bundle in an `<iframe>`. The iframe is
for the same reason: the bundle brings its own router, styles and keyboard handling.

**A site name is not one URL segment.** `@qits/ui-components` is two, and depth varies, so
`read/**` is a wildcard route and the component splits the path on `/-/` — the same separator the
service and the store use, so one URL shape means one thing everywhere.

## Its dependency on @qits/ui-components

The version picker is `QitsPicker`. **This client currently depends on the `main` dist-tag**
(`…-main.g<sha>`) rather than `latest`, because the picker landed after the last release and
`latest` predates it. A ui-components release moves it to `latest`, and this dependency becomes an
ordinary range again — a one-line change.
