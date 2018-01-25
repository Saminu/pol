var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { autoinject, singleton } from 'aurelia-dependency-injection';
import { Viewport } from './common';
import { SessionService } from './session';
import { PerspectiveFrustum } from './cesium/cesium-imports';
import { Event, decomposePerspectiveProjectionMatrix, deprecated } from './utils';
import { FocusService, FocusServiceProvider } from './focus';
import { VisibilityServiceProvider } from './visibility';
/**
 * The rendering paramters for a particular subview
 */
var Subview = (function () {
    function Subview() {
    }
    return Subview;
}());
export { Subview };
var ViewItems = (function () {
    function ViewItems() {
    }
    return ViewItems;
}());
ViewItems = __decorate([
    singleton()
], ViewItems);
export { ViewItems };
/**
 * Manages the view state
 */
var ViewService = (function () {
    function ViewService(sessionService, focusService, viewItems) {
        var _this = this;
        this.sessionService = sessionService;
        this.focusService = focusService;
        this.viewItems = viewItems;
        /**
         * UI events that occur within this view. To handle an event (and prevent it from
         * being forwarded to another layer) call event.stopImmediatePropagation().
         */
        this.uiEvent = new Event();
        /**
         * An event that is raised when the viewport has changed
         */
        this.viewportChangeEvent = new Event();
        /**
         * An event that is raised when the viewport mode has changed
         */
        this.viewportModeChangeEvent = new Event();
        this._mode = 0 /* EMBEDDED */;
        this._viewport = new Viewport;
        this._renderWidth = 0;
        this._renderHeight = 0;
        /**
         * Automatically layout the element to match the immersive viewport during PresentationMode.IMMERSIVE
         */
        this.autoLayoutImmersiveMode = true;
        /**
         * Automatically style layer elements
         */
        this.autoStyleLayerElements = true;
        /**
         * Automatically publish the viewport of the element during PresentationMode.EMBEDDED
         */
        this.autoPublishEmbeddedMode = true;
        this._subviews = [];
        this._subviewFrustum = [];
        this._desiredViewportMode = this.viewportMode;
        this._embeddedViewport = new Viewport;
        sessionService.manager.on['ar.view.viewportMode'] =
            function (_a) {
                var mode = _a.mode;
                _this._updateViewportMode(mode);
            };
        // if we are not the manager, we must start in immersive mode
        if (!sessionService.isRealityManager)
            this._updateViewportMode(1 /* IMMERSIVE */);
        sessionService.manager.connectEvent.addEventListener(function () {
            _this.viewportModeChangeEvent.raiseEvent(_this.viewportMode);
        });
    }
    Object.defineProperty(ViewService.prototype, "viewportMode", {
        /**
         * The current viewport mode
         */
        get: function () { return this._mode; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ViewService.prototype, "presentationMode", {
        get: function () { return this.viewportMode; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ViewService.prototype, "viewport", {
        /**
         * The current viewport
         */
        get: function () {
            return this._viewport;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ViewService.prototype, "renderWidth", {
        /**
         * The width which should be used for the render buffer
         */
        get: function () {
            return this._renderWidth;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ViewService.prototype, "renderHeight", {
        /**
         * The height which should be used for the render buffer
         */
        get: function () {
            return this._renderHeight;
        },
        enumerable: true,
        configurable: true
    });
    ViewService.prototype.getViewport = function () {
        return this.viewport;
    };
    ViewService.prototype.setLayers = function (layers) {
        var currentLayers = this.viewItems.layers;
        if (currentLayers) {
            for (var _i = 0, currentLayers_1 = currentLayers; _i < currentLayers_1.length; _i++) {
                var l = currentLayers_1[_i];
                this.element.removeChild(l.source);
            }
        }
        this.viewItems.layers = layers;
        for (var _a = 0, layers_1 = layers; _a < layers_1.length; _a++) {
            var l = layers_1[_a];
            this.element.appendChild(l.source);
        }
    };
    Object.defineProperty(ViewService.prototype, "element", {
        /**
        * The DOM element associated with this view
        */
        get: function () {
            return this.viewItems.element;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ViewService.prototype, "layers", {
        /**
         * The layers composing this view.
         */
        get: function () {
            return this.viewItems.layers;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ViewService.prototype, "subviews", {
        get: function () {
            return this._subviews;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @private
     */
    ViewService.prototype.getSubviews = function () {
        return this.subviews;
    };
    // Kind of hacky that we are passing the ContextService here.
    // Might be better to bring this logic into the ContextService
    ViewService.prototype._processContextFrameState = function (state, contextService) {
        var renderWidthScaleFactor = state.viewport.renderWidthScaleFactor || 1;
        var renderHeightScaleFactor = state.viewport.renderHeightScaleFactor || 1;
        this._renderWidth = state.viewport.width * renderWidthScaleFactor;
        this._renderHeight = state.viewport.height * renderHeightScaleFactor;
        var serializedSubviewList = state.subviews;
        var subviews = this._subviews;
        subviews.length = serializedSubviewList.length;
        var index = 0;
        for (var _i = 0, serializedSubviewList_1 = serializedSubviewList; _i < serializedSubviewList_1.length; _i++) {
            var serializedSubview = serializedSubviewList_1[_i];
            var subview = subviews[index] = subviews[index] || {};
            subview.index = index;
            subview.type = serializedSubview.type;
            subview.viewport = subview.viewport || {};
            subview.viewport.x = serializedSubview.viewport.x;
            subview.viewport.y = serializedSubview.viewport.y;
            subview.viewport.width = serializedSubview.viewport.width;
            subview.viewport.height = serializedSubview.viewport.height;
            subview.renderViewport = subview.renderViewport || {};
            subview.renderViewport.x = serializedSubview.viewport.x * renderWidthScaleFactor;
            subview.renderViewport.y = serializedSubview.viewport.y * renderHeightScaleFactor;
            subview.renderViewport.width = serializedSubview.viewport.width * renderWidthScaleFactor;
            subview.renderViewport.height = serializedSubview.viewport.height * renderHeightScaleFactor;
            subview.frustum = this._subviewFrustum[index] =
                this._subviewFrustum[index] || new PerspectiveFrustum();
            decomposePerspectiveProjectionMatrix(serializedSubview.projectionMatrix, subview.frustum);
            subview['projectionMatrix'] = subview.frustum.projectionMatrix;
            subview.pose = contextService.getEntityPose(contextService.getSubviewEntity(index));
            subview.pose.update(state.time);
            index++;
        }
        this._updateViewport(state.viewport);
    };
    ViewService.prototype.requestPresentationMode = function (mode) {
        return this.sessionService.manager.request('ar.view.desiredViewportMode', { mode: mode });
    };
    Object.defineProperty(ViewService.prototype, "desiredViewportMode", {
        get: function () {
            return this._desiredViewportMode;
        },
        set: function (mode) {
            var _this = this;
            this._desiredViewportMode = mode;
            this.sessionService.manager.whenConnected().then(function () {
                if (_this.sessionService.manager.version[0] > 0)
                    _this.sessionService.manager.send('ar.view.desiredViewportMode', { mode: mode });
            });
        },
        enumerable: true,
        configurable: true
    });
    ViewService.prototype._updateViewportMode = function (mode) {
        var currentMode = this.viewportMode;
        if (currentMode !== mode) {
            this._mode = mode;
            this.viewportModeChangeEvent.raiseEvent(mode);
        }
    };
    /**
     * Publish the viewport being used in [[PresentationMode.EMBEDDED]]
     * so that the manager knows what our embedded viewport is
     */
    ViewService.prototype.publishEmbeddedViewport = function (viewport) {
        if (this.sessionService.manager.isConnected &&
            this.sessionService.manager.version[0] >= 1)
            this.sessionService.manager.send('ar.view.embeddedViewport', { viewport: viewport });
    };
    // Updates the element, if necessary, and raise a view change event
    ViewService.prototype._updateViewport = function (viewport) {
        var viewportJSON = JSON.stringify(viewport);
        if (!this._currentViewportJSON || this._currentViewportJSON !== viewportJSON) {
            this._currentViewportJSON = viewportJSON;
            this._viewport = Viewport.clone(viewport, this._viewport);
            this.viewportChangeEvent.raiseEvent(viewport);
        }
    };
    ViewService.prototype.sendUIEventToSession = function (uievent, session) {
        if (session && session.isConnected)
            session.send('ar.view.uievent', uievent);
    };
    /**
     * @private
     */
    ViewService.prototype._watchEmbeddedViewport = function () {
        var _this = this;
        var publish = function () {
            if (_this.element && _this.autoPublishEmbeddedMode) {
                var parentElement = _this.element.parentElement;
                var rect = parentElement && parentElement.getBoundingClientRect();
                if (rect) {
                    var x = rect.left;
                    var y = window.innerHeight - rect.bottom;
                    var width = rect.width;
                    var height = rect.height;
                    var embeddedViewport = _this._embeddedViewport;
                    if (embeddedViewport.x !== x ||
                        embeddedViewport.y !== y ||
                        embeddedViewport.width !== width ||
                        embeddedViewport.height !== height) {
                        embeddedViewport.x = x;
                        embeddedViewport.y = y;
                        embeddedViewport.width = width;
                        embeddedViewport.height = height;
                        _this.publishEmbeddedViewport(_this._embeddedViewport);
                    }
                }
            }
        };
        setInterval(function () {
            if (!_this.focusService.hasFocus)
                publish();
        }, 500);
        // this.contextService.renderEvent.addEventListener(()=>{
        //     if (this.focusService.hasFocus) publish();
        // });
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('orientationchange', publish);
            window.addEventListener('scroll', publish);
            this.sessionService.manager.closeEvent.addEventListener(function () {
                window.removeEventListener('orientationchange', publish);
                window.removeEventListener('scroll', publish);
            });
        }
    };
    return ViewService;
}());
__decorate([
    deprecated('viewportMode'),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], ViewService.prototype, "presentationMode", null);
__decorate([
    deprecated('viewport'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ViewService.prototype, "getViewport", null);
__decorate([
    deprecated('subviews'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ViewService.prototype, "getSubviews", null);
__decorate([
    deprecated('desiredViewportMode'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ViewService.prototype, "requestPresentationMode", null);
ViewService = __decorate([
    autoinject,
    __metadata("design:paramtypes", [SessionService,
        FocusService,
        ViewItems])
], ViewService);
export { ViewService };
var ViewServiceProvider = (function () {
    function ViewServiceProvider(sessionService, viewService, focusServiceProvider, visibilityServiceProvider) {
        var _this = this;
        this.sessionService = sessionService;
        this.viewService = viewService;
        this.focusServiceProvider = focusServiceProvider;
        this.sessionViewportMode = new WeakMap();
        /**
         * The embedded viewports for each managed session.
         */
        this.sessionEmbeddedViewport = new WeakMap();
        /**
         * A UI event being forwarded from a managed session
         */
        this.forwardedUIEvent = new Event();
        sessionService.ensureIsRealityManager();
        sessionService.connectEvent.addEventListener(function (session) {
            _this.sessionViewportMode.set(session, session === _this.sessionService.manager ?
                _this.viewService.desiredViewportMode :
                1 /* IMMERSIVE */);
            // forward ui events to the visible reality viewer
            session.on['ar.view.forwardUIEvent'] = function (uievent) {
                _this.forwardedUIEvent.raiseEvent(uievent);
            };
            session.on['ar.view.desiredViewportMode'] = function (_a) {
                var mode = _a.mode;
                _this.sessionViewportMode.set(session, mode);
                _this._publishViewportModes();
            };
            session.on['ar.view.embeddedViewport'] = function (viewport) {
                _this.sessionEmbeddedViewport.set(session, viewport);
            };
            _this._publishViewportModes();
        });
        focusServiceProvider.sessionFocusEvent.addEventListener(function () {
            _this._publishViewportModes();
        });
    }
    ViewServiceProvider.prototype.sendUIEventToSession = function (uievent, session) {
        session.send('ar.view.uievent', uievent);
    };
    ViewServiceProvider.prototype._publishViewportModes = function () {
        this.sessionService.manager.send('ar.view.viewportMode', {
            mode: this.sessionViewportMode.get(this.sessionService.manager)
        });
        for (var _i = 0, _a = this.sessionService.managedSessions; _i < _a.length; _i++) {
            var session = _a[_i];
            var mode = (session === this.focusServiceProvider.session) ?
                this.sessionViewportMode.get(session) : 1 /* IMMERSIVE */;
            if (session.version[0] > 0)
                session.send('ar.view.viewportMode', { mode: mode });
        }
    };
    return ViewServiceProvider;
}());
ViewServiceProvider = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [SessionService,
        ViewService,
        FocusServiceProvider,
        VisibilityServiceProvider])
], ViewServiceProvider);
export { ViewServiceProvider };
// setup our DOM environment
if (typeof document !== 'undefined' && document.createElement) {
    var viewportMetaTag = document.querySelector('meta[name=viewport]');
    if (!viewportMetaTag)
        viewportMetaTag = document.createElement('meta');
    viewportMetaTag.name = 'viewport';
    viewportMetaTag.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0';
    document.head.appendChild(viewportMetaTag);
    var argonMetaTag = document.querySelector('meta[name=argon]');
    if (!argonMetaTag)
        argonMetaTag = document.createElement('meta');
    argonMetaTag.name = 'argon';
    document.head.appendChild(argonMetaTag);
    var style = document.createElement("style");
    style.type = 'text/css';
    document.head.insertBefore(style, document.head.firstChild);
    var sheet = style.sheet;
    sheet.insertRule("\n        #argon {\n            position: fixed;\n            width: 100%;\n            height: 100%;\n            left: 0;\n            bottom: 0;\n            margin: 0;\n            border: 0;\n            padding: 0;\n        }\n    ", sheet.cssRules.length);
    sheet.insertRule("\n        .argon-view {\n            -webkit-tap-highlight-color: transparent;\n            -webkit-user-select: none;\n            user-select: none;\n        }\n    ", sheet.cssRules.length);
    sheet.insertRule("\n        .argon-immersive .argon-view {\n            position: fixed !important;\n            width: 100% !important;\n            height: 100% !important;\n            max-width: 100% !important;\n            max-height: 100% !important;\n            left: 0;\n            bottom: 0;\n            margin: 0;\n            border: 0;\n            padding: 0;\n            visibility: visible;\n        }\n    ", sheet.cssRules.length);
    sheet.insertRule("\n        :not(.argon-reality-manager).argon-immersive body {\n            visibility: hidden;\n        }\n    ", sheet.cssRules.length);
    sheet.insertRule("\n        .argon-interactive {\n            pointer-events: auto;\n        }\n    ", sheet.cssRules.length);
}
