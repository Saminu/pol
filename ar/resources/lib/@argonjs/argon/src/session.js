var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { createGuid, defined } from './cesium/cesium-imports';
import { autoinject } from 'aurelia-dependency-injection';
import { Role, Configuration } from './common';
import { deprecated, Event, MessageChannelFactory, isIOS } from './utils';
import { version } from '../package.json';
export { version };
;
var emptyObject = Object.freeze({});
/**
 * Provides two-way communication between two [[SessionPort]] instances.
 */
var SessionPort = (function () {
    function SessionPort(uri) {
        var _this = this;
        this.uri = uri;
        this.id = createGuid();
        this._connectEvent = new Event();
        /**
         * An event which fires when this port has closed
         */
        this.closeEvent = new Event();
        /**
         * An error which fires when an error occurs.
         */
        this.errorEvent = new Event();
        /**
         * A map from topic to message handler.
         */
        this.on = {};
        /**
         * If true, don't raise an error when receiving a message for an unknown topic
         */
        this.suppressErrorOnUnknownTopic = false;
        this._isOpened = false;
        this._isConnected = false;
        this._isClosed = false;
        this.on[SessionPort.OPEN] = function (info) {
            if (!info)
                throw new Error("Session did not provide a configuration (" + _this.uri + ")");
            if (_this._isConnected)
                throw new Error("Session has already connected! (" + _this.uri + ")");
            _this._info = info;
            _this._version = info.version || [0];
            _this._isConnected = true;
            _this._connectEvent.raiseEvent(undefined);
        };
        this.on[SessionPort.CLOSE] = function () {
            _this._isClosed = true;
            _this._isConnected = false;
            if (_this.messagePort && _this.messagePort.close)
                _this.messagePort.close();
            _this.closeEvent.raiseEvent(undefined);
        };
        this.on[SessionPort.ERROR] = function (error) {
            var e = new Error("Session Error: " + error.message);
            if (error.stack)
                e['stack'] = error.stack;
            _this.errorEvent.raiseEvent(e);
        };
        this.errorEvent.addEventListener(function (error) {
            if (_this.errorEvent.numberOfListeners === 1)
                console.error(error);
        });
    }
    Object.defineProperty(SessionPort.prototype, "connectEvent", {
        /**
         * An event which fires when a connection has been
         * established to the other [[SessionPort]].
         */
        get: function () {
            if (this._isConnected)
                throw new Error('The connectEvent only fires once and the session is already connected.');
            return this._connectEvent;
        },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(SessionPort.prototype, "info", {
        /**
         * Describes the configuration of the connected session.
         */
        get: function () {
            if (!this.isConnected) {
                throw new Error('info is not available until the session is connected.');
            }
            return this._info;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionPort.prototype, "version", {
        /**
         * The version of argon.js which is used by the connecting session.
         * This property is an empty array until the session connects.
         */
        get: function () {
            if (!defined(this._version)) {
                throw new Error('version is not available until the session is opened.');
            }
            return this._version;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Check if a protocol is supported by this session.
     */
    SessionPort.prototype.supportsProtocol = function (name, versions) {
        if (!this._isConnected)
            throw new Error('Session has not yet connected');
        var protocols = this.info.protocols;
        if (!protocols)
            return false;
        var supported = false;
        var foundVersions = new Set();
        protocols.forEach(function (p) {
            if (p.indexOf(name) !== -1) {
                var v = (+p.split('@v')[1]) || 0;
                foundVersions.add(v);
            }
        });
        if (versions) {
            if (Array.isArray(versions)) {
                versions.forEach(function (v) {
                    if (foundVersions.has(v)) {
                        supported = true;
                    }
                });
            }
            else {
                if (foundVersions.has(versions)) {
                    supported = true;
                }
            }
        }
        else if (!versions) {
            supported = true;
        }
        return supported;
    };
    SessionPort.prototype.whenConnected = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.isConnected)
                resolve();
            var remove = _this._connectEvent.addEventListener(function () {
                remove();
                resolve();
            });
        });
    };
    /**
     * Establish a connection to another [[SessionPort]] via the provided [[MessagePort]] instance.
     * @param messagePort the message port to post and receive messages.
     * @param options the configuration which describes this [[ArgonSystem]].
     */
    SessionPort.prototype.open = function (messagePort, options) {
        var _this = this;
        if (this._isClosed)
            return;
        if (this._isOpened)
            throw new Error('Session can only be opened once');
        if (!options)
            throw new Error('Session options must be provided');
        this.messagePort = messagePort;
        this._isOpened = true;
        this.messagePort.onmessage = function (evt) {
            if (_this._isClosed)
                return;
            var data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
            var id = data[0];
            var topic = data[1];
            var message = data[2] || emptyObject;
            var expectsResponse = data[3];
            var handler = _this.on[topic];
            if (handler && !expectsResponse) {
                try {
                    var response = handler(message, evt);
                    if (response)
                        console.warn("Handler for " + topic + " returned an unexpected response");
                }
                catch (e) {
                    _this.sendError(e);
                    _this.errorEvent.raiseEvent(e);
                }
            }
            else if (handler) {
                var response = new Promise(function (resolve) { return resolve(handler(message, evt)); });
                Promise.resolve(response).then(function (response) {
                    if (_this._isClosed)
                        return;
                    _this.send(topic + ':resolve:' + id, response);
                }).catch(function (error) {
                    if (_this._isClosed)
                        return;
                    var errorMessage;
                    if (typeof error === 'string')
                        errorMessage = error;
                    else if (typeof error.message === 'string')
                        errorMessage = error.message;
                    _this.send(topic + ':reject:' + id, { reason: errorMessage });
                });
            }
            else if (!_this.suppressErrorOnUnknownTopic) {
                var errorMessage = 'Unable to handle message for topic ' + topic + ' (' + _this.uri + ')';
                if (expectsResponse) {
                    _this.send(topic + ':reject:' + id, { reason: errorMessage });
                }
                _this.errorEvent.raiseEvent(new Error(errorMessage));
            }
        };
        this.send(SessionPort.OPEN, options);
    };
    /**
     * Send a message
     * @param topic the message topic.
     * @param message the message to be sent.
     * @return Return true if the message is posted successfully,
     * return false if the session is closed.
     */
    SessionPort.prototype.send = function (topic, message) {
        if (!this._isOpened)
            throw new Error('Session must be open to send messages');
        if (this._isClosed)
            return false;
        var id = createGuid();
        var packet = [id, topic, message];
        this.messagePort.postMessage(isIOS ? packet : JSON.stringify(packet)); // http://blog.runspired.com/2016/03/15/webworker-performance-benchmarks/
        return true;
    };
    /**
     * Send an error message.
     * @param errorMessage An error message.
     * @return Return true if the error message is sent successfully,
     * otherwise, return false.
     */
    SessionPort.prototype.sendError = function (e) {
        var errorMessage = e;
        if (errorMessage instanceof Error) {
            errorMessage = {
                message: errorMessage.message,
                stack: errorMessage['stack']
            };
        }
        return this.send(SessionPort.ERROR, errorMessage);
    };
    /**
     * Send a request and return a promise for the result.
     * @param topic the message topic.
     * @param message the message to be sent.
     * @return if the session is not opened or is closed, return a rejected promise,
     * Otherwise, the returned promise is resolved or rejected based on the response.
     */
    SessionPort.prototype.request = function (topic, message) {
        var _this = this;
        if (!this._isOpened || this._isClosed)
            throw new Error('Session must be open to make requests');
        var id = createGuid();
        var resolveTopic = topic + ':resolve:' + id;
        var rejectTopic = topic + ':reject:' + id;
        var result = new Promise(function (resolve, reject) {
            _this.on[resolveTopic] = function (message) {
                delete _this.on[resolveTopic];
                delete _this.on[rejectTopic];
                resolve(message);
            };
            _this.on[rejectTopic] = function (message) {
                delete _this.on[resolveTopic];
                delete _this.on[rejectTopic];
                console.warn("Request '" + topic + "' rejected with reason:\n" + message.reason);
                reject(new Error(message.reason));
            };
        });
        var packet = [id, topic, message, true];
        this.messagePort.postMessage(isIOS ? packet : JSON.stringify(packet)); // http://blog.runspired.com/2016/03/15/webworker-performance-benchmarks/
        return result;
    };
    /**
     * Close the connection to the remote session.
     */
    SessionPort.prototype.close = function () {
        if (this._isClosed)
            return;
        if (this._isOpened) {
            this.send(SessionPort.CLOSE);
        }
        this._isClosed = true;
        this._isConnected = false;
        if (this.messagePort && this.messagePort.close)
            this.messagePort.close();
        this.closeEvent.raiseEvent(undefined);
    };
    Object.defineProperty(SessionPort.prototype, "isConnected", {
        get: function () {
            return this._isConnected;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionPort.prototype, "isClosed", {
        get: function () {
            return this._isClosed;
        },
        enumerable: true,
        configurable: true
    });
    return SessionPort;
}());
export { SessionPort };
SessionPort.OPEN = 'ar.session.open';
SessionPort.CLOSE = 'ar.session.close';
SessionPort.ERROR = 'ar.session.error';
/**
 * A factory for creating [[SessionPort]] instances.
 */
var SessionPortFactory = (function () {
    function SessionPortFactory() {
    }
    SessionPortFactory.prototype.create = function (uri) {
        return new SessionPort(uri);
    };
    return SessionPortFactory;
}());
export { SessionPortFactory };
/**
 * A service for establishing a connection to the [[REALITY_MANAGER]].
 */
var ConnectService = (function () {
    function ConnectService() {
    }
    return ConnectService;
}());
export { ConnectService };
/**
 * A service for managing connections to other ArgonSystem instances
 */
var SessionService = (function () {
    function SessionService(
        /**
         * The configuration of this [[ArgonSystem]]
         */
        configuration, connectService, sessionPortFactory, messageChannelFactory) {
        var _this = this;
        this.configuration = configuration;
        this.connectService = connectService;
        this.sessionPortFactory = sessionPortFactory;
        this.messageChannelFactory = messageChannelFactory;
        /**
         * The port which handles communication between this session and the manager session.
         */
        this.manager = this.createSessionPort('argon:manager');
        /**
         * An event that is raised when an error occurs.
         */
        this.errorEvent = new Event();
        this._connectEvent = new Event();
        this._managedSessions = [];
        configuration.version = extractVersion(version);
        configuration.uri = (typeof window !== 'undefined' && window.location) ?
            window.location.href : undefined;
        configuration.title = (typeof document !== 'undefined') ?
            document.title : undefined;
        this.errorEvent.addEventListener(function (error) {
            if (_this.errorEvent.numberOfListeners === 1)
                console.error(error);
        });
        this.manager.errorEvent.addEventListener(function (error) {
            _this.errorEvent.raiseEvent(error);
        });
        this.manager.closeEvent.addEventListener(function () {
            _this.managedSessions.forEach(function (s) {
                s.close();
            });
        });
        Object.freeze(this);
    }
    Object.defineProperty(SessionService.prototype, "connectEvent", {
        /**
         * An event that is raised when a managed session is opened.
         */
        get: function () {
            return this._connectEvent;
        },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(SessionService.prototype, "managedSessions", {
        /**
         * Manager-only. A collection of ports for each managed session.
         */
        get: function () {
            return this._managedSessions;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Establishes a connection with the [[REALITY_MANAGER]].
     * Called internally by the composition root ([[ArgonSystem]]).
     */
    SessionService.prototype.connect = function () {
        if (this.connectService && this.connectService.connect) {
            this.connectService.connect(this);
        }
        else {
            console.warn('Argon: Unable to connect to a manager session; a connect service is not available');
        }
    };
    /**
     * Manager-only. Creates a [[SessionPort]] that is managed by the current [[ArgonSystem]].
     * Session ports that are managed will automatically forward open events to
     * [[SessionService#sessionConnectEvent]] and error events to [[SessionService#errorEvent]].
     * Other services that are part of the current [[ArgonSystem]] are likely to
     * add message handlers to a newly connected [[SessionPort]].
     * @return a new [[SessionPort]] instance
     */
    SessionService.prototype.addManagedSessionPort = function (uri) {
        var _this = this;
        this.ensureIsRealityManager();
        var session = this.sessionPortFactory.create(uri);
        session.errorEvent.addEventListener(function (error) {
            _this.errorEvent.raiseEvent(error);
        });
        session.connectEvent.addEventListener(function () {
            _this.managedSessions.push(session);
            _this.connectEvent.raiseEvent(session);
        });
        session.closeEvent.addEventListener(function () {
            var index = _this.managedSessions.indexOf(session);
            if (index > -1)
                _this.managedSessions.splice(index, 1);
        });
        return session;
    };
    /**
     * Creates a [[SessionPort]] that is not managed by the current [[ArgonSystem]].
     * Unmanaged session ports will not forward open events or error events
     * to this [[ArgonSystem]].
     * @return a new SessionPort instance
     */
    SessionService.prototype.createSessionPort = function (uri) {
        return this.sessionPortFactory.create(uri);
    };
    /**
     * Creates a message channel which asyncrhonously sends and receives messages.
     */
    SessionService.prototype.createMessageChannel = function () {
        return this.messageChannelFactory.create();
    };
    /**
     * Creates a message channel which syncrhonously sends and receives messages.
     */
    SessionService.prototype.createSynchronousMessageChannel = function () {
        return this.messageChannelFactory.createSynchronous();
    };
    Object.defineProperty(SessionService.prototype, "isRealityManager", {
        /**
         * Returns true if this system represents a [[REALITY_MANAGER]]
         */
        get: function () {
            return Role.isRealityManager(this.configuration && this.configuration.role);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionService.prototype, "isRealityAugmenter", {
        /**
         * Returns true if this system represents a [[REALITY_AUGMENTER]], meaning,
         * it is running within a [[REALITY_MANAGER]]
         */
        get: function () {
            return Role.isRealityAugmenter(this.configuration && this.configuration.role);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionService.prototype, "isRealityViewer", {
        /**
         * Returns true if this system is a [[REALITY_VIEWER]]
         */
        get: function () {
            return Role.isRealityViewer(this.configuration && this.configuration.role);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionService.prototype, "isManager", {
        /**
         * @private
         */
        get: function () { return this.isRealityManager; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionService.prototype, "isApplication", {
        /**
         * @private
         */
        get: function () { return this.isRealityAugmenter; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionService.prototype, "isRealityView", {
        /**
         * @private
         */
        get: function () { return this.isRealityViewer; },
        enumerable: true,
        configurable: true
    });
    /**
     * Throws an error if this system is not a [[REALITY_MANAGER]]
     */
    SessionService.prototype.ensureIsRealityManager = function () {
        if (!this.isRealityManager)
            throw new Error('An reality-manager only API was accessed from a non reality-manager.');
    };
    /**
     * Throws an error if this session is not a [[REALITY_VIEWER]]
     */
    SessionService.prototype.ensureIsRealityViewer = function () {
        if (!this.isRealityViewer)
            throw new Error('An reality-viewer only API was accessed from a non reality-viewer.');
    };
    /**
     * Throws an error if this session is a [[REALITY_VIEWER]]
     */
    SessionService.prototype.ensureNotRealityViewer = function () {
        if (this.isRealityViewer)
            throw new Error('An non-permitted API was accessed from a reality-viewer.');
    };
    /**
     * Throws an error if this session is a [[REALITY_AUGMENTER]]
     */
    SessionService.prototype.ensureNotRealityAugmenter = function () {
        if (this.isRealityAugmenter)
            throw new Error('An non-permitted API was accessed from a reality-viewer.');
    };
    /**
     * Throws an error if the connection to the manager is closed
     */
    SessionService.prototype.ensureConnected = function () {
        if (!this.manager.isConnected)
            throw new Error('Session is not connected to manager');
    };
    return SessionService;
}());
__decorate([
    deprecated('isRealityManager'),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], SessionService.prototype, "isManager", null);
__decorate([
    deprecated('isRealityAugmenter'),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], SessionService.prototype, "isApplication", null);
__decorate([
    deprecated('isRealityViewer'),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], SessionService.prototype, "isRealityView", null);
SessionService = __decorate([
    autoinject,
    __metadata("design:paramtypes", [Configuration,
        ConnectService,
        SessionPortFactory,
        MessageChannelFactory])
], SessionService);
export { SessionService };
/**
 * Connect the current [[ArgonSystem]] to itself as the [[REALITY_MANAGER]].
 */
var LoopbackConnectService = (function (_super) {
    __extends(LoopbackConnectService, _super);
    function LoopbackConnectService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Create a loopback connection.
     */
    LoopbackConnectService.prototype.connect = function (sessionService) {
        var messageChannel = sessionService.createSynchronousMessageChannel();
        var messagePort = messageChannel.port1;
        messageChannel.port2.onmessage = function (evt) {
            messageChannel.port2.postMessage(evt.data);
        };
        sessionService.manager.connectEvent.addEventListener(function () {
            sessionService.connectEvent.raiseEvent(sessionService.manager);
        });
        sessionService.manager.open(messagePort, sessionService.configuration);
    };
    return LoopbackConnectService;
}(ConnectService));
export { LoopbackConnectService };
/**
 * Connect this [[ArgonSystem]] to the [[REALITY_MANAGER]] via the parent document
 * (assuming this system is running in an iFrame).
 */
var DOMConnectService = (function (_super) {
    __extends(DOMConnectService, _super);
    function DOMConnectService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
      * Check whether this connect method is available or not.
      */
    DOMConnectService.isAvailable = function () {
        return typeof window !== 'undefined' && typeof window.parent !== 'undefined';
    };
    /**
     * Connect to the manager.
     */
    DOMConnectService.prototype.connect = function (sessionService) {
        var messageChannel = sessionService.createMessageChannel();
        window.parent.postMessage({ type: 'ARGON_SESSION', name: window.name }, '*', [messageChannel.port1]);
        sessionService.manager.open(messageChannel.port2, sessionService.configuration);
    };
    return DOMConnectService;
}(ConnectService));
export { DOMConnectService };
/**
 * Connect this system to a remote manager for debugging.
 */
var DebugConnectService = (function (_super) {
    __extends(DebugConnectService, _super);
    function DebugConnectService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Check whether this connect method is available or not.
     */
    DebugConnectService.isAvailable = function () {
        return typeof window !== 'undefined' &&
            !!window['__ARGON_DEBUG_PORT__'];
    };
    /**
     * Connect to the manager.
     */
    DebugConnectService.prototype.connect = function (_a) {
        var manager = _a.manager, configuration = _a.configuration;
        manager.open(window['__ARGON_DEBUG_PORT__'], configuration);
    };
    return DebugConnectService;
}(ConnectService));
export { DebugConnectService };
/**
 * Connect this system via a specified MessagePort.
 */
var SessionConnectService = (function (_super) {
    __extends(SessionConnectService, _super);
    function SessionConnectService(session, parentConfiguration) {
        var _this = _super.call(this) || this;
        _this.session = session;
        _this.parentConfiguration = parentConfiguration;
        return _this;
    }
    /**
     * Check whether this connect method is available or not.
     */
    SessionConnectService.isAvailable = function () {
        return true;
    };
    /**
     * Connect to the manager.
     */
    SessionConnectService.prototype.connect = function (sessionService) {
        var messageChannel = sessionService.createSynchronousMessageChannel();
        this.session.open(messageChannel.port1, this.parentConfiguration);
        sessionService.manager.open(messageChannel.port2, sessionService.configuration);
    };
    return SessionConnectService;
}(ConnectService));
export { SessionConnectService };
/**
 * A service which connects this system to the [[REALITY_MANAGER]] via a WKWebview message handler.
 */
var WKWebViewConnectService = (function (_super) {
    __extends(WKWebViewConnectService, _super);
    function WKWebViewConnectService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Check whether this connect method is available or not.
     */
    WKWebViewConnectService.isAvailable = function () {
        return typeof window !== 'undefined' &&
            window['webkit'] && window['webkit'].messageHandlers;
    };
    /**
     * Connect to the manager.
     */
    WKWebViewConnectService.prototype.connect = function (sessionService) {
        var messageChannel = sessionService.createSynchronousMessageChannel();
        messageChannel.port2.onmessage = function (event) {
            webkit.messageHandlers.argon.postMessage(JSON.stringify(event.data));
        };
        window['__ARGON_PORT__'] = messageChannel.port2;
        sessionService.manager.open(messageChannel.port1, sessionService.configuration);
        window.addEventListener("beforeunload", function () {
            sessionService.manager.close();
        });
    };
    return WKWebViewConnectService;
}(ConnectService));
export { WKWebViewConnectService };
function extractVersion(versionString) {
    var parts = versionString.split('.');
    for (var i = 0, len = parts.length; i < len; ++i) {
        parts[i] = parseInt(parts[i], 10);
    }
    return parts;
}
/**
 * A service which connects this system to the [[REALITY_MANAGER]] via an Android WebView javascript interface.
 */
var AndroidWebViewConnectService = (function (_super) {
    __extends(AndroidWebViewConnectService, _super);
    function AndroidWebViewConnectService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Check whether this connect method is available or not.
     */
    AndroidWebViewConnectService.isAvailable = function () {
        return typeof window !== 'undefined' &&
            window["__argon_android__"];
    };
    /**
     * Connect to the manager.
     */
    AndroidWebViewConnectService.prototype.connect = function (sessionService) {
        var messageChannel = sessionService.createSynchronousMessageChannel();
        messageChannel.port2.onmessage = function (event) {
            window["__argon_android__"].emit("argon", JSON.stringify(event.data));
        };
        window['__ARGON_PORT__'] = messageChannel.port2;
        sessionService.manager.open(messageChannel.port1, sessionService.configuration);
        window.addEventListener("beforeunload", function () {
            sessionService.manager.close();
        });
    };
    return AndroidWebViewConnectService;
}(ConnectService));
export { AndroidWebViewConnectService };
