var eventSynthesizerFunction;
function getEventSynthesizier() {
    if (eventSynthesizerFunction)
        return eventSynthesizerFunction;
    var currentMouseTarget;
    var fireMouseLeaveEvents = function (target, relatedTarget, uievent) {
        if (!target)
            return;
        var eventInit = {
            view: uievent.view,
            clientX: uievent.clientX,
            clientY: uievent.clientY,
            screenX: uievent.screenX,
            screenY: uievent.screenY,
            relatedTarget: relatedTarget
        };
        // fire mouseout
        eventInit.bubbles = true;
        target.dispatchEvent(new MouseEvent('mouseout', eventInit));
        // fire mouseleave events
        eventInit.bubbles = false;
        var el = target;
        do {
            el.dispatchEvent(new MouseEvent('mouseleave', eventInit));
            el = el['parentElement'];
        } while (el);
    };
    var fireMouseEnterEvents = function (target, relatedTarget, uievent) {
        var eventInit = {
            view: uievent.view,
            clientX: uievent.clientX,
            clientY: uievent.clientY,
            screenX: uievent.screenX,
            screenY: uievent.screenY,
            relatedTarget: relatedTarget
        };
        // fire mouseover
        eventInit.bubbles = true;
        target.dispatchEvent(new MouseEvent('mouseover', eventInit));
        // fire mouseenter events
        eventInit.bubbles = false;
        var el = target;
        do {
            el.dispatchEvent(new MouseEvent('mouseenter', eventInit));
            el = el['parentElement'];
        } while (el);
    };
    var firePointerEnterEvents = function (target, relatedTarget, uievent) {
        var bubbles = uievent.bubbles;
        // fire pointerover event
        uievent.bubbles = true;
        target.dispatchEvent(new PointerEvent('pointerover', uievent));
        // fire pointerenter events
        uievent.bubbles = false;
        var el = target;
        do {
            el.dispatchEvent(new PointerEvent('pointerenter', uievent));
            el = el['parentElement'];
        } while (el);
        uievent.bubbles = bubbles;
    };
    var firePointerLeaveEvents = function (target, relatedTarget, uievent) {
        if (!target)
            return;
        // fire pointerover event
        uievent.bubbles = true;
        target.dispatchEvent(new PointerEvent('pointerout', uievent));
        // fire pointerenter events
        uievent.bubbles = false;
        var el = target;
        do {
            el.dispatchEvent(new PointerEvent('pointerleave', uievent));
            el = el['parentElement'];
        } while (el);
    };
    var deserializeTouches = function (touches, target, uievent) {
        touches.forEach(function (t, i) {
            if (document.createTouch) {
                touches[i] = document.createTouch(uievent.view, target, t.identifier, t.clientX, t.clientY, t.screenX, t.screenY);
            }
            else if (typeof Touch !== undefined) {
                t.target = target;
                touches[i] = new Touch(t);
            }
        });
        return touches;
    };
    var touchTargets = {};
    var touchStartTimes = {};
    var pointerTargets = {};
    var capturedPointerTargets = {};
    document.documentElement.addEventListener('gotpointercapture', function (e) {
        capturedPointerTargets[e.pointerId] = e.target;
    });
    document.documentElement.addEventListener('lostpointercapture', function (e) {
        delete capturedPointerTargets[e.pointerId];
    });
    Element.prototype.setPointerCapture = function (id) { capturedPointerTargets[id] = this; };
    Element.prototype.releasePointerCapture = function (id) { capturedPointerTargets[id] = null; };
    return eventSynthesizerFunction = function (uievent) {
        uievent.view = window;
        var target;
        switch (uievent.type) {
            case 'wheel':
                target = document.elementFromPoint(uievent.clientX, uievent.clientY) || window;
                target.dispatchEvent(new WheelEvent(uievent.type, uievent));
                break;
            case 'mouseleave':
                target = document.elementFromPoint(uievent.clientX, uievent.clientY) || window;
                fireMouseLeaveEvents(currentMouseTarget, undefined, uievent);
                currentMouseTarget = undefined;
                break;
            case 'mouseenter':
                target = document.elementFromPoint(uievent.clientX, uievent.clientY) || window;
                fireMouseEnterEvents(target, undefined, uievent);
                currentMouseTarget = target;
                break;
            case 'mousemove':
                target = document.elementFromPoint(uievent.clientX, uievent.clientY) || window;
                if (target !== currentMouseTarget) {
                    fireMouseLeaveEvents(currentMouseTarget, target, uievent);
                    fireMouseEnterEvents(target, currentMouseTarget, uievent);
                    currentMouseTarget = target;
                }
                target.dispatchEvent(new MouseEvent(uievent.type, uievent));
                break;
            case 'touchstart':
                var primaryTouch = uievent.changedTouches[0];
                target = document.elementFromPoint(primaryTouch.clientX, primaryTouch.clientY) || window;
                for (var _i = 0, _a = uievent.changedTouches; _i < _a.length; _i++) {
                    var t = _a[_i];
                    touchTargets[t.identifier] = target;
                    touchStartTimes[t.identifier] = performance.now();
                }
            case 'touchmove':
            case 'touchend':
            case 'touchcancel':
                target = touchTargets[uievent.changedTouches[0].identifier];
                var evt = document.createEvent('TouchEvent');
                var touches = deserializeTouches(uievent.touches, target, uievent);
                var targetTouches = deserializeTouches(uievent.targetTouches, target, uievent);
                var changedTouches = deserializeTouches(uievent.changedTouches, target, uievent);
                if (document.createTouchList) {
                    touches = document.createTouchList.apply(document, touches);
                    targetTouches = document.createTouchList.apply(document, targetTouches);
                    changedTouches = document.createTouchList.apply(document, changedTouches);
                }
                // Safari, Firefox: must use initTouchEvent.
                if (typeof evt['initTouchEvent'] === "function") {
                    evt['initTouchEvent'](uievent.type, uievent.bubbles, uievent.cancelable, uievent.view, uievent.detail, uievent.screenX, uievent.screenY, uievent.clientX, uievent.clientY, uievent.ctrlKey, uievent.altKey, uievent.shiftKey, uievent.metaKey, touches, targetTouches, changedTouches, 1.0, 0.0);
                }
                else if ('TouchEvent' in window && TouchEvent.length > 0) {
                    // Chrome: must use TouchEvent constructor.
                    evt = new TouchEvent(uievent.type, {
                        cancelable: uievent.cancelable,
                        bubbles: uievent.bubbles,
                        touches: touches,
                        targetTouches: targetTouches,
                        changedTouches: changedTouches
                    });
                }
                else {
                    evt.initUIEvent(uievent.type, uievent.bubbles, uievent.cancelable, uievent.view, uievent.detail);
                    evt.touches = touches;
                    evt.targetTouches = targetTouches;
                    evt.changedTouches = changedTouches;
                }
                if (uievent.type === 'touchend' || uievent.type == 'touchcancel') {
                    target.dispatchEvent(evt);
                    var primaryTouch_1 = changedTouches[0];
                    uievent.clientX = primaryTouch_1.clientX;
                    uievent.clientY = primaryTouch_1.clientY;
                    uievent.screenX = primaryTouch_1.screenX;
                    uievent.screenY = primaryTouch_1.screenY;
                    uievent.button = 0;
                    uievent.detail = 1;
                    if (uievent.type === 'touchend') {
                        if (performance.now() - touchStartTimes[primaryTouch_1.identifier] < 300 && !evt.defaultPrevented) {
                            target.dispatchEvent(new MouseEvent('mousedown', uievent));
                            target.dispatchEvent(new MouseEvent('mouseup', uievent));
                            target.dispatchEvent(new MouseEvent('click', uievent));
                        }
                    }
                    else {
                        target.dispatchEvent(new MouseEvent('mouseout', uievent));
                    }
                    for (var _b = 0, _c = uievent.changedTouches; _b < _c.length; _b++) {
                        var t = _c[_b];
                        delete touchTargets[t.identifier];
                        delete touchStartTimes[t.identifier];
                    }
                }
                else {
                    target.dispatchEvent(evt);
                }
                break;
            case 'pointerenter':
            case 'pointerleave':
            case 'pointermove':
            case 'pointercancel':
            case 'pointerdown':
            case 'pointerup':
                var previousTarget = pointerTargets[uievent.pointerId];
                var capturedTarget = target = capturedPointerTargets[uievent.pointerId];
                var isLeaving = uievent.type === 'pointerleave' || uievent.type === 'pointercancel';
                var pointerEvent = new PointerEvent(uievent.type, uievent);
                if (capturedTarget) {
                    capturedTarget.dispatchEvent(pointerEvent);
                }
                else {
                    target = document.elementFromPoint(uievent.clientX, uievent.clientY) || window;
                    if (target !== previousTarget) {
                        firePointerLeaveEvents(previousTarget, target, uievent);
                        if (!isLeaving)
                            firePointerEnterEvents(target, previousTarget, uievent);
                    }
                    target.dispatchEvent(pointerEvent);
                }
                if (isLeaving) {
                    delete pointerTargets[uievent.pointerId];
                }
                else {
                    pointerTargets[uievent.pointerId] = target;
                }
                break;
            default:
                target = document.elementFromPoint(uievent.clientX, uievent.clientY) || window;
                target.dispatchEvent(new MouseEvent(uievent.type, uievent));
        }
    };
}
export default (typeof document !== 'undefined' && document.createElement) ?
    getEventSynthesizier : function () { return undefined; };
