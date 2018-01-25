var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Entity, ConstantPositionProperty, ConstantProperty, ReferenceFrame, Cartesian3, Matrix3, Matrix4, CesiumMath, Quaternion, JulianDate, PerspectiveFrustum, defined, Cartographic } from './cesium/cesium-imports';
import { autoinject } from 'aurelia-dependency-injection';
import { EntityService, EntityServiceProvider, PoseStatus } from './entity';
import { SessionService } from './session';
import { ArgonSystem } from './argon';
import { AVERAGE_EYE_HEIGHT, DEFAULT_NEAR_PLANE, DEFAULT_FAR_PLANE, CanvasViewport, Viewport, SerializedSubviewList, SubviewType, SerializedSubview } from './common';
import { deprecated, eastUpSouthToFixedFrame, getReachableAncestorReferenceFrames, requestAnimationFrame, cancelAnimationFrame, updateHeightFromTerrain, stringIdentifierFromReferenceFrame, jsonEquals, Event } from './utils';
import { ViewService } from './view';
import { VisibilityService } from './visibility';
var DeviceStableState = (function () {
    function DeviceStableState() {
        this.entities = {};
        this.suggestedGeolocationSubscription = undefined;
        this.suggestedUserHeight = AVERAGE_EYE_HEIGHT;
        this.geolocationDesired = false;
        this.geolocationOptions = {};
        this.isPresentingHMD = false;
        this.isPresentingRealityHMD = false;
        this.strict = false;
    }
    return DeviceStableState;
}());
export { DeviceStableState };
var DeviceFrameState = (function () {
    function DeviceFrameState() {
        this._scratchFrustum = new PerspectiveFrustum();
        this.time = JulianDate.now();
        this.viewport = new CanvasViewport;
        this.subviews = [{
                type: SubviewType.SINGULAR,
                viewport: new Viewport,
                projectionMatrix: (this._scratchFrustum.near = DEFAULT_NEAR_PLANE,
                    this._scratchFrustum.far = DEFAULT_FAR_PLANE,
                    this._scratchFrustum.fov = CesiumMath.PI_OVER_THREE,
                    this._scratchFrustum.aspectRatio = 1,
                    Matrix4.clone(this._scratchFrustum.projectionMatrix))
            }];
    }
    return DeviceFrameState;
}());
export { DeviceFrameState };
;
/**
 * The DeviceService provides the current device state
 */
