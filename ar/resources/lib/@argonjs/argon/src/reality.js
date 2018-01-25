var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { autoinject, inject, Factory } from 'aurelia-dependency-injection';
import { createGuid, PerspectiveFrustum, Matrix4 } from './cesium/cesium-imports';
import { Role, CanvasViewport, Viewport, SerializedSubviewList } from './common';
import { SessionService } from './session';
import { Event, deprecated, decomposePerspectiveProjectionMatrix } from './utils';
import { ContextService } from './context';
import { FocusServiceProvider } from './focus';
import { VisibilityServiceProvider } from './visibility';
import { RealityViewer } from './reality-viewers/base';
import { EmptyRealityViewer } from './reality-viewers/empty';
import { LiveRealityViewer } from './reality-viewers/live';
import { HostedRealityViewer } from './reality-viewers/hosted';
import { ViewServiceProvider } from './view';
import { DeviceService } from './device';
var RealityViewerFactory = (function () {
    function RealityViewerFactory(_createEmptyReality, _createLiveReality, _createHostedReality) {
        this._createEmptyReality = _createEmptyReality;
        this._createLiveReality = _createLiveReality;
        this._createHostedReality = _createHostedReality;
    }
    RealityViewerFactory.prototype.createRealityViewer = function (uri) {
        switch (RealityViewer.getType(uri)) {
            case RealityViewer.EMPTY:
                return this._createEmptyReality(uri);
            case RealityViewer.LIVE:
                return this._createLiveReality(uri);
            case 'hosted':
                return this._createHostedReality(uri);
            default:
                throw new Error('Unsupported Reality Viewer: ' + uri);
        }
    };
    return RealityViewerFactory;
}());
RealityViewerFactory = __decorate([
    inject(Factory.of(EmptyRealityViewer), Factory.of(LiveRealityViewer), Factory.of(HostedRealityViewer)),
    __metadata("design:paramtypes", [Object, Object, Object])
], RealityViewerFactory);
export { RealityViewerFactory };
/**
* A service which makes requests to manage the reality viewer.
*/
var RealityService = (function () {
    // private _scratchFrustum = new PerspectiveFrustum();
    function RealityService(sessionService, contextService) {
        var _this = this;
        this.sessionService = sessionService;
        this.contextService = contextService;
        this._connectEvent = new Event();
        this._sessions = [];
        this._changeEvent = new Event();
        /**
         * The default Reality Viewer.
         */
        this.default = RealityViewer.EMPTY;
        sessionService.manager.on['ar.reality.connect'] = function (_a) {
            var id = _a.id;
            var realityControlSession = _this.sessionService.createSessionPort(id);
            var messageChannel = _this.sessionService.createSynchronousMessageChannel();
            var ROUTE_MESSAGE_KEY = 'ar.reality.message.route.' + id;
            var SEND_MESSAGE_KEY = 'ar.reality.message.send.' + id;
            var CLOSE_SESSION_KEY = 'ar.reality.close.' + id;
            messageChannel.port1.onmessage = function (msg) {
                _this.sessionService.manager.send(ROUTE_MESSAGE_KEY, msg.data);
            };
            _this.sessionService.manager.on[SEND_MESSAGE_KEY] = function (message) {
                messageChannel.port1.postMessage(message);
            };
            _this.sessionService.manager.on[CLOSE_SESSION_KEY] = function () {
                realityControlSession.close();
            };
            realityControlSession.connectEvent.addEventListener(function () {
                _this.sessions.push(realityControlSession);
                _this.connectEvent.raiseEvent(realityControlSession);
                realityControlSession.closeEvent.addEventListener(function () {
                    var idx = _this.sessions.indexOf(realityControlSession);
                    _this.sessions.splice(idx, 1);
                });
            });
            _this.sessionService.manager.closeEvent.addEventListener(function () {
                realityControlSession.close();
                delete _this.sessionService.manager.on[SEND_MESSAGE_KEY];
                delete _this.sessionService.manager.on[CLOSE_SESSION_KEY];
            });
            realityControlSession.open(messageChannel.port2, _this.sessionService.configuration);
        };
        // let i = 0;
        this.contextService.updateEvent.addEventListener(function () {
            var frameState = _this.contextService.serializedFrameState;
            if (sessionService.isRealityViewer && sessionService.manager.isConnected) {
                // backwards compatability
                if (sessionService.manager.isConnected && sessionService.manager.version[0] === 0) {
                    var eye = frameState['eye'] = frameState['eye'] || {};
                    eye.pose = frameState.entities['ar.user'];
                    eye.viewport = Viewport.clone(frameState.subviews[0].viewport, eye.viewport);
                    delete frameState.entities['ar.user'];
                    // throttle for 30fps
                    // i++ % 2 === 0 && 
                    sessionService.manager.send('ar.reality.frameState', frameState);
                    frameState.entities['ar.user'] = eye.pose;
                }
                else {
                    sessionService.manager.send('ar.reality.frameState', frameState);
                }
            }
            var current = frameState.reality;
            var previous = _this._current;
            if (previous !== current) {
                _this._current = current;
                _this.changeEvent.raiseEvent({ previous: previous, current: current });
            }
        });
    }
    Object.defineProperty(RealityService.prototype, "connectEvent", {
        /**
         * An event that provides a session for sending / receiving
         * commands to / from a reality.
         *
         * The session passed via this event can represent either endpoint of
         * a connection between RealityViewer <--> RealityAugmenter/RealityManager.
         *
         * If running in a RealityAugmenter, the session
         * represents a connection to a RealityViewer.
         *
         * If running in a RealityViewer, the session
         * represents a connection to a RealityAugmenter.
         */
        get: function () { return this._connectEvent; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(RealityService.prototype, "sessions", {
        /**
         * A collection of connected sessions.
         *
         * If running in a RealityAugmenter, this collection
         * represents connections to any loaded RealityViewers.
         *
         * If running in a RealityViewer, this collection
         * represents connections to any RealityAugmenters.
         */
        get: function () { return this._sessions; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(RealityService.prototype, "changeEvent", {
        /**
         * An event that is raised when the presenting reality viewer is changed.
         */
        get: function () {
            return this._changeEvent;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RealityService.prototype, "current", {
        /**
         * The URI for the currently presenting Reality Viewer.
         */
        get: function () {
            return this._current;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Install the specified reality viewer
     */
    RealityService.prototype.install = function (uri) {
        var _this = this;
        return this.sessionService.manager.whenConnected().then(function () {
            if (_this.sessionService.manager.version[0] >= 1 !== true)
                return Promise.reject(new Error('Not supported'));
            return _this.sessionService.manager.request('ar.reality.install', { uri: uri });
        });
    };
    /**
     * Uninstall the specified reality viewer
     */
    RealityService.prototype.uninstall = function (uri) {
        var _this = this;
        return this.sessionService.manager.whenConnected().then(function () {
            if (_this.sessionService.manager.version[0] >= 1 !== true)
                return Promise.reject(new Error('Not supported'));
            return _this.sessionService.manager.request('ar.reality.uninstall', { uri: uri });
        });
    };
    /**
     * Request a reality viewer to be presented.
     * - Pass a url to request a (custum) hosted reality viewer
     * - [[RealityViewer.DEFAULT]] to request the system default reality viewer
     * - [[RealityViewer.LIVE]] to request a live reality viewer
     * - [[RealityViewer.EMPTY]] to request an empty reality viewer
     */
    RealityService.prototype.request = function (uri) {
        var _this = this;
        return this.sessionService.manager.whenConnected().then(function () {
            if (_this.sessionService.manager.version[0] >= 1 !== true)
                return _this.sessionService.manager.request('ar.reality.desired', { reality: { uri: uri } });
            return _this.sessionService.manager.request('ar.reality.request', { uri: uri });
        });
    };
    /**
     * Deprecated. Use [[RealityService#request]]
     * @deprecated
     */
    RealityService.prototype.setDesired = function (reality) {
        this.request(reality ? reality.uri : RealityViewer.DEFAULT);
    };
    /**
     * Ask a reality to move the stage to the given geolocation
     */
    RealityService.prototype.setStageGeolocation = function (realitySession, geolocation) {
        if (!realitySession.supportsProtocol('ar.configureStage'))
            return Promise.reject('Protocol `ar.configureStage` is not supported');
        return realitySession.request('ar.configureStage.setStageGeolocation', { geolocation: geolocation });
    };
    /**
     * Ask a reality to move the stage to the given geolocation
     */
    RealityService.prototype.resetStageGeolocation = function (realitySession) {
        if (!realitySession.supportsProtocol('ar.configureStage'))
            return Promise.reject('Protocol `ar.configureStage` is not supported');
        return realitySession.request('ar.configureStage.resetStageGeolocation');
    };
    return RealityService;
}());
__decorate([
    deprecated('request'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RealityService.prototype, "setDesired", null);
RealityService = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [SessionService,
        ContextService])
], RealityService);
export { RealityService };
var RealityServiceProvider = (function () {
    function RealityServiceProvider(sessionService, realityService, contextService, deviceService, viewServiceProvider, visibilityServiceProvider, focusServiceProvider, realityViewerFactory) {
        var _this = this;
        this.sessionService = sessionService;
        this.realityService = realityService;
        this.contextService = contextService;
        this.deviceService = deviceService;
        this.viewServiceProvider = viewServiceProvider;
        this.visibilityServiceProvider = visibilityServiceProvider;
        this.focusServiceProvider = focusServiceProvider;
        this.realityViewerFactory = realityViewerFactory;
        /**
         * An event that is raised when a reality viewer is installed.
         */
        this.installedEvent = new Event();
        /**
         * An event that is raised when a reality viewer is uninstalled.
         */
        this.uninstalledEvent = new Event();
        this._viewerByURI = new Map();
        this._installersByURI = new Map();
        this._scratchFrustum = new PerspectiveFrustum;
        sessionService.ensureIsRealityManager();
        sessionService.manager.connectEvent.addEventListener(function () {
            setTimeout(function () {
                if (!_this._presentingRealityViewer && _this.realityService.default)
                    _this._handleRequest(_this.sessionService.manager, {
                        uri: _this.realityService.default
                    });
            });
        });
        sessionService.manager.closeEvent.addEventListener(function () {
            _this._viewerByURI.forEach(function (v) {
                v.destroy();
            });
        });
        sessionService.connectEvent.addEventListener(function (session) {
            if (!Role.isRealityViewer(session.info.role)) {
                session.on['ar.reality.install'] = function (_a) {
                    var uri = _a.uri;
                    return _this._handleInstall(session, uri);
                };
                session.on['ar.reality.uninstall'] = function (_a) {
                    var uri = _a.uri;
                    return _this._handleUninstall(session, uri);
                };
                session.on['ar.reality.request'] = function (message) {
                    return _this._handleRequest(session, message);
                };
                // For backwards compatability. 
                session.on['ar.reality.desired'] = function (message) {
                    var reality = message.reality;
                    if (reality) {
                        if (reality['type']) {
                            var type = reality['type'];
                            reality.uri = reality.uri || 'reality:' + type;
                            if (type === 'hosted')
                                reality.uri = reality['url'];
                        }
                    }
                    _this._handleRequest(session, { uri: reality.uri });
                };
            }
        });
        this.viewServiceProvider.forwardedUIEvent.addEventListener(function (uievent) {
            var session = _this._presentingRealityViewer && _this._presentingRealityViewer.session;
            if (session)
                _this.viewServiceProvider.sendUIEventToSession(uievent, session);
        });
    }
    Object.defineProperty(RealityServiceProvider.prototype, "presentingRealityViewer", {
        get: function () { return this._presentingRealityViewer; },
        enumerable: true,
        configurable: true
    });
    RealityServiceProvider.prototype._handleInstall = function (session, uri) {
        var _this = this;
        var installers = this._installersByURI.get(uri);
        if (installers) {
            installers.add(session);
        }
        else {
            var viewer_1 = this.realityViewerFactory.createRealityViewer(uri);
            this._viewerByURI.set(uri, viewer_1);
            installers = new Set();
            installers.add(session);
            this._installersByURI.set(uri, installers);
            viewer_1.connectEvent.addEventListener(function (viewerSession) {
                if (_this.sessionService.manager.isClosed)
                    return;
                if (!Role.isRealityViewer(viewerSession.info.role)) {
                    viewerSession.sendError({ message: "Expected a reality viewer" });
                    viewerSession.close();
                    throw new Error('The application "' + viewerSession.uri + '" does not support being loaded as a reality viewer');
                }
                viewerSession.on['ar.reality.frameState'] = function (frame) {
                    if (_this._presentingRealityViewer === viewer_1) {
                        if (viewerSession.version[0] === 0) {
                            var deviceState = _this.deviceService.frameState;
                            if (!deviceState)
                                return;
                            frame.viewport = CanvasViewport.clone(deviceState.viewport, frame.viewport);
                            frame.subviews = SerializedSubviewList.clone(deviceState.subviews, frame.subviews);
                            var eye = frame['eye'];
                            var eyePose = eye.pose;
                            var eyeFov = eye.fov;
                            frame.entities = frame.entities || {};
                            frame.entities['ar.user'] = eyePose;
                            for (var _i = 0, _a = frame.subviews; _i < _a.length; _i++) {
                                var s = _a[_i];
                                var f = decomposePerspectiveProjectionMatrix(s.projectionMatrix, s['frustum'] || {});
                                f.fov = eyeFov;
                                _this._scratchFrustum.clone(f);
                                s.projectionMatrix = Matrix4.clone(_this._scratchFrustum.projectionMatrix, s.projectionMatrix);
                            }
                        }
                        frame.reality = viewer_1.uri;
                        _this.contextService.submitFrameState(frame);
                    }
                };
                if (viewerSession.info['supportsCustomProtocols']) {
                    _this._connectViewerWithSession(viewerSession, _this.sessionService.manager);
                    for (var _i = 0, _a = _this.sessionService.managedSessions; _i < _a.length; _i++) {
                        session = _a[_i];
                        _this._connectViewerWithSession(viewerSession, session);
                    }
                    var remove_1 = _this.sessionService.connectEvent.addEventListener(function (session) {
                        _this._connectViewerWithSession(viewerSession, session);
                    });
                    viewerSession.closeEvent.addEventListener(function () { return remove_1(); });
                }
                var removePresentChangeListener = viewer_1.presentChangeEvent.addEventListener(function () {
                    _this.visibilityServiceProvider.set(viewerSession, viewer_1.isPresenting);
                });
                _this.visibilityServiceProvider.set(viewerSession, viewer_1.isPresenting);
                viewerSession.closeEvent.addEventListener(function () {
                    removePresentChangeListener();
                    _this.contextService.entities.removeById(viewerSession.uri);
                    console.log('Reality session closed: ' + uri);
                });
            });
            viewer_1.load();
            this.installedEvent.raiseEvent({ viewer: viewer_1 });
        }
    };
    RealityServiceProvider.prototype._connectViewerWithSession = function (viewerSession, session) {
        if (Role.isRealityViewer(session.info.role))
            return;
        var id = createGuid();
        var ROUTE_MESSAGE_KEY = 'ar.reality.message.route.' + id;
        var SEND_MESSAGE_KEY = 'ar.reality.message.send.' + id;
        var CLOSE_SESSION_KEY = 'ar.reality.close.' + id;
        viewerSession.on[ROUTE_MESSAGE_KEY] = function (message) {
            session.send(SEND_MESSAGE_KEY, message);
        };
        session.on[ROUTE_MESSAGE_KEY] = function (message) {
            viewerSession.send(SEND_MESSAGE_KEY, message);
        };
        viewerSession.send('ar.reality.connect', { id: id });
        session.send('ar.reality.connect', { id: id });
        viewerSession.closeEvent.addEventListener(function () {
            session.send(CLOSE_SESSION_KEY);
        });
        session.closeEvent.addEventListener(function () {
            viewerSession.send(CLOSE_SESSION_KEY);
        });
    };
    RealityServiceProvider.prototype._handleUninstall = function (session, uri) {
        var installers = this._installersByURI.get(uri);
        if (installers) {
            if (installers.size === 0) {
                var viewer = this._viewerByURI.get(uri);
                this._viewerByURI.delete(uri);
                viewer.destroy();
                this.uninstalledEvent.raiseEvent({ viewer: viewer });
            }
        }
        return Promise.reject(new Error("Unable to uninstall a reality viewer which is not installed"));
    };
    RealityServiceProvider.prototype._handleRequest = function (session, options) {
        if (this.focusServiceProvider.session === session || session === this.sessionService.manager) {
            var uri = options && options.uri || RealityViewer.DEFAULT;
            switch (uri) {
                case RealityViewer.DEFAULT:
                    uri = this.realityService.default;
            }
            this._handleInstall(session, uri);
            this._setPresentingRealityViewer(this._viewerByURI.get(uri));
            return Promise.resolve();
        }
        throw new Error('Request Denied');
    };
    RealityServiceProvider.prototype._setPresentingRealityViewer = function (viewer) {
        if (!viewer)
            throw new Error('Invalid State. Expected a RealityViewer instance');
        if (this._presentingRealityViewer === viewer)
            return;
        this._viewerByURI.forEach(function (v) {
            v.setPresenting(v === viewer);
        });
        this._presentingRealityViewer = viewer;
        console.log('Presenting reality viewer changed to: ' + viewer.uri);
    };
    RealityServiceProvider.prototype.getViewerByURI = function (uri) {
        return this._viewerByURI.get(uri);
    };
    RealityServiceProvider.prototype.removeInstaller = function (installerSession) {
        var _this = this;
        this._viewerByURI.forEach(function (viewer, realityUri, map) {
            var installers = _this._installersByURI.get(realityUri);
            if (installers && installers.has(installerSession)) {
                installers.delete(installerSession);
                if (installers.size === 0 && viewer.session) {
                    _this._handleUninstall(viewer.session, realityUri);
                    _this._installersByURI.delete(realityUri);
                }
            }
        });
    };
    return RealityServiceProvider;
}());
RealityServiceProvider = __decorate([
    autoinject,
    __metadata("design:paramtypes", [SessionService,
        RealityService,
        ContextService,
        DeviceService,
        ViewServiceProvider,
        VisibilityServiceProvider,
        FocusServiceProvider,
        RealityViewerFactory])
], RealityServiceProvider);
export { RealityServiceProvider };
