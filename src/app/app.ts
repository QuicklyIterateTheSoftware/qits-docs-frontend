import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * The shell, and it is deliberately nothing but an outlet.
 *
 * The reader takes the whole viewport — its own rail plus the bundle's iframe — so a chrome here
 * would be a third navigation on a page that already has two. The index pages carry their own
 * heading and breadcrumb instead.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
