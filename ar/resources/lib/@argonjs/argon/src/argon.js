var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import 'aurelia-polyfills';
import * as DI from 'aurelia-dependency-injection';
import * as Cesium from './cesium/cesium-imports';
import './webvr';
import { SessionService, ConnectService, LoopbackConnectService, DOMConnectService, DebugConnectService, WKWebViewConnectService, AndroidWebViewConnectService } from './session';
import { Configuration, Role } from './common';
import { DefaultUIService } from './ui';
import { isIOS, getEventSynthesizier, createEventForwarder, hasNativeWebVRImplementation } from './utils';
import { EntityService, EntityServiceProvider } from './entity';
import { ContextService, ContextServiceProvider } from './context';
import { FocusService, FocusServiceProvider } from './focus';
import { DeviceService, DeviceServiceProvider } from './device';
import { RealityService, RealityServiceProvider } from './reality';
import { ViewService, ViewServiceProvider, ViewItems } from './view';
import { VisibilityService, VisibilityServiceProvider } from './visibility';
import { VuforiaService, VuforiaServiceProvider } from './vuforia';
import { PermissionService, PermissionServiceProvider } from './permission';
import { RealityViewer } from './reality-viewers/base';
import { EmptyRealityViewer } from './reality-viewers/empty';
import { LiveRealityViewer } from './reality-viewers/live';
import { HostedRealityViewer } from './reality-viewers/hosted';
export { DI, Cesium };
export * from './common';
export * from './context';
export * from './entity';
export * from './focus';
export * from './device';
export * from './reality';
export * from './session';
export * from './ui';
export * from './utils';
export * from './view';
export * from './visibility';
export * from './vuforia';
export * from './permission';
export { RealityViewer, EmptyRealityViewer, LiveRealityViewer, HostedRealityViewer };
var ArgonSystemProvider = (function () {
    function ArgonSystemProvider(entity, context, focus, device, visibility, reality, view, vuforia, permission) {
        this.entity = entity;
        this.context = context;
        this.focus = focus;
        this.device = device;
        this.visibility = visibility;
        this.reality = reality;
        this.view = view;
        this.vuforia = vuforia;
        this.permission = permission;
    }
    return ArgonSystemProvider;
}());
ArgonSystemProvider = __decorate([
    DI.autoinject(),
    __metadata("design:paramtypes", [EntityServiceProvider,
        ContextServiceProvider,
        FocusServiceProvider,
        DeviceServiceProvider,
        VisibilityServiceProvider,
        RealityServiceProvider,
        ViewServiceProvider,
        VuforiaServiceProvider,
        PermissionServiceProvider])
], ArgonSystemProvider);
export { ArgonSystemProvider };
/**
 * A composition root which instantiates the object graph based on a provided configuration.
 * You generally want to create a new ArgonSystem via the provided [[init]] or [[initReality]] functions:
 * ```ts
 * var app = Argon.init(); // app is an instance of ArgonSystem
 * ```
 */
