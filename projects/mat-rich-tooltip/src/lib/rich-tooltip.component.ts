import {
  CdkConnectedOverlay,
  ConnectedOverlayPositionChange,
  ConnectedPosition,
  FlexibleConnectedPositionStrategy,
  OverlayModule,
} from '@angular/cdk/overlay';
import {
  ComponentPortal,
  Portal,
  PortalModule,
  TemplatePortal,
} from '@angular/cdk/portal';
import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  inject,
  model,
  TemplateRef,
  Type,
  ViewContainerRef,
  OnDestroy,
  ANIMATION_MODULE_TYPE,
  viewChild,
  NgZone,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Observable, Subject } from 'rxjs';
import { RichTooltipBehavior } from './types';
import { MenuPositionX, MenuPositionY } from '@angular/material/menu';

let richTooltipPanelUid = 0;

export const defaultPositionList: ConnectedPosition[] = [
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
  },
  {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'top',
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
  },
  {
    originX: 'end',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'bottom',
  },
];

@Component({
  selector: 'mat-rich-tooltip',
  templateUrl: 'rich-tooltip.component.html',
  standalone: true,
  imports: [
    OverlayModule,
    PortalModule,
    MatCardModule,
    NgClass,
    MatButtonModule,
  ],
})
export class RichTooltipComponent implements OnDestroy {
  _trigger: HTMLElement | null | undefined;
  _content: Type<any> | TemplateRef<any> | undefined;

  tooltipClassList: { [key: string]: boolean } = {};
  _positions = defaultPositionList;

  private viewContainerRef = inject(ViewContainerRef);
  cdkConnectedOverlay = viewChild(CdkConnectedOverlay);
  /** Name of the show animation and the class that toggles it. */
  private readonly _showAnimation = 'mat-mdc-tooltip-show';

  /** Name of the hide animation and the class that toggles it. */
  private readonly _hideAnimation = 'mat-mdc-tooltip-hide';

  private readonly _transientClass = 'rich-tooltip-transient';

  private readonly _persistentClass = 'rich-tooltip-persistent';

  /** Subject for notifying that the tooltip has been hidden from the view */
  private readonly _onHide: Subject<void> = new Subject();

  /** The timeout ID of any current timer set to show the tooltip */
  private _showTimeoutId: ReturnType<typeof setTimeout> | undefined;

  /** The timeout ID of any current timer set to hide the tooltip */
  private _hideTimeoutId: ReturnType<typeof setTimeout> | undefined;

  /** Whether animations are currently disabled. */
  private _animationsDisabled =
    inject(ANIMATION_MODULE_TYPE) === 'NoopAnimations';

  /** Whether the tooltip is currently visible. */
  private _isVisible = false;
  private readonly _destroyed = new Subject<void>();
  /** Amount of milliseconds to delay the closing sequence. */
  private _ngZone = inject(NgZone);
  _mouseLeaveHideDelay: number | undefined;
  _behavior: RichTooltipBehavior = 'transient';
  _positionStrategy: FlexibleConnectedPositionStrategy | undefined;
  readonly panelId = `rich-tooltip-panel-${richTooltipPanelUid++}`;

  selectedPortal = computed<Portal<any> | null>(() => {
    const content = this._content;
    if (content) {
      if (content instanceof TemplateRef) {
        return new TemplatePortal(content, this.viewContainerRef);
      } else if (typeof content === 'function') {
        return new ComponentPortal(content, this.viewContainerRef);
      }
    }

    return null;
  });

  get positions() {
    const triggerOffsetWidth = this._trigger?.offsetWidth ?? 8;

    return this._positions.map((position) => {
      if (position.originX === 'start') {
        position.offsetX = triggerOffsetWidth;
      }
      if (position.originX === 'end') {
        position.offsetX = -triggerOffsetWidth;
      }
      return position;
    });
  }

  /**
   * Shows the tooltip with an animation originating from the provided origin
   * @param delay Amount of milliseconds to the delay showing the tooltip.
   */
  show(delay: number): void {
    // Cancel the delayed hide if it is scheduled
    if (this._hideTimeoutId != null) {
      clearTimeout(this._hideTimeoutId);
    }

    this._showTimeoutId = setTimeout(() => {
      this._toggleVisibility(true);
      this._showTimeoutId = undefined;
    }, delay);
  }

