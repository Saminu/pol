import { isIOS } from '../utils';
var cloneTouch = function (touch, boundingRect) {
    return {
        identifier: touch.identifier,
        clientX: touch.clientX - boundingRect.left,
        clientY: touch.clientY - boundingRect.top,
        screenX: touch.screenX,
        screenY: touch.screenY
    };
};
var cloneTouches = function (touches, boundingRect) {
    if (!touches)
        return undefined;
    var touchList = [];
    for (var i = 0; i < touches.length; i++) {
        var touch = touches.item(i);
        touchList[i] = cloneTouch(touch, boundingRect);
    }
    return touchList;
};
export default function createEventForwarder(viewService, callback) {
    var forwardEvent = false;
    var eventData = {
        event: UIEvent = undefined,
        forwardEvent: function () { forwardEvent = true; }
    };
    var uievent = {};
    var handleEvent = function (e) {
        var target = e.target instanceof HTMLElement ? e.target : undefined;
        var width = target && target.clientWidth;
        var height = target && target.clientHeight;
        // prevent undesired default actions over the view element
        if (e.type === 'wheel' ||
            isIOS && e.type === 'touchmove' && e.touches.length === 2)
            e.preventDefault();
        // contain our events within the view element
        e.stopPropagation();
        // if the target element is the view element or an element of similar size,
        // attempt to forward the event (webvr-polyfill makes the canvas 10px larger
        // in each dimension due to an issue with the iOS safari browser, which is why
        // we forward the event for any target that matches the viewport size up to 15px 
        // larger in either dimension)
        if (e.target === viewService.element ||
            (width && Math.abs(width - viewService.element.clientWidth) < 15 &&
                height && Math.abs(height - viewService.element.clientHeight) < 15)) {
            // If we have a uievent listener attached, then make sure the
            // app explictily asks for events to be forwarded. Otherwise,
            // automatically forward the uievents 
            if (viewService.uiEvent.numberOfListeners > 0) {
                forwardEvent = false;
                eventData.event = e;
                viewService.uiEvent.raiseEvent(eventData);
                if (!forwardEvent) {
                    // if the app doesn't want to forward the event, 
                    // stop the event propogation immediately so that even a locally-running 
                    // reality viewer cannot process the event
                    e.stopImmediatePropagation();
                    return;
                }
            }
            // prevent undesired synthetic click
            if (e.type === 'touchstart')
                e.preventDefault();
            var boundingRect = viewService.element.getBoundingClientRect();
            var touches = cloneTouches(e.touches, boundingRect);
            var changedTouches = cloneTouches(e.changedTouches, boundingRect);
            var targetTouches = cloneTouches(e.targetTouches, boundingRect);
            // Event / UI Event
            uievent.timeStamp = e.timeStamp;
            uievent.type = e.type;
            uievent.bubbles = e.bubbles;
            uievent.cancelable = e.cancelable;
            uievent.which = e.which;
            uievent.detail = e.detail;
            uievent.composed = e['composed'];
            uievent.timeStamp = e.timeStamp;
            // Mouse Event
            uievent.altKey = e.altKey;
            uievent.ctrlKey = e.ctrlKey;
            uievent.metaKey = e.metaKey;
            uievent.button = e.button;
            uievent.buttons = e.buttons;
            uievent.clientX = e.clientX - boundingRect.left;
            uievent.clientY = e.clientY - boundingRect.top;
            uievent.screenX = e.screenX;
            uievent.screenY = e.screenY;
            uievent.movementX = e.movementX;
            uievent.movementY = e.movementY;
            // Wheel Event
            uievent.deltaX = e.deltaX;
            uievent.deltaY = e.deltaY;
            uievent.deltaZ = e.deltaZ;
            uievent.deltaMode = e.deltaMode;
            uievent.wheelDelta = e.wheelDelta;
            uievent.wheelDeltaX = e.wheelDeltaX;
            uievent.wheelDeltaY = e.wheelDeltaY;
            // Touch Event
            uievent.touches = touches;
            uievent.changedTouches = changedTouches;
            uievent.targetTouches = targetTouches;
            // Pointer Events
            uievent.pointerId = e.pointerId;
            uievent.pointerType = e.pointerType;
            uievent.width = e.width;
            uievent.height = e.height;
            uievent.pressure = e.pressure;
            uievent.tiltX = e.tiltX;
            uievent.tiltY = e.tiltY;
            uievent.isPrimary = e.isPrimary;
            callback(uievent);
        }
        else {
            // if this event is not forwardable, stop propogation immediately
            e.stopImmediatePropagation();
        }
    };
    var forwardedEvent = [
        'wheel',
        'click',
        'dblclick',
        'contextmenu'
    ];
    // if (FeatureDetection.supportsPointerEvents()) {
    forwardedEvent.push('pointerenter', 'pointerleave', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel');
    // } else {
    forwardedEvent.push('mouseenter', 'mouseleave', 'mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'touchcancel');
    // }
    forwardedEvent.forEach(function (type) {
        viewService.element.addEventListener(type, handleEvent, false);
    });
}
