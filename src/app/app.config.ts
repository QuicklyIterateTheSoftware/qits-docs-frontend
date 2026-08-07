import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideQitsNavigation } from '@qits/ui-components';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // NO withComponentInputBinding(), and that is not a preference. It binds route params to a
    // ROUTE COMPONENT's inputs — and for an input with no matching param it writes `undefined`,
    // wiping the component's own default. QitsMainLayout is a route component here, so its `brand`
    // and `links` defaults were erased and its navLinks computed died on `undefined.map`: the shell
    // rendered with an empty sidebar and no page inside it. Components here read the route
    // directly instead, which is what Reader already had to do — a site name spans segments, so no
    // `:param` could carry it anyway.
    // The layout's `links` now defaults to `[]` and it treats an empty list as "ask the provider",
    // so the same mistake today produces a nav with no links rather than a crash. Quieter, not
    // fixed — the reason to leave this off is unchanged.
    provideRouter(routes),
    // withFetch, because this client makes two ordinary GETs and has no use for the XHR backend's
    // interceptor surface.
    provideHttpClient(withFetch()),
    // The sidebar's links come from the gateway's /main-navigation rather than a list compiled into
    // ui-components, which would be a second source of truth for the platform's own topology. Needs
    // the HttpClient above, which is why it is written after it.
    provideQitsNavigation(),
  ],
};