var DeviceService = (function () {
    function DeviceService(sessionService, entityService, viewService, visibilityService) {
        var _this = this;
        this.sessionService = sessionService;
        this.entityService = entityService;
        this.viewService = viewService;
        this.visibilityService = visibilityService;
        /**
         * If this is true (and we are presenting via webvr api), then
         * vrDisplay.submitFrame is called after the frameState event
         */
        this.autoSubmitFrame = true;
        /**
         * Device state for the current frame. This
         * is not updated unless the view is visible.
         */
        this.frameState = new DeviceFrameState;
        /**
         * An event that fires every time the device frameState is updated.
         */
        this.frameStateEvent = new Event();
        /**
         * An even that fires when the view starts or stops presenting to an HMD
         */
        this.presentHMDChangeEvent = new Event();
        /*
         * An event that fires when the screen orientation changes
         */
        this.screenOrientationChangeEvent = new Event();
        /*
         * An event that fires when the screen orientation changes
         */
        this.suggestedGeolocationSubscriptionChangeEvent = new Event();
        /**
         * A coordinate system representing the physical space in which the user is free to
         * move around, positioned on the surface the user is standing on,
         * where +X is east, +Y is up, and +Z is south (East-Up-South), if geolocation is known.
         * If the stage is not geolocated, then the +X and +Z directions are arbitrary.
         */
        this.stage = this.entityService.collection.add(new Entity({
            id: 'ar.device.stage',
            name: 'Device Stage',
            position: undefined,
            orientation: undefined
        }));
        /**
         * An entity representing the origin of the device coordinate system, +Y up.
         */
        this.origin = this.entityService.collection.add(new Entity({
            id: 'ar.device.origin',
            name: 'Device Origin',
            position: new ConstantPositionProperty(Cartesian3.ZERO, this.stage),
            orientation: new ConstantProperty(Quaternion.IDENTITY)
        }));
        /**
         * An entity representing the physical pose of the user,
         * where +X is right, +Y is up, and -Z is forward
         */
        this.user = this.entityService.collection.add(new Entity({
            id: 'ar.device.user',
            name: 'Device User',
            position: undefined,
            orientation: undefined
        }));
        this._geolocationDesired = false;
        this.defaultUserHeight = AVERAGE_EYE_HEIGHT;
        this._scratchCartesian = new Cartesian3;
        this._scratchFrustum = new PerspectiveFrustum();
        this._updatingFrameState = false;
        this._updateFrameState = function () {
            if (!_this._updatingFrameState)
                return;
            _this.requestAnimationFrame(_this._updateFrameState);
            var state = _this.frameState;
            JulianDate.now(state.time);
            state['strict'] = _this.strict; // backwards-compat
            _this.onUpdateFrameState();
            try {
                _this.frameStateEvent.raiseEvent(state);
            }
            catch (e) {
                _this.sessionService.manager.sendError(e);
                _this.sessionService.errorEvent.raiseEvent(e);
            }
        };
        /**
         * Request an animation frame callback for the current view.
         */
        this.requestAnimationFrame = function (callback) {
            if (_this._vrDisplay && _this.isPresentingHMD) {
                return _this._vrDisplay.requestAnimationFrame(callback);
            }
            else {
                return requestAnimationFrame(callback);
            }
        };
        /**
         * Cancel an animation frame callback for the current view.
         */
        this.cancelAnimationFrame = function (id) {
            if (_this._vrDisplay && _this.isPresentingHMD) {
                _this._vrDisplay.cancelAnimationFrame(id);
            }
            else {
                cancelAnimationFrame(id);
            }
        };
        this._stringIdentifierFromReferenceFrame = stringIdentifierFromReferenceFrame;
        this._getReachableAncestorReferenceFrames = getReachableAncestorReferenceFrames;
        this._scratchArray = [];
        this._originPose = this.entityService.createEntityPose(this.origin, this.stage);
        this._scratchQuaternion = new Quaternion;
        this._scratchQuaternion2 = new Quaternion;
        this._scratchMatrix3 = new Matrix3;
        this._scratchMatrix4 = new Matrix4;
        this._defaultLeftBounds = [0.0, 0.0, 0.5, 1.0];
        this._defaultRightBounds = [0.5, 0.0, 0.5, 1.0];
        this._negX90 = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, -CesiumMath.PI_OVER_TWO);
        this.visibilityService.showEvent.addEventListener(function () { return _this._startUpdates(); });
        this.visibilityService.hideEvent.addEventListener(function () { return _this._stopUpdates(); });
        if (typeof navigator !== 'undefined' &&
            navigator.getVRDisplays &&
            navigator.userAgent.indexOf('Argon') > 0 === false) {
            this._setupVRPresentChangeHandler();
            navigator.getVRDisplays().then(function (displays) {
                _this._vrDisplays = displays;
                _this._vrDisplay = displays[0];
            });
        }
        if (typeof window !== 'undefined' && window.addEventListener) {
            var orientationChangeListener_1 = function () {
                _this.screenOrientationChangeEvent.raiseEvent(undefined);
            };
            window.addEventListener('orientationchange', orientationChangeListener_1);
            sessionService.manager.closeEvent.addEventListener(function () {
                window.removeEventListener('orientationchange', orientationChangeListener_1);
            });
        }
        if (this.sessionService.isRealityManager) {
            this.entityService.subscribedEvent.addEventListener(function (evt) {
                if (evt.id === 'ar.stage')
                    _this._setSuggestedGeolocationSubscription(evt.options || {});
            });
            this.entityService.unsubscribedEvent.addEventListener(function (evt) {
                if (evt.id === 'ar.stage')
                    _this._setSuggestedGeolocationSubscription(undefined);
            });
        }
        else {
            sessionService.manager.on['ar.device.state'] = sessionService.manager.on['ar.device.frameState'] = function (stableState) {
                var entities = stableState.entities;
                var entityService = _this.entityService;
                if (entities)
                    for (var id in entities) {
                        entityService.updateEntityFromSerializedState(id, entities[id]);
                    }
                _this._setSuggestedGeolocationSubscription(stableState.geolocationOptions || stableState.suggestedGeolocationSubscription);
                ;
                if (_this._parentState && _this._parentState.isPresentingHMD !== stableState.isPresentingHMD ||
                    _this._parentState && _this._parentState.isPresentingRealityHMD !== stableState.isPresentingRealityHMD) {
                    _this.presentHMDChangeEvent.raiseEvent(undefined);
                }
                _this._parentState = stableState;
            };
        }
    }
    Object.defineProperty(DeviceService.prototype, "geoHeadingAccuracy", {
        get: function () {
            return this.user['meta'] ? this.user['meta'].geoHeadingAccuracy : undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "geoHorizontalAccuracy", {
        get: function () {
            return this.stage['meta'] ? this.stage['meta'].geoHorizonatalAccuracy : undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "geoVerticalAccuracy", {
        get: function () {
            return this.stage['meta'] ? this.stage['meta'].geoVerticalAccuracy : undefined;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "geolocationDesired", {
        get: function () {
            return this._parentState ?
                this._parentState.suggestedGeolocationSubscription || this._parentState.geolocationDesired :
                this._geolocationDesired;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "geolocationOptions", {
        get: function () {
            return this._parentState ?
                this._parentState.suggestedGeolocationSubscription || this._parentState.geolocationOptions :
                this._geolocationOptions;
        },
        enumerable: true,
        configurable: true
    });
    DeviceService.prototype._setSuggestedGeolocationSubscription = function (options) {
        if (!jsonEquals(this._suggestedGeolocationSubscription, options)) {
            this._suggestedGeolocationSubscription = options;
            this.suggestedGeolocationSubscriptionChangeEvent.raiseEvent(undefined);
        }
    };
    Object.defineProperty(DeviceService.prototype, "suggestedGeolocationSubscription", {
        get: function () {
            return this._suggestedGeolocationSubscription;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "suggestedUserHeight", {
        get: function () {
            return this._parentState && this._parentState.suggestedUserHeight ||
                this.isPresentingHMD ? this.defaultUserHeight : this.defaultUserHeight / 2;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "strict", {
        get: function () {
            return !!(this._parentState && this._parentState.strict) ||
                this.isPresentingHMD && !this._hasPolyfillWebVRDisplay() || false;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "vrDisplay", {
        get: function () {
            return this._vrDisplay;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "screenOrientationDegrees", {
        get: function () {
            return typeof window !== 'undefined' ? (screen['orientation'] && -screen['orientation'].angle) || -window.orientation || 0 : 0;
        },
        enumerable: true,
        configurable: true
    });
    DeviceService.prototype.getScreenOrientationDegrees = function () {
        return this.getScreenOrientationDegrees;
    };
    /**
     * Start emmitting frameState events
     */
    DeviceService.prototype._startUpdates = function () {
        var _this = this;
        if (!this._updatingFrameState)
            this.requestAnimationFrame(this._updateFrameState);
        this._updatingFrameState = true;
        this.sessionService.manager.whenConnected().then(function () {
            if (_this.sessionService.manager.version[0] > 0) {
                _this.sessionService.manager.send('ar.device.startUpdates');
            }
        });
    };
    /**
     * Stop emitting frameState events
     */
    DeviceService.prototype._stopUpdates = function () {
        var _this = this;
        this._updatingFrameState = false;
        this.sessionService.manager.whenConnected().then(function () {
            if (_this.sessionService.manager.version[0] > 0) {
                _this.sessionService.manager.send('ar.device.stopUpdates');
            }
        });
    };
    DeviceService.prototype.onUpdateFrameState = function () {
        this._updateViewport();
        if (this._vrDisplay && this._vrDisplay.isPresenting) {
            this._updateForWebVR();
        }
        else {
            this._updateDefault();
        }
    };
    DeviceService.prototype._updateViewport = function () {
        var parentState = this._parentState;
        var state = this.frameState;
        var viewport = state.viewport;
        if (parentState && parentState.viewport) {
            CanvasViewport.clone(parentState.viewport, viewport);
        }
        else {
            var element = this.viewService.element;
            viewport.x = 0;
            viewport.y = 0;
            viewport.width = element && element.clientWidth || 0;
            viewport.height = element && element.clientHeight || 0;
            var vrDisplay = this._vrDisplay;
            if (vrDisplay && vrDisplay.isPresenting) {
                var leftEye = vrDisplay.getEyeParameters("left");
                var rightEye = vrDisplay.getEyeParameters("right");
                var viewport_1 = state.viewport;
                viewport_1.renderWidthScaleFactor = 2 * Math.max(leftEye.renderWidth, rightEye.renderWidth) / viewport_1.width;
                viewport_1.renderHeightScaleFactor = Math.max(leftEye.renderHeight, rightEye.renderHeight) / viewport_1.height;
            }
            else {
                viewport.renderHeightScaleFactor = 1;
                viewport.renderWidthScaleFactor = 1;
            }
        }
    };
    DeviceService.prototype._updateDefault = function () {
        this._updateDefaultOrigin();
        this._updateDefaultUser();
        var parentState = this._parentState;
        var frameState = this.frameState;
        var viewport = frameState.viewport;
        if (parentState && parentState.viewport) {
            CanvasViewport.clone(parentState.viewport, viewport);
        }
        var subviews = frameState.subviews;
        if (parentState && parentState.subviews) {
            SerializedSubviewList.clone(parentState.subviews, subviews);
        }
        else {
            subviews.length = 1;
            var subview = subviews[0] || {};
            subview.type = SubviewType.SINGULAR;
            subview.viewport.x = 0;
            subview.viewport.y = 0;
            subview.viewport.width = viewport.width;
            subview.viewport.height = viewport.height;
            var aspect = viewport.width / viewport.height;
            var frustum = this._scratchFrustum;
            frustum.near = DEFAULT_NEAR_PLANE;
            frustum.far = DEFAULT_FAR_PLANE;
            frustum.fov = CesiumMath.PI_OVER_THREE;
            frustum.aspectRatio = isFinite(aspect) && aspect !== 0 ? aspect : 1;
            subview.projectionMatrix = Matrix4.clone(frustum.projectionMatrix, subview.projectionMatrix);
            var subviewEntity = this.getSubviewEntity(0);
            subviewEntity.position.setValue(Cartesian3.ZERO, this.user);
            subviewEntity.orientation.setValue(Quaternion.IDENTITY);
        }
    };
    DeviceService.prototype._updateDefaultOrigin = function () {
        var origin = this.origin;
        var stage = this.stage;
        var originPose = this._originPose;
        var time = this.frameState.time;
        originPose.update(time);
        if ((originPose.status & PoseStatus.KNOWN) === 0 ||
            Cartesian3.magnitudeSquared(originPose.position) > 10000) {
            var stageFrame = this._getReachableAncestorReferenceFrames(stage, time, this._scratchArray)[0];
            if (defined(stageFrame)) {
                var stagePositionValue = stage.position.getValueInReferenceFrame(time, stageFrame, this._scratchCartesian);
                var stageOrientationValue = stage.orientation.getValue(time, this._scratchQuaternion);
                if (stagePositionValue && stageOrientationValue) {
                    origin.position.setValue(stagePositionValue, stageFrame);
                    origin.orientation.setValue(stageOrientationValue);
                    console.log('Updated device origin to ' + JSON.stringify(stagePositionValue) + " at " + this._stringIdentifierFromReferenceFrame(stageFrame));
                    return;
                }
            }
        }
        else {
            return;
        }
        origin.position.setValue(Cartesian3.ZERO, stage);
        origin.orientation.setValue(Quaternion.IDENTITY);
    };
    DeviceService.prototype._updateDefaultUser = function () {
        var deviceUser = this.user;
        var deviceStage = this.stage;
        var deviceOrientation = this._deviceOrientation;
        this._tryOrientationUpdates();
        if (!deviceOrientation) {
            deviceUser.position = undefined;
            deviceUser.orientation = undefined;
            return;
        }
        var screenOrientation = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, this.screenOrientationDegrees * CesiumMath.RADIANS_PER_DEGREE, this._scratchQuaternion);
        if (!deviceUser.position)
            deviceUser.position = new ConstantPositionProperty();
        if (!deviceUser.orientation)
            deviceUser.orientation = new ConstantProperty();
        deviceUser.position.setValue(Cartesian3.fromElements(0, 0, this.suggestedUserHeight, this._scratchCartesian), deviceStage);
        deviceUser.orientation.setValue(Quaternion.multiply(deviceOrientation, screenOrientation, this._scratchQuaternion));
        deviceUser['meta'] = deviceUser['meta'] || {};
        deviceUser['meta'].geoHeadingAccuracy = this._deviceOrientationHeadingAccuracy;
    };
    DeviceService.prototype._updateForWebVR = function () {
        var vrDisplay = this._vrDisplay;
        if (!vrDisplay)
            throw new Error('No vr display!');
        var frameState = this.frameState;
        var vrFrameData = this._vrFrameData =
            this._vrFrameData || new VRFrameData();
        if (!vrDisplay['getFrameData'](vrFrameData))
            return this.frameState;
        var layer = vrDisplay.getLayers()[0];
        var leftBounds = layer && layer.leftBounds;
        var rightBounds = layer && layer.rightBounds;
        if (layer) {
            leftBounds = layer.leftBounds && layer.leftBounds.length === 4 ? layer.leftBounds : this._defaultLeftBounds;
            rightBounds = layer.rightBounds && layer.rightBounds.length === 4 ? layer.rightBounds : this._defaultRightBounds;
        }
        else {
            leftBounds = this._defaultLeftBounds;
            rightBounds = this._defaultRightBounds;
        }
        var viewport = frameState.viewport;
        var subviews = frameState.subviews = frameState.subviews || [];
        subviews.length = 2;
        var leftSubview = subviews[0] = subviews[0] || {};
        var rightSubview = subviews[1] = subviews[1] || {};
        leftSubview.type = SubviewType.LEFTEYE;
        rightSubview.type = SubviewType.RIGHTEYE;
        var leftViewport = leftSubview.viewport = leftSubview.viewport || {};
        leftViewport.x = leftBounds[0] * viewport.width;
        leftViewport.y = leftBounds[1] * viewport.height;
        leftViewport.width = leftBounds[2] * viewport.width;
        leftViewport.height = leftBounds[3] * viewport.height;
        var rightViewport = rightSubview.viewport = rightSubview.viewport || {};
        rightViewport.x = rightBounds[0] * viewport.width;
        rightViewport.y = rightBounds[1] * viewport.height;
        rightViewport.width = rightBounds[2] * viewport.width;
        rightViewport.height = rightBounds[3] * viewport.height;
        leftSubview.projectionMatrix = Matrix4.clone(vrFrameData.leftProjectionMatrix, leftSubview.projectionMatrix);
        rightSubview.projectionMatrix = Matrix4.clone(vrFrameData.rightProjectionMatrix, rightSubview.projectionMatrix);
        var sittingToStandingTransform = vrDisplay.stageParameters ?
            vrDisplay.stageParameters.sittingToStandingTransform :
            Matrix4.IDENTITY;
        var sittingToStandingRotation = Matrix4.getRotation(sittingToStandingTransform, this._scratchMatrix3);
        var sittingToStandingQuaternion = Quaternion.fromRotationMatrix(sittingToStandingRotation, this._scratchQuaternion);
        var user = this.user;
        var origin = this.origin;
        var sittingUserPosition = vrFrameData.pose.position ?
            Cartesian3.unpack(vrFrameData.pose.position, 0, this._scratchCartesian) : undefined;
        var standingUserPosition = sittingUserPosition ?
            Matrix4.multiplyByPoint(sittingToStandingTransform, sittingUserPosition, this._scratchCartesian) : undefined;
        var sittingUserOrientation = vrFrameData.pose.orientation ?
            Quaternion.unpack(vrFrameData.pose.orientation, 0, this._scratchQuaternion2) : undefined;
        var standingUserOrientation = sittingUserOrientation ?
            Quaternion.multiply(sittingToStandingQuaternion, sittingUserOrientation, this._scratchQuaternion) : undefined;
        if (!user.position)
            user.position = new ConstantPositionProperty();
        if (!user.orientation)
            user.orientation = new ConstantProperty();
        user.position.setValue(standingUserPosition, origin);
        user.orientation.setValue(standingUserOrientation);
        if (standingUserPosition && standingUserOrientation) {
            var leftEyeSittingSpaceTransform = Matrix4.inverseTransformation(vrFrameData.leftViewMatrix, this._scratchMatrix4);
            var leftEyeStandingSpaceTransform = Matrix4.multiplyTransformation(sittingToStandingTransform, leftEyeSittingSpaceTransform, this._scratchMatrix4);
            var leftEye = this.getSubviewEntity(0);
            var leftEyePosition = Matrix4.getTranslation(leftEyeStandingSpaceTransform, this._scratchCartesian);
            var leftEyeRotation = Matrix4.getRotation(leftEyeStandingSpaceTransform, this._scratchMatrix3);
            var leftEyeOrientation = Quaternion.fromRotationMatrix(leftEyeRotation, this._scratchQuaternion);
            leftEye.position.setValue(leftEyePosition, origin);
            leftEye.orientation.setValue(leftEyeOrientation);
            var rightEyeSittingSpaceTransform = Matrix4.inverseTransformation(vrFrameData.rightViewMatrix, this._scratchMatrix4);
            var rightEyeStandingSpaceTransform = Matrix4.multiplyTransformation(sittingToStandingTransform, rightEyeSittingSpaceTransform, this._scratchMatrix4);
            var rightEye = this.getSubviewEntity(1);
            var rightEyePosition = Matrix4.getTranslation(rightEyeStandingSpaceTransform, this._scratchCartesian);
            var rightEyeRotation = Matrix4.getRotation(rightEyeStandingSpaceTransform, this._scratchMatrix3);
            var rightEyeOrientation = Quaternion.fromRotationMatrix(rightEyeRotation, this._scratchQuaternion);
            rightEye.position.setValue(rightEyePosition, origin);
            rightEye.orientation.setValue(rightEyeOrientation);
        }
        if (vrDisplay.displayName.match(/polyfill/g)) {
            // for the polyfill, the origin is placed using the default strategy of updating
            // only when the stage has moved a large distance
            this._updateDefaultOrigin();
            // the polyfill does not support reporting an absolute orientation (yet), 
            // so fall back to the default orientation calculation
            user.position.setValue(undefined, undefined);
            user.orientation.setValue(undefined);
            this._updateDefaultUser();
        }
        else {
            // for real webvr, the origin is always at the stage
            this.origin.position.setValue(Cartesian3.ZERO, this.stage);
            this.origin.orientation.setValue(Quaternion.IDENTITY);
        }
    };
    DeviceService.prototype._hasPolyfillWebVRDisplay = function () {
        return !!this._vrDisplay && !!this._vrDisplay.displayName.match(/polyfill/g);
    };
    DeviceService.prototype.onRequestPresentHMD = function () {
        if (this._vrDisplay) {
            var element = this.viewService.element;
            var viewLayers = this.viewService.layers;
            var layers = [{
                    source: viewLayers && viewLayers[0] && viewLayers[0].source ||
                        element.querySelector('canvas') ||
                        element.lastElementChild
                }];
            return this._vrDisplay.requestPresent(layers).catch(function (e) {
                throw e;
            });
        }
        throw new Error('No HMD available');
    };
    DeviceService.prototype.onExitPresentHMD = function () {
        if (this._vrDisplay && this._vrDisplay.isPresenting) {
            return this._vrDisplay.exitPresent();
        }
        return Promise.resolve();
    };
    DeviceService.prototype.createContextFrameState = function (time, viewport, subviewList, options) {
        return ArgonSystem.instance.context.createFrameState(time, viewport, subviewList, options);
    };
    DeviceService.prototype.getSubviewEntity = function (index) {
        var subviewEntity = this.entityService.collection.getOrCreateEntity('ar.device.view_' + index);
        if (!subviewEntity.position) {
            subviewEntity.position = new ConstantPositionProperty(Cartesian3.ZERO, this.user);
        }
        if (!subviewEntity.orientation) {
            subviewEntity.orientation = new ConstantProperty(Quaternion.IDENTITY);
        }
        return subviewEntity;
    };
    DeviceService.prototype.subscribeGeolocation = function (options, session) {
        if (session === void 0) { session = this.sessionService.manager; }
        return this.entityService.subscribe(this.stage.id, options, session).then(function () { });
    };
    DeviceService.prototype.unsubscribeGeolocation = function (session) {
        if (session === void 0) { session = this.sessionService.manager; }
        this.entityService.unsubscribe(this.stage.id, session);
    };
    Object.defineProperty(DeviceService.prototype, "isPresentingHMD", {
        /**
         * Is the view presenting to an HMD
         */
        get: function () {
            return this._parentState && this._parentState.isPresentingHMD ||
                this._vrDisplay && this._vrDisplay.isPresenting ||
                false;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DeviceService.prototype, "isPresentingRealityHMD", {
        /**
         * Is the current reality presenting to an HMD
         */
        get: function () {
            return this._parentState && this._parentState.isPresentingRealityHMD ||
                this._vrDisplay && this._vrDisplay.isPresenting && !!this._vrDisplay.displayName.match(/polyfill/g) ||
                false;
        },
        enumerable: true,
        configurable: true
    });
    DeviceService.prototype.requestPresentHMD = function () {
        if (!this.sessionService.manager.isConnected)
            throw new Error('Session must be connected');
        if (this.sessionService.isRealityManager) {
            return this.onRequestPresentHMD();
        }
        return this.sessionService.manager.request('ar.device.requestPresentHMD');
    };
    DeviceService.prototype.exitPresentHMD = function () {
        if (!this.sessionService.manager.isConnected)
            throw new Error('Session must be connected');
        if (this.sessionService.isRealityManager) {
            return this.onExitPresentHMD();
        }
        return this.sessionService.manager.request('ar.device.exitPresentHMD');
    };
    DeviceService.prototype._tryOrientationUpdates = function () {
        var _this = this;
        if (typeof window == 'undefined' || !window.addEventListener)
            return;
        if (defined(this._deviceOrientationListener))
            return;
        var headingDrift = 0;
        var alphaOffset = undefined;
        this._deviceOrientationListener = function (e) {
            var alphaDegrees = e.alpha;
            var webkitCompassHeading = e['webkitCompassHeading'];
            var webkitCompassAccuracy = +e['webkitCompassAccuracy'];
            if (!defined(alphaDegrees)) {
                return;
            }
            if (e.absolute) {
                alphaOffset = 0;
            }
            // when the phone is almost updside down, webkit flips the compass heading 
            // (not documented anywhere, annoyingly)
            // if (e.beta >= 130 || e.beta <= -130) webkitCompassHeading = undefined;
            _this._deviceOrientationHeadingAccuracy = webkitCompassAccuracy > 0 ? webkitCompassAccuracy : undefined;
            if ((!defined(alphaOffset) || Math.abs(headingDrift) > 5) &&
                defined(webkitCompassHeading) &&
                webkitCompassAccuracy >= 0 &&
                webkitCompassAccuracy < 80 &&
                webkitCompassHeading >= 0) {
                if (!defined(alphaOffset)) {
                    alphaOffset = -webkitCompassHeading;
                }
                else {
                    alphaOffset -= headingDrift;
                }
            }
            if (!defined(alphaOffset) ||
                !defined(e.alpha) ||
                !defined(e.beta) ||
                !defined(e.gamma))
                return;
            var alpha = CesiumMath.RADIANS_PER_DEGREE * (e.alpha + alphaOffset || -webkitCompassHeading || 0);
            var beta = CesiumMath.RADIANS_PER_DEGREE * e.beta;
            var gamma = CesiumMath.RADIANS_PER_DEGREE * e.gamma;
            var alphaQuat = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, alpha, _this._scratchQuaternion);
            var betaQuat = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, beta, _this._scratchQuaternion2);
            var alphaBetaQuat = Quaternion.multiply(alphaQuat, betaQuat, _this._scratchQuaternion);
            var gammaQuat = Quaternion.fromAxisAngle(Cartesian3.UNIT_Y, gamma, _this._scratchQuaternion2);
            var alphaBetaGammaQuat = Quaternion.multiply(alphaBetaQuat, gammaQuat, _this._scratchQuaternion);
            // finally, convert from ENU to EUS
            _this._deviceOrientation = Quaternion.multiply(_this._negX90, alphaBetaGammaQuat, _this._deviceOrientation || new Quaternion); // rotate from ENU to EUS
            _this._deviceOrientationHeadingAccuracy = webkitCompassAccuracy;
            // TODO: fix heading drift calculation (heading should match webkitCompassHeading)
            // if (defined(webkitCompassHeading)) {
            //     const q = alphaBetaGammaQuat//utils.getEntityOrientationInReferenceFrame(this.interfaceEntity, JulianDate.now(), this.locationEntity, this._scratchQuaternion1);
            //     var heading = -Math.atan2(2*(q.w*q.z + q.x*q.y), 1 - 2*(q.y*q.y + q.z*q.z));
            //     if (heading < 0) heading += 2*Math.PI;
            //     const {swing,twist} = swingTwistDecomposition(alphaBetaGammaQuat, Cartesian3.UNIT_Z);
            //     const twistAngle = 2 * Math.acos(twist.w);
            //     console.log(twist.w + ' ' + twistAngle * CesiumMath.DEGREES_PER_RADIAN + '\n' + webkitCompassHeading);
            //     // this._headingDrift = webkitCompassHeading - heading * CesiumMath.DEGREES_PER_RADIAN;
            // }
        };
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', this._deviceOrientationListener);
        }
        else if ('ondeviceorientation' in window) {
            window.addEventListener('deviceorientation', this._deviceOrientationListener);
        }
    };
    DeviceService.prototype._setupVRPresentChangeHandler = function () {
        var _this = this;
        if (typeof window !== 'undefined' && window.addEventListener) {
            this.viewService.viewportModeChangeEvent.addEventListener(function (mode) {
                if (mode === 0 /* PAGE */ && _this._vrDisplay && _this._vrDisplay.displayName.match(/polyfill/g))
                    _this.exitPresentHMD();
            });
            var currentCanvas_1;
            var previousPresentationMode_1;
            var handleVRDisplayPresentChange = function (e) {
                var viewService = _this.viewService;
                var display = e.display || e.detail.vrdisplay || e.detail.display;
                if (display) {
                    if (display.isPresenting) {
                        _this._vrDisplay = display;
                        if (display.displayName.match(/polyfill/g)) {
                            currentCanvas_1 = display.getLayers()[0].source;
                            if (currentCanvas_1)
                                currentCanvas_1.classList.add('argon-interactive'); // for now, only use webvr when not in Argon
                            previousPresentationMode_1 = viewService.viewportMode;
                            viewService.desiredViewportMode = 1 /* IMMERSIVE */;
                        }
                    }
                    else {
                        if (currentCanvas_1 && display.displayName.match(/polyfill/g)) {
                            currentCanvas_1.classList.remove('argon-interactive'); // for now, only use webvr when not in Argon
                            currentCanvas_1 = undefined;
                            viewService.desiredViewportMode = previousPresentationMode_1;
                        }
                    }
                }
            };
            window.addEventListener('vrdisplaypresentchange', handleVRDisplayPresentChange);
        }
    };
    return DeviceService;
}());
__decorate([
    deprecated(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], DeviceService.prototype, "geolocationDesired", null);
__decorate([
    deprecated(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], DeviceService.prototype, "geolocationOptions", null);
__decorate([
    deprecated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [JulianDate,
        CanvasViewport,
        SerializedSubviewList, Object]),
    __metadata("design:returntype", Object)
], DeviceService.prototype, "createContextFrameState", null);
DeviceService = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [SessionService,
        EntityService,
        ViewService,
        VisibilityService])
], DeviceService);
export { DeviceService };
/**
 *
 */
var DeviceServiceProvider = (function () {
    function DeviceServiceProvider(sessionService, deviceService, viewService, entityService, entityServiceProvider) {
        var _this = this;
        this.sessionService = sessionService;
        this.deviceService = deviceService;
        this.viewService = viewService;
        this.entityService = entityService;
        this.entityServiceProvider = entityServiceProvider;
        this._subscribers = {};
        this._needsPublish = false;
        this._publishTime = new JulianDate(0, 0);
        this._stableState = new DeviceStableState;
        this._targetGeolocationOptions = {};
        this._sessionGeolocationOptions = new Map();
        this._sctachStageCartesian = new Cartesian3;
        this._scatchStageMatrix4 = new Matrix4;
        this._scatchStageMatrix3 = new Matrix3;
        this._scatchStageQuaternion = new Quaternion;
        this._eastUpSouthToFixedFrame = eastUpSouthToFixedFrame;
        this._scratchCartographic = new Cartographic;
        this.entityServiceProvider.targetReferenceFrameMap.set(deviceService.stage.id, ReferenceFrame.FIXED);
        this.entityServiceProvider.targetReferenceFrameMap.set(deviceService.user.id, deviceService.stage.id);
        this.sessionService.connectEvent.addEventListener(function (session) {
            // backwards compat pre-v1.1.8
            session.on['ar.device.requestFrameState'] = function () {
                _this._subscribers[session.id] = session;
                return new Promise(function (resolve) {
                    var remove = _this.deviceService.frameStateEvent.addEventListener(function (frameState) {
                        resolve(frameState);
                        remove();
                    });
                });
            };
            session.on['ar.device.startUpdates'] = function () {
                _this._subscribers[session.id] = session;
            };
            session.on['ar.device.stopUpdates'] = function () {
                delete _this._subscribers[session.id];
            };
            // to be removed (subscription options are handled by EntityService now)
            session.on['ar.device.setGeolocationOptions'] = function (_a) {
                var options = _a.options;
                _this._sessionGeolocationOptions.set(session, options);
                _this._checkDeviceGeolocationSubscribers();
            };
            session.on['ar.device.requestPresentHMD'] = function () {
                return _this.handleRequestPresentHMD(session);
            };
            session.on['ar.device.exitPresentHMD'] = function () {
                return _this.handleExitPresentHMD(session);
            };
            session.closeEvent.addEventListener(function () {
                if (_this._sessionGeolocationOptions.has(session)) {
                    _this._sessionGeolocationOptions.delete(session);
                    _this._checkDeviceGeolocationSubscribers();
                }
            });
            _this._needsPublish = true;
        });
        this.entityServiceProvider.sessionSubscribedEvent.addEventListener(function (_a) {
            var id = _a.id, options = _a.options, session = _a.session;
            if (_this.deviceService.stage.id === id) {
                _this._sessionGeolocationOptions.set(session, options);
                _this._checkDeviceGeolocationSubscribers();
            }
        });
        this.entityServiceProvider.sessionUnsubscribedEvent.addEventListener(function (_a) {
            var id = _a.id;
            if (_this.deviceService.stage.id === id)
                _this._checkDeviceGeolocationSubscribers();
        });
        this.deviceService.suggestedGeolocationSubscriptionChangeEvent.addEventListener(function () {
            _this._needsPublish = true;
        });
        this.viewService.viewportChangeEvent.addEventListener(function () {
            _this._needsPublish = true;
        });
        this.viewService.viewportModeChangeEvent.addEventListener(function () {
            _this._needsPublish = true;
        });
        this.deviceService.screenOrientationChangeEvent.addEventListener(function () {
            _this._needsPublish = true;
        });
        this.deviceService.frameStateEvent.addEventListener(function (state) {
            if (_this._needsPublish ||
                _this._stableState.isPresentingHMD !== _this.deviceService.isPresentingHMD ||
                _this._stableState.isPresentingRealityHMD !== _this.deviceService.isPresentingRealityHMD ||
                CanvasViewport.equals(_this._stableState.viewport, state.viewport) === false) {
                _this._needsPublish = true;
            }
            else if (_this._stableState.subviews) {
                if (_this._stableState.subviews.length === state.subviews.length) {
                    for (var i = 0; i < state.subviews.length; i++) {
                        if (!SerializedSubview.equals(state.subviews[i], _this._stableState.subviews[i])) {
                            _this._needsPublish = true;
                            break;
                        }
                    }
                }
                else {
                    _this._needsPublish = true;
                }
            }
            if (_this._needsPublish)
                _this.publishStableState();
        });
    }
    DeviceServiceProvider.prototype.handleRequestPresentHMD = function (session) {
        return this.deviceService.requestPresentHMD();
    };
    DeviceServiceProvider.prototype.handleExitPresentHMD = function (session) {
        return this.deviceService.exitPresentHMD();
    };
    DeviceServiceProvider.prototype.publishStableState = function () {
        var stableState = this._stableState;
        stableState.suggestedGeolocationSubscription = this.deviceService.suggestedGeolocationSubscription;
        stableState.suggestedUserHeight = this.deviceService.suggestedUserHeight;
        stableState.strict = this.deviceService.strict;
        stableState.viewport = CanvasViewport.clone(this.deviceService.frameState.viewport, stableState.viewport);
        stableState.subviews = SerializedSubviewList.clone(this.deviceService.frameState.subviews, stableState.subviews);
        this.onUpdateStableState(this._stableState);
        // send stable state to each subscribed session 
        JulianDate.now(this._publishTime);
        for (var id in this._subscribers) {
            var session = this._subscribers[id];
            if (session.version[0] > 0 && session !== this.sessionService.manager) {
                for (var k in stableState.entities) {
                    delete stableState.entities[k];
                }
                ;
                this.entityServiceProvider.fillEntityStateMapForSession(session, this._publishTime, stableState.entities);
                session.send('ar.device.state', stableState);
            }
        }
        this._needsPublish = false;
    };
    DeviceServiceProvider.prototype.onUpdateStableState = function (stableState) {
    };
    DeviceServiceProvider.prototype._checkDeviceGeolocationSubscribers = function () {
        var subscribers = this.entityServiceProvider.subscribersByEntity.get(this.deviceService.stage.id);
        if (subscribers && subscribers.size > 0) {
            var reducedOptions_1 = {};
            this._sessionGeolocationOptions.forEach(function (options, session) {
                reducedOptions_1.enableHighAccuracy =
                    reducedOptions_1.enableHighAccuracy || (options && options.enableHighAccuracy) || false;
            });
            if (this._targetGeolocationOptions.enableHighAccuracy !== reducedOptions_1.enableHighAccuracy) {
                this._targetGeolocationOptions = reducedOptions_1;
            }
            if (JSON.stringify(this._targetGeolocationOptions) !== JSON.stringify(this._currentGeolocationOptions)) {
                this._currentGeolocationOptions = this._targetGeolocationOptions;
                this.onStopGeolocationUpdates();
                this.onStartGeolocationUpdates(this._targetGeolocationOptions);
            }
        }
        else {
            this.onStopGeolocationUpdates();
            this._currentGeolocationOptions = undefined;
        }
        this._needsPublish = true;
    };
    DeviceServiceProvider.prototype.configureStage = function (cartographic, geoHorizontalAccuracy, geoVerticalAccuracy) {
        var _this = this;
        if (!defined(geoVerticalAccuracy) && cartographic.height === 0) {
            updateHeightFromTerrain(cartographic).then(function () { return _this.configureStage(cartographic, geoHorizontalAccuracy, 0); });
            return;
        }
        var stage = this.deviceService.stage;
        var fixedPosition = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height, undefined, this._sctachStageCartesian);
        var eusTransform = this._eastUpSouthToFixedFrame(fixedPosition, undefined, this._scatchStageMatrix4);
        var eusRotation = Matrix4.getRotation(eusTransform, this._scatchStageMatrix3);
        var eusOrientation = Quaternion.fromRotationMatrix(eusRotation, this._scatchStageQuaternion);
        stage.position = stage.position || new ConstantPositionProperty();
        stage.orientation = stage.orientation || new ConstantProperty();
        stage.position.setValue(fixedPosition, ReferenceFrame.FIXED);
        stage.orientation.setValue(eusOrientation);
        stage['meta'] = {
            geoHorizontalAccuracy: geoHorizontalAccuracy,
            geoVerticalAccuracy: geoVerticalAccuracy
        };
    };
    /**
     * Overridable. Should call configureStage when new geolocation is available
     */
    DeviceServiceProvider.prototype.onStartGeolocationUpdates = function (options) {
        var _this = this;
        if (typeof navigator == 'undefined' || !navigator.geolocation)
            throw new Error('Unable to start geolocation updates');
        if (!defined(this._geolocationWatchId)) {
            this._geolocationWatchId = navigator.geolocation.watchPosition(function (pos) {
                var longDegrees = pos.coords.longitude;
                var latDegrees = pos.coords.latitude;
                var altitude = pos.coords.altitude;
                var cartographic = Cartographic.fromDegrees(longDegrees, latDegrees, altitude || 0, _this._scratchCartographic);
                _this.configureStage(cartographic, (pos.coords.accuracy > 0) ? pos.coords.accuracy : undefined, pos.coords.altitudeAccuracy || undefined);
            }, function (e) {
                console.warn('Unable to start geolocation updates: ' + e.message);
            }, options);
        }
    };
    /**
     * Overridable.
     */
    DeviceServiceProvider.prototype.onStopGeolocationUpdates = function () {
        if (typeof navigator !== 'undefined' && defined(this._geolocationWatchId)) {
            navigator.geolocation.clearWatch(this._geolocationWatchId);
            this._geolocationWatchId = undefined;
        }
    };
    return DeviceServiceProvider;
}());
DeviceServiceProvider = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [SessionService,
        DeviceService,
        ViewService,
        EntityService,
        EntityServiceProvider])
], DeviceServiceProvider);
export { DeviceServiceProvider };
