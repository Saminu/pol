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
import { inject } from 'aurelia-dependency-injection';
import { SessionService } from './session';
import { Event, resolveURL, deprecated } from './utils';
/**
 * A service which handles requests from a VuforiaService
 */
var VuforiaServiceProvider = (function () {
    function VuforiaServiceProvider(sessionService) {
        if (sessionService.isRealityManager) {
            sessionService.connectEvent.addEventListener(function (session) {
                session.on['ar.vuforia.isAvailable'] = function () { return Promise.resolve({ available: false }); };
            });
            sessionService.connectEvent.addEventListener(function (session) {
                session.on['ar.vuforia.init'] = function () { return Promise.reject(new Error("Vuforia is not supported on this system")); };
            });
        }
    }
    return VuforiaServiceProvider;
}());
VuforiaServiceProvider = __decorate([
    inject(SessionService),
    __metadata("design:paramtypes", [SessionService])
], VuforiaServiceProvider);
export { VuforiaServiceProvider };
/**
 * Enum for the setHint function
 */
export var VuforiaHint;
(function (VuforiaHint) {
    VuforiaHint[VuforiaHint["MaxSimultaneousImageTargets"] = 0] = "MaxSimultaneousImageTargets";
    VuforiaHint[VuforiaHint["MaxSimultaneousObjectTargets"] = 1] = "MaxSimultaneousObjectTargets";
    VuforiaHint[VuforiaHint["DelayedLoadingObjectDatasets"] = 2] = "DelayedLoadingObjectDatasets";
})(VuforiaHint || (VuforiaHint = {}));
/**
 * A service for interacting with the Vuforia API
 */
var VuforiaService = (function () {
    function VuforiaService(sessionService) {
        this.sessionService = sessionService;
    }
    /**
     * Resolves to a boolean indicating whether or not the Vuforia API is available on this system
     */
    VuforiaService.prototype.isAvailable = function () {
        return this.sessionService.manager.request('ar.vuforia.isAvailable').then(function (message) {
            return message.available;
        });
    };
    /**
     * Initialize vuforia using an encrypted license.
     * You can get a vuforia license key from https://developer.vuforia.com/
     * You can encrypt your vuforia license with the tool at http://docs.argonjs.io/start/vuforia-pgp-encryptor
     */
    VuforiaService.prototype.init = function (options) {
        var _this = this;
        if (typeof options === 'string')
            options = { encryptedLicenseData: options };
        if (!options.encryptedLicenseData || typeof options.encryptedLicenseData !== 'string')
            throw new Error('options.encryptedLicenseData is required.');
        return this.sessionService.manager.request('ar.vuforia.init', options).then(function () {
            return new VuforiaAPI(_this.sessionService.manager);
        });
    };
    /**
     * Initialize vuforia with an unecrypted key.
     * It's a bad idea to publish your unencrypted vuforia key on the internet.
     * @private
     */
    VuforiaService.prototype.initWithUnencryptedKey = function (options) {
        var _this = this;
        if (typeof options === 'string')
            options = { key: options };
        return this.sessionService.manager.request('ar.vuforia.init', options).then(function () {
            return new VuforiaAPI(_this.sessionService.manager);
        });
    };
    return VuforiaService;
}());
VuforiaService = __decorate([
    inject(SessionService, VuforiaServiceProvider),
    __metadata("design:paramtypes", [SessionService])
], VuforiaService);
export { VuforiaService };
var VuforiaAPI = (function () {
    function VuforiaAPI(manager) {
        this.manager = manager;
        this.objectTracker = new VuforiaObjectTracker(manager);
    }
    // setHint should be called after Vuforia is initialized
    VuforiaAPI.prototype.setHint = function (hint, value) {
        var options = { hint: hint, value: value };
        return this.manager.request('ar.vuforia.setHint', options).then(function (message) {
            return message.result;
        });
    };
    return VuforiaAPI;
}());
export { VuforiaAPI };
var VuforiaTracker = (function () {
    function VuforiaTracker() {
    }
    return VuforiaTracker;
}());
export { VuforiaTracker };
/**
 * Vuforia Object Tracker
 */
