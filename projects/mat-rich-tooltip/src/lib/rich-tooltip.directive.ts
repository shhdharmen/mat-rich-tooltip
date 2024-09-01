import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  Directive,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
  TemplateRef,
  Type,
  OnDestroy,
  AfterViewInit,
  Input,
  effect,
  isDevMode,
} from '@angular/core';
import { RichTooltipComponent } from './rich-tooltip.component';
import { Subject, takeUntil } from 'rxjs';
import { FocusMonitor } from '@angular/cdk/a11y';
import {
  BooleanInput,
  coerceBooleanProperty,
  coerceNumberProperty,
  NumberInput,
} from '@angular/cdk/coercion';
import {
  normalizePassiveListenerOptions,
  Platform,
} from '@angular/cdk/platform';
import { TooltipTouchGestures } from '@angular/material/tooltip';
import { DOCUMENT } from '@angular/common';
import { RichTooltipBehavior } from './types';
import {
  HorizontalConnectionPos,
  VerticalConnectionPos,
} from '@angular/cdk/overlay';
import { MenuPositionX, MenuPositionY } from '@angular/material/menu';
import {
  throwRichTooltipInvalidPositionX,
  throwRichTooltipInvalidPositionY,
} from './rich-tooltip-errors';

/** Options used to bind passive event listeners. */
const passiveListenerOptions = normalizePassiveListenerOptions({
  passive: true,
});

@Directive({
  selector: '[matRichTooltip]',
  standalone: true,
  exportAs: 'matRichTooltip',
  host: {
    '[attr.aria-haspopup]': '_richTooltipInstance ? "true" : null',
    '[attr.aria-expanded]': '_isTooltipVisible()',
    '[attr.aria-controls]': '_isTooltipVisible() ? _richTooltipInstance.panelId : null',
  },
})
export class RichTooltipDirective implements OnDestroy, AfterViewInit {
  matRichTooltip = input.required<Type<any> | TemplateRef<any> | undefined>();
  behavior = input<RichTooltipBehavior>('transient', {
    alias: 'matRichTooltipBehavior',
  });

