import { Component } from '@angular/core';

@Component({
  selector: 'mat-rich-tooltip-content',
  template: `
    <div class="rich-tooltip-content">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
})
export class RickTooltipContentComponent {}

@Component({
  selector: 'mat-rich-tooltip-subhead',
  template: `
    <div class="rich-tooltip-subhead">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
})
export class RickTooltipSubheadComponent {}

@Component({
  selector: 'mat-rich-tooltip-supporting-text',
  template: `
    <div class="rich-tooltip-supporting-text">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
})
export class RickTooltipSupportingTextComponent {}

@Component({
  selector: 'mat-rich-tooltip-actions',
  template: `
    <div class="rich-tooltip-actions">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
})
export class RickTooltipActionsComponent {}