var ArgonSystem = ArgonSystem_1 = (function () {
    function ArgonSystem(container, entity, context, device, focus, reality, session, view, visibility, vuforia, permission) {
        this.container = container;
        this.entity = entity;
        this.context = context;
        this.device = device;
        this.focus = focus;
        this.reality = reality;
        this.session = session;
        this.view = view;
        this.visibility = visibility;
        this.vuforia = vuforia;
        this.permission = permission;
        if (!ArgonSystem_1.instance)
            ArgonSystem_1.instance = this;
        if (this.container.hasResolver(ArgonSystemProvider))
            this._provider = this.container.get(ArgonSystemProvider);
        this._setupDOM();
        this.session.connect();
    }
    ArgonSystem.prototype._setupDOM = function () {
        var _this = this;
        var viewItems = this.container.get(ViewItems);
        var element = viewItems.element;
        if (element && typeof document !== 'undefined' && document.createElement) {
            element.classList.add('argon-view');
            // prevent pinch-zoom of the page in ios 10.
            if (isIOS) {
                var touchMoveListener_1 = function (event) {
                    if (event.touches.length > 1)
                        event.preventDefault();
                };
                element.addEventListener('touchmove', touchMoveListener_1, true);
                this.session.manager.closeEvent.addEventListener(function () {
                    element.removeEventListener('touchmove', touchMoveListener_1);
                });
            }
            // add styles describing the type of the current session
            if (this.session.isRealityViewer) {
                document.documentElement.classList.add('argon-reality-viewer');
            }
            if (this.session.isRealityAugmenter) {
                document.documentElement.classList.add('argon-reality-augmenter');
            }
            if (this.session.isRealityManager) {
                document.documentElement.classList.add('argon-reality-manager');
            }
            // add/remove document-level css classes
            this.focus.focusEvent.addEventListener(function () {
                document.documentElement.classList.remove('argon-no-focus');
                document.documentElement.classList.remove('argon-blur');
                document.documentElement.classList.add('argon-focus');
            });
            this.focus.blurEvent.addEventListener(function () {
                document.documentElement.classList.remove('argon-focus');
                document.documentElement.classList.add('argon-blur');
                document.documentElement.classList.add('argon-no-focus');
            });
            this.view.viewportModeChangeEvent.addEventListener(function (mode) {
                switch (mode) {
                    case 0 /* EMBEDDED */:
                        var elementStyle = _this.view.element.style;
                        elementStyle.position = '';
                        elementStyle.left = '0px';
                        elementStyle.bottom = '0px';
                        elementStyle.width = '100%';
                        elementStyle.height = '100%';
                        document.documentElement.classList.remove('argon-immersive');
                        break;
                    case 1 /* IMMERSIVE */:
                        document.documentElement.classList.add('argon-immersive');
                        break;
                }
            });
            // Setup event forwarding / synthesizing
            if (this.session.isRealityViewer) {
                this.session.manager.on['ar.view.uievent'] = getEventSynthesizier();
            }
            else {
                createEventForwarder(this.view, function (event) {
                    if (_this.session.manager.isConnected && _this.session.manager.version[0] >= 1)
                        _this.session.manager.send('ar.view.forwardUIEvent', event);
                });
                this.view._watchEmbeddedViewport();
            }
            this.context.renderEvent.addEventListener(function () {
                if (_this.view.autoStyleLayerElements) {
                    var layers = _this.view.layers;
                    if (!layers)
                        return;
                    var viewport = _this.view.viewport;
                    var zIndex = 0;
                    for (var _i = 0, layers_1 = layers; _i < layers_1.length; _i++) {
                        var layer = layers_1[_i];
                        var layerStyle = layer.source.style;
                        layerStyle.position = 'absolute';
                        layerStyle.left = viewport.x + 'px';
                        layerStyle.bottom = viewport.y + 'px';
                        layerStyle.width = viewport.width + 'px';
                        layerStyle.height = viewport.height + 'px';
                        layerStyle.zIndex = '' + zIndex;
                        zIndex++;
                    }
                }
            });
            if (!this.session.isRealityManager) {
                this.view.viewportChangeEvent.addEventListener(function (viewport) {
                    if (_this.view.element && _this.view.autoLayoutImmersiveMode &&
                        _this.view.viewportMode === 1 /* IMMERSIVE */) {
                        var elementStyle = _this.view.element.style;
                        elementStyle.position = 'fixed';
                        elementStyle.left = viewport.x + 'px';
                        elementStyle.bottom = viewport.y + 'px';
                        elementStyle.width = viewport.width + 'px';
                        elementStyle.height = viewport.height + 'px';
                    }
                });
            }
        }
    };
    Object.defineProperty(ArgonSystem.prototype, "suggestedPixelRatio", {
        get: function () {
            if (this.device.isPresentingHMD && hasNativeWebVRImplementation)
                return 1;
            var devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
            if (this.focus.hasFocus) {
                return devicePixelRatio;
            }
            else {
                return devicePixelRatio * 0.5;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ArgonSystem.prototype, "provider", {
        get: function () {
            this.session.ensureIsRealityManager();
            return this._provider;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ArgonSystem.prototype, "updateEvent", {
        // events
        get: function () {
            return this.context.updateEvent;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ArgonSystem.prototype, "renderEvent", {
        get: function () {
            return this.context.renderEvent;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ArgonSystem.prototype, "focusEvent", {
        get: function () {
            return this.focus.focusEvent;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ArgonSystem.prototype, "blurEvent", {
        get: function () {
            return this.focus.blurEvent;
        },
        enumerable: true,
        configurable: true
    });
    ArgonSystem.prototype.destroy = function () {
        this.session.manager.close();
        if (ArgonSystem_1.instance === this) {
            ArgonSystem_1.instance = undefined;
        }
    };
    return ArgonSystem;
}());
ArgonSystem = ArgonSystem_1 = __decorate([
    DI.autoinject,
    __metadata("design:paramtypes", [DI.Container, EntityService,
        ContextService,
        DeviceService,
        FocusService,
        RealityService,
        SessionService,
        ViewService,
        VisibilityService,
        VuforiaService,
        PermissionService])
], ArgonSystem);
export { ArgonSystem };
var ArgonConfigurationManager = (function () {
    function ArgonConfigurationManager(configuration, container, elementOrSelector) {
        if (container === void 0) { container = new DI.Container; }
        this.configuration = configuration;
        this.container = container;
        this.elementOrSelector = elementOrSelector;
        container.registerInstance(Configuration, configuration);
        if (Role.isRealityManager(configuration.role))
            container.registerSingleton(ArgonSystemProvider);
        var element = elementOrSelector;
        if (!element || typeof element === 'string') {
            if (typeof document !== 'undefined') {
                var selector = element;
                element = selector ? document.querySelector(selector) : undefined;
                if (!element && !selector) {
                    element = document.querySelector('#argon');
                    if (!element) {
                        element = document.createElement('div');
                        element.id = 'argon';
                        document.body.appendChild(element);
                    }
                }
                else if (!element) {
                    throw new Error('Unable to find element with selector: ' + selector);
                }
            }
            else {
                console.warn('No DOM environment is available');
                element = undefined;
            }
        }
        var viewItems = new ViewItems();
        viewItems.element = element;
        container.registerInstance(ViewItems, viewItems);
        ArgonConfigurationManager.configure(this);
    }
    ArgonConfigurationManager.configure = function (configurationManager) {
        configurationManager.standardConfiguration();
    };
    ArgonConfigurationManager.prototype.standardConfiguration = function () {
        this.defaultConnect();
        this.defaultUI();
    };
    ArgonConfigurationManager.prototype.defaultConnect = function () {
        var container = this.container;
        var configuration = this.configuration;
        if (Role.isRealityManager(configuration.role)) {
            container.registerSingleton(ConnectService, LoopbackConnectService);
        }
        else if (WKWebViewConnectService.isAvailable()) {
            container.registerSingleton(ConnectService, WKWebViewConnectService);
        }
        else if (AndroidWebViewConnectService.isAvailable()) {
            container.registerSingleton(ConnectService, AndroidWebViewConnectService);
        }
        else if (DOMConnectService.isAvailable()) {
            container.registerSingleton(ConnectService, DOMConnectService);
        }
        else if (DebugConnectService.isAvailable()) {
            container.registerSingleton(ConnectService, DebugConnectService);
        }
    };
    ArgonConfigurationManager.prototype.defaultUI = function () {
        if (Role.isRealityManager(this.configuration.role)) {
            if (typeof document !== 'undefined') {
                this.container.get(DefaultUIService);
            }
        }
    };
    return ArgonConfigurationManager;
}());
export { ArgonConfigurationManager };
export function init(elementOrConfig, configurationOrDIContainer, dependencyInjectionContainer) {
    if (ArgonSystem.instance)
        throw new Error('A shared ArgonSystem instance already exists');
    var element;
    var configuration;
    if (configurationOrDIContainer instanceof DI.Container) {
        configuration = elementOrConfig;
        dependencyInjectionContainer = configurationOrDIContainer;
    }
    else {
        element = elementOrConfig;
        configuration = configurationOrDIContainer;
    }
    // see if it is the old parameter interface
    if (element && (element['configuration'] || element['container'])) {
        var deprecatedParameters = element;
        if (!configuration && deprecatedParameters['configuration'])
            configuration = deprecatedParameters['configuration'];
        if (!configuration && deprecatedParameters['container'])
            dependencyInjectionContainer = deprecatedParameters['container'];
        element = undefined;
    }
    if (!configuration)
        configuration = {};
    if (!configuration.role) {
        var role = void 0;
        if (typeof HTMLElement === 'undefined') {
            role = Role.REALITY_MANAGER;
        }
        else if (navigator.userAgent.indexOf('Argon') > 0 || window.top !== window) {
            role = Role.APPLICATION; // TODO: switch to below after several argon-app releases
            // role = Role.REALITY_AUGMENTER
        }
        else {
            role = Role.REALITY_MANAGER;
        }
        configuration.role = role;
    }
    if (!dependencyInjectionContainer)
        dependencyInjectionContainer = new DI.Container();
    return new ArgonConfigurationManager(configuration, dependencyInjectionContainer, element).container.get(ArgonSystem);
}
/**
 * Initialize an [[ArgonSystem]] with the [[REALITY_VIEWER]] role
 */
export function initRealityViewer(configuration, dependencyInjectionContainer) {
    if (configuration === void 0) { configuration = {}; }
    if (dependencyInjectionContainer === void 0) { dependencyInjectionContainer = new DI.Container; }
    if (ArgonSystem.instance)
        throw new Error('A shared ArgonSystem instance already exists');
    configuration.role = Role.REALITY_VIEW; // TODO: switch to below after several argon-app releases
    // configuration.role = Role.REALITY_VIEWER;
    configuration['supportsCustomProtocols'] = true;
    configuration['reality.supportsControlPort'] = true; // backwards compat for above
    configuration.protocols = configuration.protocols || [];
    configuration.protocols.push('ar.uievent');
    return new ArgonConfigurationManager(configuration, dependencyInjectionContainer).container.get(ArgonSystem);
}
/**
 * @private
 */
export var initReality = initRealityViewer;
var ArgonSystem_1;