  /** Disables the display of the tooltip. */
  @Input('matRichTooltipDisabled')
  get disabled(): boolean {
    return this._disabled;
  }

  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);

    // If tooltip is disabled, hide immediately.
    if (this._disabled) {
      this.hide();
    } else {
      this._setupPointerEnterEventsIfNeeded();
    }
  }

  @Input('matRichTooltipTouchGestures') touchGestures: TooltipTouchGestures =
    'auto';

  /** The default delay in ms before hiding the tooltip after hide is called */
  @Input('matRichTooltipHideDelay')
  get hideDelay(): number {
    return this._hideDelay;
  }

  set hideDelay(value: NumberInput) {
    this._hideDelay = coerceNumberProperty(value);

    if (this._richTooltipInstance) {
      this._richTooltipInstance._mouseLeaveHideDelay = this._hideDelay;
    }
  }

  private _xPosition: MenuPositionX = 'after';
  private _yPosition: MenuPositionY = 'below';
  /** Position of the menu in the X axis. */
  @Input('matRichTooltipXPosition')
  get xPosition(): MenuPositionX {
    return this._xPosition;
  }
  set xPosition(value: MenuPositionX) {
    if (value !== 'before' && value !== 'after' && isDevMode()) {
      throwRichTooltipInvalidPositionX();
    }
    this._xPosition = value;
    this._richTooltipInstance?.setPositionClasses(
      this.xPosition,
      this.yPosition
    );
  }

  /** Position of the menu in the Y axis. */
  @Input('matRichTooltipYPosition')
  get yPosition(): MenuPositionY {
    return this._yPosition;
  }
  set yPosition(value: MenuPositionY) {
    if (value !== 'above' && value !== 'below' && isDevMode()) {
      throwRichTooltipInvalidPositionY();
    }
    this._yPosition = value;
    this._richTooltipInstance?.setPositionClasses(
      this.xPosition,
      this.yPosition
    );
  }

  private _hideDelay = 0;

  private _environmentInjector = inject(EnvironmentInjector);
  private _appRef = inject(ApplicationRef);
  private _componentRef: ComponentRef<RichTooltipComponent> | undefined;
  private _focusMonitor = inject(FocusMonitor);
  private _elementRef = inject<ElementRef<HTMLElement>>(
    ElementRef<HTMLElement>
  );
  /** Emits when the component is destroyed. */
  private readonly _destroyed = new Subject<void>();
  private _viewInitialized = false;
  private _disabled = false;
  /** Manually-bound passive event listeners. */
  private readonly _passiveListeners: (readonly [
    string,
    EventListenerOrEventListenerObject
  ])[] = [];
  private _platform = inject(Platform);
  private _pointerExitEventsInitialized = false;
  private _document = inject(DOCUMENT);
  /** Timer started at the last `touchstart` event. */
  private _touchstartTimeout: ReturnType<typeof setTimeout> | undefined;
  _richTooltipInstance: RichTooltipComponent | null | undefined;

  show() {
    if (this.disabled || !this.matRichTooltip() || this._isTooltipVisible()) {
      this._richTooltipInstance?._cancelPendingAnimations();
      return;
    }

    this._componentRef = createComponent(RichTooltipComponent, {
      environmentInjector: this._environmentInjector,
    });
    const instance = (this._richTooltipInstance = this._componentRef.instance);
    instance._trigger = this._elementRef.nativeElement;
    instance._content = this.matRichTooltip();
    instance._behavior = this.behavior();
    instance._mouseLeaveHideDelay = this._hideDelay;
    this._setPosition();
    this._appRef.attachView(this._componentRef.hostView);
    instance.show(0);

    instance
      .afterHidden()
      .pipe(takeUntil(this._destroyed))
      .subscribe(() => {
        this.cleanup();
      });
  }

  private cleanup() {
    if (this._componentRef) {
      const hostView = this._componentRef.hostView;

      if (hostView) {
        this._appRef.detachView(hostView);
      }

      this._componentRef.destroy();
    }
    this._componentRef = undefined;
  }

  hide(delay: number = this.hideDelay) {
    this._richTooltipInstance?.hide(delay);
  }

  toggle() {
    if (this._isTooltipVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  constructor() {
    effect(() => {
      const behavior = this.behavior();
      if (this._richTooltipInstance) {
        this._richTooltipInstance._behavior = behavior;
      }
    });
  }

  /** Returns true if the tooltip is currently visible to the user */
  _isTooltipVisible(): boolean {
    return !!this._richTooltipInstance && this._richTooltipInstance.isVisible();
  }

  ngAfterViewInit() {
    this._viewInitialized = true;
    this._setupPointerEnterEventsIfNeeded();
  }

  /**
   * Dispose the tooltip when destroyed.
   */
  ngOnDestroy() {
    const nativeElement = this._elementRef.nativeElement;

    this.cleanup();

    // Clean up the event listeners set in the constructor
    this._passiveListeners.forEach(([event, listener]) => {
      nativeElement.removeEventListener(
        event,
        listener,
        passiveListenerOptions
      );
    });
    this._passiveListeners.length = 0;

    this._destroyed.next();
    this._destroyed.complete();

    this._focusMonitor.stopMonitoring(nativeElement);
  }

  private _setupPointerEnterEventsIfNeeded() {
    // Optimization: Defer hooking up events if there's no message or the tooltip is disabled.
    if (
      this._disabled ||
      !this.matRichTooltip() ||
      !this._viewInitialized ||
      this._passiveListeners.length
    ) {
      return;
    }

    // The mouse events shouldn't be bound on mobile devices, because they can prevent the
    // first tap from firing its click event or can cause the tooltip to open for clicks.
    if (this._platformSupportsMouseEvents()) {
      if (this.behavior() === 'transient') {
        this._passiveListeners.push([
          'mouseenter',
          () => {
            this._setupPointerExitEventsIfNeeded();
            this.show();
          },
        ]);
        this._passiveListeners.push([
          'focus',
          () => {
            this._setupPointerExitEventsIfNeeded();
            this.show();
          },
        ]);
      } else {
        this._passiveListeners.push([
          'click',
          () => {
            if (this._isTooltipVisible()) {
              this.hide();
            } else {
              this.show();
            }
          },
        ]);
      }
    } else if (this.touchGestures !== 'off') {
      this._disableNativeGesturesIfNecessary();

      this._passiveListeners.push([
        'touchstart',
        () => {
          // Note that it's important that we don't `preventDefault` here,
          // because it can prevent click events from firing on the element.
          this._setupPointerExitEventsIfNeeded();
          clearTimeout(this._touchstartTimeout);

          const DEFAULT_LONGPRESS_DELAY = 500;
          this._touchstartTimeout = setTimeout(
            () => this.show(),
            DEFAULT_LONGPRESS_DELAY
          );
        },
      ]);
    }

    this._addListeners(this._passiveListeners);
  }

  private _platformSupportsMouseEvents() {
    return !this._platform.IOS && !this._platform.ANDROID;
  }

  private _setupPointerExitEventsIfNeeded() {
    if (this._pointerExitEventsInitialized) {
      return;
    }
    this._pointerExitEventsInitialized = true;

    const exitListeners: (readonly [
      string,
      EventListenerOrEventListenerObject
    ])[] = [];
    if (this._platformSupportsMouseEvents()) {
      exitListeners.push(
        [
          'mouseleave',
          (event) => {
            const newTarget = (event as MouseEvent)
              .relatedTarget as Node | null;
            if (
              !newTarget ||
              !this._richTooltipInstance
                ?.cdkConnectedOverlay()
                ?.overlayRef.overlayElement?.contains(newTarget)
            ) {
              this.hide();
            }
          },
        ],
        [
          'blur',
          (event) => {
            const newTarget = (event as MouseEvent)
              .relatedTarget as Node | null;
            if (
              !newTarget ||
              !this._richTooltipInstance
                ?.cdkConnectedOverlay()
                ?.overlayRef.overlayElement?.contains(newTarget)
            ) {
              this.hide();
            }
          },
        ],
        ['wheel', (event) => this._wheelListener(event as WheelEvent)]
      );
    } else if (this.touchGestures !== 'off') {
      this._disableNativeGesturesIfNecessary();
      const touchendListener = () => {
        clearTimeout(this._touchstartTimeout);
        this.hide();
      };

      exitListeners.push(
        ['touchend', touchendListener],
        ['touchcancel', touchendListener]
      );
    }

    this._addListeners(exitListeners);
    this._passiveListeners.push(...exitListeners);
  }

  /** Listener for the `wheel` event on the element. */
  private _wheelListener(event: WheelEvent) {
    if (this._isTooltipVisible()) {
      const elementUnderPointer = this._document.elementFromPoint(
        event.clientX,
        event.clientY
      );
      const element = this._elementRef.nativeElement;

      // On non-touch devices we depend on the `mouseleave` event to close the tooltip, but it
      // won't fire if the user scrolls away using the wheel without moving their cursor. We
      // work around it by finding the element under the user's cursor and closing the tooltip
      // if it's not the trigger.
      if (
        elementUnderPointer !== element &&
        !element.contains(elementUnderPointer)
      ) {
        this.hide();
      }
    }
  }

  /** Disables the native browser gestures, based on how the tooltip has been configured. */
  private _disableNativeGesturesIfNecessary() {
    const gestures = this.touchGestures;

    if (gestures !== 'off') {
      const element = this._elementRef.nativeElement;
      const style = element.style;

      // If gestures are set to `auto`, we don't disable text selection on inputs and
      // textareas, because it prevents the user from typing into them on iOS Safari.
      if (
        gestures === 'on' ||
        (element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA')
      ) {
        style.userSelect =
          (style as any).msUserSelect =
          style.webkitUserSelect =
          (style as any).MozUserSelect =
            'none';
      }

      // If we have `auto` gestures and the element uses native HTML dragging,
      // we don't set `-webkit-user-drag` because it prevents the native behavior.
      if (gestures === 'on' || !element.draggable) {
        (style as any).webkitUserDrag = 'none';
      }

      style.touchAction = 'none';
      (style as any).webkitTapHighlightColor = 'transparent';
    }
  }

  private _addListeners(
    listeners: (readonly [string, EventListenerOrEventListenerObject])[]
  ) {
    listeners.forEach(([event, listener]) => {
      this._elementRef.nativeElement.addEventListener(
        event,
        listener,
        passiveListenerOptions
      );
    });
  }

  /**
   * Sets the appropriate positions on a position strategy
   * so the overlay connects with the trigger correctly.
   */
  private _setPosition() {
    const [originX, originFallbackX]: HorizontalConnectionPos[] =
      this.xPosition === 'before' ? ['end', 'start'] : ['start', 'end'];

    const [overlayY, overlayFallbackY]: VerticalConnectionPos[] =
      this.yPosition === 'above' ? ['bottom', 'top'] : ['top', 'bottom'];

    const [originY, originFallbackY] = [overlayFallbackY, overlayY];
    const [overlayX, overlayFallbackX] = [originX, originFallbackX];

    if (this._richTooltipInstance) {
      this._richTooltipInstance._positions = [
        { originX, originY, overlayX, overlayY },
        {
          originX: originFallbackX,
          originY,
          overlayX: overlayFallbackX,
          overlayY,
        },
        {
          originX,
          originY: originFallbackY,
          overlayX,
          overlayY: overlayFallbackY,
        },
        {
          originX: originFallbackX,
          originY: originFallbackY,
          overlayX: overlayFallbackX,
          overlayY: overlayFallbackY,
        },
      ];
    }
  }
}