var VuforiaObjectTracker = (function (_super) {
    __extends(VuforiaObjectTracker, _super);
    function VuforiaObjectTracker(managerSession) {
        var _this = _super.call(this) || this;
        _this.managerSession = managerSession;
        _this.dataSetLoadEvent = new Event();
        _this.dataSetUnloadEvent = new Event();
        _this.dataSetActivateEvent = new Event();
        _this.dataSetDeactivateEvent = new Event();
        _this._deprecatedDataSetInstanceMap = new Map();
        managerSession.on['ar.vuforia.objectTrackerLoadDataSetEvent'] = function (message) {
            _this.dataSetLoadEvent.raiseEvent(message);
        };
        managerSession.on['ar.vuforia.objectTrackerUnloadDataSetEvent'] = function (message) {
            _this.dataSetUnloadEvent.raiseEvent(message);
        };
        managerSession.on['ar.vuforia.objectTrackerActivateDataSetEvent'] = function (message) {
            var deprecatedDataSetInstance = _this._deprecatedDataSetInstanceMap.get(message.id);
            if (deprecatedDataSetInstance) {
                deprecatedDataSetInstance._onActivate();
                _this.dataSetActivateEvent.raiseEvent(deprecatedDataSetInstance);
            }
            else
                _this.dataSetActivateEvent.raiseEvent(message);
        };
        managerSession.on['ar.vuforia.objectTrackerDeactivateDataSetEvent'] = function (message) {
            var deprecatedDataSetInstance = _this._deprecatedDataSetInstanceMap.get(message.id);
            if (deprecatedDataSetInstance) {
                deprecatedDataSetInstance._onDeactivate();
                _this.dataSetActivateEvent.raiseEvent(deprecatedDataSetInstance);
            }
            else
                _this.dataSetDeactivateEvent.raiseEvent(message);
        };
        return _this;
    }
    /**
     * Deprecated. Please use createDataSetFromURI instead.
     * @deprecated To be removed.
     */
    VuforiaObjectTracker.prototype.createDataSet = function (url) {
        var _this = this;
        if (url && window.document) {
            url = resolveURL(url);
        }
        return this.managerSession.request('ar.vuforia.objectTrackerCreateDataSet', { url: url }).then(function (message) {
            var dataSet = new DeprecatedVuforiaDataSet(message.id, _this.managerSession);
            _this._deprecatedDataSetInstanceMap.set(message.id, dataSet);
            return dataSet;
        });
    };
    /**
     * Fetch a dataset from the provided url.
     * If successfull, resolves to an id which represents the dataset.
     */
    VuforiaObjectTracker.prototype.createDataSetFromURL = function (url) {
        if (url && window.document) {
            url = resolveURL(url);
        }
        return this.managerSession.request('ar.vuforia.objectTrackerCreateDataSet', { url: url })
            .then(function (message) {
            return message.id;
        });
    };
    Object.defineProperty(VuforiaObjectTracker.prototype, "createDataSetFromURI", {
        get: function () { return this.createDataSetFromURL; },
        enumerable: true,
        configurable: true
    });
    ;
    /**
     * Load the dataset into memory, and return a promise which
     * resolves to the contained trackables
     */
    VuforiaObjectTracker.prototype.loadDataSet = function (id) {
        var _this = this;
        return this.managerSession.whenConnected().then(function () {
            if (_this.managerSession.version[0] == 0) {
                return _this.managerSession.request('ar.vuforia.dataSetLoad', { id: id });
            }
            return _this.managerSession.request('ar.vuforia.objectTrackerLoadDataSet', { id: id });
        });
    };
    /**
     * Unload a dataset from memory (deactivating it if necessary)
     */
    VuforiaObjectTracker.prototype.unloadDataSet = function (id) {
        var _this = this;
        return this.managerSession.whenConnected().then(function () {
            if (_this.managerSession.version[0] == 0) {
                return _this.deactivateDataSet(id);
            }
            return _this.managerSession.request('ar.vuforia.objectTrackerUnloadDataSet', { id: id });
        });
    };
    /**
     * Load (if necessary) and activate a dataset to enable tracking of the contained trackables
     */
    VuforiaObjectTracker.prototype.activateDataSet = function (id) {
        id = (id instanceof DeprecatedVuforiaDataSet) ? id.id : id; // backwards compatability
        return this.managerSession.request('ar.vuforia.objectTrackerActivateDataSet', { id: id });
    };
    /**
     * Deactivate a loaded dataset to disable tracking of the contained trackables
     */
    VuforiaObjectTracker.prototype.deactivateDataSet = function (id) {
        id = (id instanceof DeprecatedVuforiaDataSet) ? id.id : id; // backwards compatability
        return this.managerSession.request('ar.vuforia.objectTrackerDeactivateDataSet', { id: id });
    };
    return VuforiaObjectTracker;
}(VuforiaTracker));
export { VuforiaObjectTracker };
__decorate([
    deprecated('createDataSetFromURL'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VuforiaObjectTracker.prototype, "createDataSet", null);
__decorate([
    deprecated('createDataSetFromURL'),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], VuforiaObjectTracker.prototype, "createDataSetFromURI", null);
/**
 * @deprecated To be removed.
 */
var DeprecatedVuforiaDataSet = (function () {
    function DeprecatedVuforiaDataSet(id, managerSession) {
        this.id = id;
        this.managerSession = managerSession;
        this._isActive = false;
    }
    DeprecatedVuforiaDataSet.prototype._onActivate = function () {
        this._isActive = true;
    };
    DeprecatedVuforiaDataSet.prototype._onDeactivate = function () {
        this._isActive = false;
    };
    DeprecatedVuforiaDataSet.prototype.fetch = function () {
        return this.managerSession.request('ar.vuforia.dataSetFetch', { id: this.id });
    };
    DeprecatedVuforiaDataSet.prototype.load = function () {
        var _this = this;
        return this.managerSession.request('ar.vuforia.dataSetLoad', { id: this.id }).then(function (trackables) {
            _this._trackables = trackables;
            return trackables;
        });
    };
    DeprecatedVuforiaDataSet.prototype.isActive = function () {
        return this._isActive;
    };
    DeprecatedVuforiaDataSet.prototype.getTrackables = function () {
        return this._trackables;
    };
    return DeprecatedVuforiaDataSet;
}());
export { DeprecatedVuforiaDataSet };