  /**
   * Begins the animation to hide the tooltip after the provided delay in ms.
   * @param delay Amount of milliseconds to delay showing the tooltip.
   */
  hide(delay = 1500): void {
    // Cancel the delayed show if it is scheduled
    if (this._showTimeoutId != null) {
      clearTimeout(this._showTimeoutId);
    }

    this._hideTimeoutId = setTimeout(() => {
      this._toggleVisibility(false);
      this._hideTimeoutId = undefined;
    }, delay);
  }

  /** Returns an observable that notifies when the tooltip has been hidden from view. */
  afterHidden(): Observable<void> {
    return this._onHide;
  }

  /** Whether the tooltip is being displayed. */
  isVisible(): boolean {
    return this._isVisible;
  }

  ngOnDestroy() {
    this._cancelPendingAnimations();
    this._onHide.complete();
    this._trigger = null;
    this._destroyed.next();
    this._destroyed.complete();
  }

  /** Event listener dispatched when an animation on the tooltip finishes. */
  _handleAnimationEnd({ animationName }: AnimationEvent) {
    if (
      animationName === this._showAnimation ||
      animationName === this._hideAnimation
    ) {
      this._finalizeAnimation(animationName === this._showAnimation);
    }
  }

  _handleMouseLeave({ relatedTarget }: MouseEvent) {
    if (
      this._behavior === 'transient' &&
      (!relatedTarget ||
        !(this._trigger as HTMLElement).contains(relatedTarget as Node))
    ) {
      if (this.isVisible()) {
        this.hide(this._mouseLeaveHideDelay);
      } else {
        this._finalizeAnimation(false);
      }
    }
  }

  /** Cancels any pending animation sequences. */
  _cancelPendingAnimations() {
    if (this._showTimeoutId != null) {
      clearTimeout(this._showTimeoutId);
    }

    if (this._hideTimeoutId != null) {
      clearTimeout(this._hideTimeoutId);
    }

    this._showTimeoutId = this._hideTimeoutId = undefined;
  }

  _handlePositionChange(change: ConnectedOverlayPositionChange) {
    const posX: MenuPositionX =
      change.connectionPair.overlayX === 'start' ? 'after' : 'before';
    const posY: MenuPositionY =
      change.connectionPair.overlayY === 'top' ? 'below' : 'above';
    this.setPositionClasses(posX, posY);

    if (change.scrollableViewProperties.isOverlayClipped && this.isVisible()) {
      // After position changes occur and the overlay is clipped by
      // a parent scrollable then close the tooltip.
      this._ngZone.run(() => this.hide(0));
    } else {
      if (this._ngZone) {
        this._ngZone.run(() => this.setPositionClasses(posX, posY));
      } else {
        this.setPositionClasses(posX, posY);
      }
    }
  }

  /**
   * Adds classes to the menu panel based on its position. Can be used by
   * consumers to add specific styling based on the position.
   * @param posX Position of the menu along the x axis.
   * @param posY Position of the menu along the y axis.
   * @docs-private
   */
  setPositionClasses(posX: MenuPositionX, posY: MenuPositionY) {
    this.tooltipClassList = {
      ...this.tooltipClassList,
      ['rich-tooltip-before']: posX === 'before',
      ['rich-tooltip-after']: posX === 'after',
      ['rich-tooltip-above']: posY === 'above',
      ['rich-tooltip-below']: posY === 'below',
    };
  }

  /** Handles the cleanup after an animation has finished. */
  private _finalizeAnimation(toVisible: boolean) {
    if (!toVisible && !this.isVisible()) {
      this._onHide.next();
    }
  }

  /** Toggles the visibility of the tooltip element. */
  private _toggleVisibility(isVisible: boolean) {
    const showClass = this._showAnimation;
    const hideClass = this._hideAnimation;
    const transientClass = this._transientClass;
    const persistentClass = this._persistentClass;
    this.tooltipClassList = {
      ...this.tooltipClassList,
      [hideClass]: !isVisible,
      [showClass]: isVisible,
      [transientClass]: this._behavior === 'transient',
      [persistentClass]: this._behavior === 'persistent',
    };
    if (this._isVisible !== isVisible) {
      this._isVisible = isVisible;
    }

    if (this._animationsDisabled) {
      this.tooltipClassList = {
        ...this.tooltipClassList,
        '_mat-animation-noopable': true,
      };
      this._finalizeAnimation(isVisible);
    }
  }
}
