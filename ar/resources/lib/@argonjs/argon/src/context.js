var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { autoinject } from 'aurelia-dependency-injection';
import { Entity, Cartographic, ConstantPositionProperty, ConstantProperty, Cartesian3, Quaternion, Matrix3, Matrix4, CesiumMath, JulianDate, ReferenceFrame, PerspectiveFrustum } from './cesium/cesium-imports';
import { DEFAULT_NEAR_PLANE, DEFAULT_FAR_PLANE, SerializedSubviewList, SubviewType, Role, CanvasViewport, Viewport } from './common';
import { SessionService } from './session';
import { Event, stringIdentifierFromReferenceFrame, 
// getReachableAncestorReferenceFrames,
getSerializedEntityState, getEntityPositionInReferenceFrame, getEntityOrientationInReferenceFrame, deprecated, decomposePerspectiveProjectionMatrix } from './utils';
import { EntityService, EntityServiceProvider } from './entity';
import { DeviceService } from './device';
import { eastUpSouthToFixedFrame } from './utils';
import { ViewService } from './view';
import { PermissionState, PermissionServiceProvider } from './permission';
/**
 * Provides a means of querying the current state of reality.
 */
var ContextService = (function () {
    function ContextService(entityService, sessionService, deviceService, viewService) {
        var _this = this;
        this.entityService = entityService;
        this.sessionService = sessionService;
        this.deviceService = deviceService;
        this.viewService = viewService;
        /**
         * An event that is raised after managed entities have been updated for
         * the current frame.
         */
        this.updateEvent = new Event();
        /**
         * An event that is raised when it is an approriate time to render graphics.
         * This event fires after the update event.
         */
        this.renderEvent = new Event();
        /**
         * An event that is raised after the render event
         */
        this.postRenderEvent = new Event();
        /**
         * An event that fires when the origin changes.
         */
        this.originChangeEvent = new Event();
        this._originChanged = false;
        /**
         * A monotonically increasing value (in milliseconds) for the current frame state.
         * This value is useful only for doing accurate *timing*, not for determining
         * the absolute time. Use [[ContextService.time]] for absolute time.
         * This value is -1 until the first [[ContextService.updateEvent]].
         */
        this.timestamp = -1;
        /**
         * The time in milliseconds since the previous timestamp,
         * capped to [[ContextService.maxDeltaTime]]
         */
        this.deltaTime = 0;
        /**
         * This value caps the deltaTime for each frame. By default,
         * the value is 1/3s (333.3ms)
         */
        this.maxDeltaTime = 1 / 3 * 1000;
        /**
         * The current (absolute) time according to the current reality.
         * This value is arbitrary until the first [[ContextService.updateEvent]].
         */
        this.time = new JulianDate(0, 0);
        /**
        * An entity representing the local origin, which is oriented
        * with +Y up. The local origin changes infrequently, is platform dependent,
        * and is the suggested origin for a rendering scenegraph.
        *
        * Any time the local origin changes, the localOriginChange event is raised.
        */
        this.origin = this.entities.add(new Entity({
            id: 'ar.origin',
            name: 'Origin',
            position: new ConstantPositionProperty(undefined, ReferenceFrame.FIXED),
            orientation: new ConstantProperty(undefined)
        }));
        this._localOrigin = this.entities.add(new Entity({
            id: 'ar.localOrigin',
            name: 'Local Origin',
            position: new ConstantPositionProperty(Cartesian3.ZERO, this.origin),
            orientation: new ConstantProperty(Quaternion.IDENTITY)
        }));
        this._localOriginEastNorthUp = this.entities.add(new Entity({
            id: 'ar.localOriginENU',
            name: 'Local Origin (ENU)',
            position: new ConstantPositionProperty(Cartesian3.ZERO, this.localOriginEastNorthUp),
            orientation: new ConstantProperty(Quaternion.fromAxisAngle(Cartesian3.UNIT_X, -Math.PI / 2))
        }));
        /**
         * A coordinate system representing the physical space in which the user is free to
         * move around, positioned on the surface the user is standing on,
         * where +X is east, +Y is up, and +Z is south (East-Up-South), if geolocation is known.
         * If the stage is not geolocated, then the +X and +Z directions are arbitrary.
         */
        this.stage = this.entities.add(new Entity({
            id: 'ar.stage',
            name: 'Stage',
            position: new ConstantPositionProperty(undefined, ReferenceFrame.FIXED),
            orientation: new ConstantProperty(undefined)
        }));
        /**
         * A coordinate system representing the floor.
         * While the `stage` always represents a physical surface,
         * the `floor` entity may represent a virtual floor.
         */
        this.floor = this.entities.add(new Entity({
            id: 'ar.floor',
            name: 'Floor',
            position: new ConstantPositionProperty(Cartesian3.ZERO, this.stage),
            orientation: new ConstantProperty(Quaternion.IDENTITY)
        }));
        /**
         * An coordinate system representing the user,
         * where +X is right, +Y is up, and -Z is the direction the user is facing
         */
        this.user = this.entities.add(new Entity({
            id: 'ar.user',
            name: 'User',
            position: new ConstantPositionProperty(undefined, this.stage),
            orientation: new ConstantProperty(undefined)
        }));
        /**
         * An coordinate system representing the rendering view,
         * where +X is right, +Y is up, and -Z is the direction of the view.
         */
        this.view = this.entities.add(new Entity({
            id: 'ar.view',
            name: 'View',
            position: new ConstantPositionProperty(Cartesian3.ZERO, this.user),
            orientation: new ConstantProperty(Quaternion.IDENTITY)
        }));
        /**
         * The default reference frame to use when calling `getEntityPose`.
         * By default, this is the `origin` reference frame.
         */
        this.defaultReferenceFrame = this.origin;
        this._entityPoseMap = new Map();
        this._updatingEntities = new Set();
        this._knownEntities = new Set();
        this._scratchCartesian = new Cartesian3;
        this._scratchQuaternion = new Quaternion;
        this._scratchFrustum = new PerspectiveFrustum();
        /**
         * Subscribe to pose updates for the given entity id
         *
         * @returns A Promise that resolves to a new or existing entity
         * instance matching the given id, if the subscription is successful
         */
        this.subscribe = this.entityService.subscribe.bind(this.entityService);
        /**
         * Unsubscribe to pose updates for the given entity id
         */
        this.unsubscribe = this.entityService.unsubscribe.bind(this.entityService);
        this._stringIdentifierFromReferenceFrame = stringIdentifierFromReferenceFrame;
        this._frameIndex = -1;
        this._scratchFrameState = {
            time: {},
            entities: {},
            viewport: {},
            subviews: []
        };
        this._getSerializedEntityState = getSerializedEntityState;
        this._getEntityPositionInReferenceFrame = getEntityPositionInReferenceFrame;
        this._getEntityOrientationInReferenceFrame = getEntityOrientationInReferenceFrame;
        this._scratchMatrix3 = new Matrix3;
        this._scratchMatrix4 = new Matrix4;
        this.sessionService.manager.on['ar.context.update'] = function (state) {
            var scratchFrustum = _this._scratchFrustum;
            // backwards-compat
            if (typeof state.reality !== 'string') {
                state.reality = state.reality && state.reality['uri'];
            }
            if (!state.viewport && state['view'] && state['view'].viewport) {
                state.viewport = state['view'].viewport;
            }
            if (!state.subviews && state['view'] && state['view'].subviews) {
                state.subviews = state['view'].subviews;
                scratchFrustum.near = DEFAULT_NEAR_PLANE;
                scratchFrustum.far = DEFAULT_FAR_PLANE;
                for (var _i = 0, _a = state.subviews; _i < _a.length; _i++) {
                    var s = _a[_i];
                    var frustum = s['frustum'];
                    scratchFrustum.xOffset = frustum.xOffset || 0;
                    scratchFrustum.yOffset = frustum.yOffset || 0;
                    scratchFrustum.fov = frustum.fov || CesiumMath.PI_OVER_THREE;
                    scratchFrustum.aspectRatio = frustum.aspectRatio || 1;
                    s.projectionMatrix = Matrix4.clone(scratchFrustum.projectionMatrix, s.projectionMatrix);
                }
            }
            if (!state.entities[_this.user.id] && state['view'] && state['view'].pose) {
                state.entities[_this.user.id] = state['view'].pose;
            }
            // end backwards-compat
            _this._update(state);
        };
        this.origin.definitionChanged.addEventListener(function (origin, property) {
            if (property === 'position' || property === 'orientation') {
                if (origin.position) {
                    origin.position.definitionChanged.addEventListener(function () {
                        _this._originChanged = true;
                    });
                }
                if (origin.orientation) {
                    origin.orientation.definitionChanged.addEventListener(function () {
                        _this._originChanged = true;
                    });
                }
                _this._originChanged = true;
            }
        });
        this._scratchFrustum.near = DEFAULT_NEAR_PLANE;
        this._scratchFrustum.far = DEFAULT_FAR_PLANE;
        this._scratchFrustum.fov = CesiumMath.PI_OVER_THREE;
        this._scratchFrustum.aspectRatio = 1;
        this._serializedFrameState = {
            reality: undefined,
            time: JulianDate.now(),
            entities: {},
            viewport: new CanvasViewport,
            subviews: [{
                    type: SubviewType.SINGULAR,
                    viewport: new Viewport,
                    projectionMatrix: this._scratchFrustum.projectionMatrix
                }],
        };
    }
    Object.defineProperty(ContextService.prototype, "entities", {
        get: function () { return this.entityService.collection; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "localOriginChangeEvent", {
        /**
         * An event that fires when the local origin changes.
         */
        get: function () { return this.originChangeEvent; },
        enumerable: true,
        configurable: true
    });
    ;
    Object.defineProperty(ContextService.prototype, "localOrigin", {
        /** alias for origin */
        get: function () { return this._localOrigin; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "localOriginEastUpSouth", {
        // To be removed. This is no longer useful.
        get: function () { return this._localOrigin; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "localOriginEastNorthUp", {
        // To be removed. This is no longer useful.
        get: function () { return this._localOriginEastNorthUp; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "geoposeHeadingAccuracy", {
        /**
         * If geopose is available, this is the accuracy of the user's heading
         */
        get: function () {
            return this.stage['meta'].geoposeHeadingAccuracy;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "geoposeHorizontalAccuracy", {
        /**
         * If geopose is available, this is the accuracy of the user's cartographic location
         */
        get: function () {
            return this.stage['meta'].geoposeHorizontalAccuracy;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "geoposeVerticalAccuracy", {
        /**
         * If geopose is available, this is the accuracy of the user's elevation
         */
        get: function () {
            return this.stage['meta'].geoposeVerticalAccuracy;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "serializedFrameState", {
        /**
         * The serialized frame state for this frame
         */
        get: function () {
            return this._serializedFrameState;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "systemTime", {
        /**
         * Deprecated. Use timestamp property.
         * @private
         */
        get: function () {
            return this.timestamp;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Deprecated. To be removed.
     * @private
     */
    ContextService.prototype.getTime = function () {
        return this.time;
    };
    /**
     * Deprecated. To be removed. Use the defaultReferenceFrame property if necessary.
     * @private
     */
    ContextService.prototype.setDefaultReferenceFrame = function (origin) {
        this.defaultReferenceFrame = origin;
    };
    /**
     * Deprecated. To be removed.  Use the defaultReferenceFrame property.
     * @private
     */
    ContextService.prototype.getDefaultReferenceFrame = function () {
        return this.defaultReferenceFrame;
    };
    /**
     * Subscribe to pose updates for an entity specified by the given id
     *
     * @deprecated Use [[ContextService#subscribe]]
     * @param id - the id of the desired entity
     * @returns A new or existing entity instance matching the given id
     */
    ContextService.prototype.subscribeToEntityById = function (id) {
        this.subscribe(id);
        return this.entities.getOrCreateEntity(id);
    };
    /**
     * Get the cartographic position of an Entity for the current context time
     */
    ContextService.prototype.getEntityCartographic = function (entity, result) {
        return this.entityService.getCartographic(entity, this.time, result);
    };
    /**
     * Deprecated. Use `EntityService.createFixed` (`app.entity.createFixed`);
     */
    ContextService.prototype.createGeoEntity = function (cartographic, localToFixed) {
        return this.entityService.createFixed(cartographic, localToFixed);
    };
    /**
     * Create a new EntityPose instance to represent the pose of an entity
     * relative to a given reference frame. If no reference frame is specified,
     * then the pose is based on the context's defaultReferenceFrame.
     *
     * @param entityOrId - the entity to track
     * @param referenceFrameOrId - The intended reference frame. Defaults to `this.defaultReferenceFrame`.
     */
    ContextService.prototype.createEntityPose = function (entityOrId, referenceFrameOrId) {
        if (referenceFrameOrId === void 0) { referenceFrameOrId = this.defaultReferenceFrame; }
        return this.entityService.createEntityPose(entityOrId, referenceFrameOrId);
    };
    /**
     * Gets the current pose of an entity, relative to a given reference frame.
     *
     * @deprecated
     * @param entityOrId - The entity whose state is to be queried.
     * @param referenceFrameOrId - The intended reference frame. Defaults to `this.defaultReferenceFrame`.
     */
    ContextService.prototype.getEntityPose = function (entityOrId, referenceFrameOrId) {
        if (referenceFrameOrId === void 0) { referenceFrameOrId = this.defaultReferenceFrame; }
        var key = this._stringIdentifierFromReferenceFrame(entityOrId) + '@' + this._stringIdentifierFromReferenceFrame(referenceFrameOrId);
        var entityPose = this._entityPoseMap.get(key);
        if (!entityPose) {
            entityPose = this.entityService.createEntityPose(entityOrId, referenceFrameOrId);
            this._entityPoseMap.set(key, entityPose);
        }
        entityPose.update(this.time);
        return entityPose;
    };
    /**
     * Process the next frame state (which should come from the current reality viewer)
     */
    ContextService.prototype.submitFrameState = function (frameState) {
        frameState.index = ++this._frameIndex;
        this._update(frameState);
    };
    /**
     * Create a frame state.
     *
     * @param time
     * @param viewport
     * @param subviewList
     * @param user
     * @param entityOptions
     */
    ContextService.prototype.createFrameState = function (time, viewport, subviewList, options) {
        var overrideUser = options && options.overrideUser;
        if (this.deviceService.strict) {
            if (overrideUser) {
                console.warn('The `overrideUser` flag is set, but the device is in strict mode');
                overrideUser = false;
            }
        }
        var frameState = this._scratchFrameState;
        frameState.time = JulianDate.clone(time, frameState.time);
        frameState.viewport = CanvasViewport.clone(viewport, frameState.viewport);
        frameState.subviews = SerializedSubviewList.clone(subviewList, frameState.subviews);
        var entities = frameState.entities = {};
        var getSerializedEntityState = this._getSerializedEntityState;
        // stage
        var stage = this.stage;
        if (options && options.overrideStage) {
            entities[stage.id] = getSerializedEntityState(stage, time, undefined);
        }
        // user
        var user = this.user;
        if (overrideUser) {
            entities[user.id] = getSerializedEntityState(user, time, stage);
        }
        // view
        var view = this.view;
        if (options && options.overrideView) {
            entities[view.id] = getSerializedEntityState(view, time, user);
        }
        // subviews
        for (var index = 0; index < subviewList.length; index++) {
            // check for valid projection matrices
            var subview = subviewList[index];
            if (!isFinite(subview.projectionMatrix[0]))
                throw new Error('Invalid projection matrix (contains non-finite values)');
            if (options && options.overrideSubviews) {
                var subviewEntity = this.getSubviewEntity(index);
                entities[subviewEntity.id] = getSerializedEntityState(subviewEntity, time, view);
            }
        }
        // floor
        var floorOffset = options && options.floorOffset || 0;
        var floor = this.floor;
        floor.position.setValue(Cartesian3.fromElements(0, floorOffset, 0, this._scratchCartesian), stage);
        if (floorOffset !== 0) {
            frameState.entities[this.floor.id] = getSerializedEntityState(floor, time, stage);
        }
        return frameState;
    };
    // All of the following work is only necessary when running in an old manager (version === 0)
    ContextService.prototype._updateBackwardsCompatability = function (frameState) {
        this._knownEntities.clear();
        // update the entities the manager knows about
        var entityService = this.entityService;
        for (var id in frameState.entities) {
            entityService.updateEntityFromSerializedState(id, frameState.entities[id]);
            this._updatingEntities.add(id);
            this._knownEntities.add(id);
        }
        // if the mangager didn't send us an update for a particular entity,
        // assume the manager no longer knows about it
        for (var _i = 0, _a = this._updatingEntities; _i < _a.length; _i++) {
            var id = _a[_i];
            if (!this._knownEntities.has(id)) {
                var entity = this.entities.getById(id);
                if (entity) {
                    if (entity.position)
                        entity.position.setValue(undefined);
                    if (entity.orientation)
                        entity.orientation.setValue(undefined);
                }
                this._updatingEntities.delete(id);
            }
        }
        // If running within an older manager, we have to set the stage based on the user pose. 
        var userPositionFixed = this._getEntityPositionInReferenceFrame(this.user, frameState.time, ReferenceFrame.FIXED, this._scratchCartesian);
        if (userPositionFixed) {
            var eusToFixedFrameTransform = eastUpSouthToFixedFrame(userPositionFixed, undefined, this._scratchMatrix4);
            var eusRotationMatrix = Matrix4.getRotation(eusToFixedFrameTransform, this._scratchMatrix3);
            var eusOrientation = Quaternion.fromRotationMatrix(eusRotationMatrix);
            this.stage.position.setValue(userPositionFixed, ReferenceFrame.FIXED);
            this.stage.orientation.setValue(eusOrientation);
        }
        else {
            this.stage.position.setValue(Cartesian3.fromElements(0, -this.deviceService.suggestedUserHeight, 0, this._scratchCartesian), this.user.position.referenceFrame);
            this.stage.orientation.setValue(Quaternion.IDENTITY);
        }
        frameState.entities[this.stage.id] = true; // assume overriden for _update
    };
    // TODO: This function is called a lot. Potential for optimization. 
    ContextService.prototype._update = function (frameState) {
        this._serializedFrameState = frameState;
        var time = frameState.time;
        var entities = frameState.entities;
        // update our time values
        var timestamp = performance.now();
        this.deltaTime = Math.min(timestamp - this.timestamp, this.maxDeltaTime);
        this.timestamp = timestamp;
        JulianDate.clone(frameState.time, this.time);
        // update provided entities
        if (this.sessionService.manager.isConnected && this.sessionService.manager.version[0] === 0) {
            this._updateBackwardsCompatability(frameState);
        }
        else {
            var entityService = this.entityService;
            for (var id in entities) {
                entityService.updateEntityFromSerializedState(id, entities[id]);
            }
        }
        // update stage entity
        var deviceStage = this.deviceService.stage;
        var contextStage = this.stage;
        if (entities[contextStage.id] === undefined) {
            var contextStagePosition = contextStage.position;
            var contextStageOrientation = contextStage.orientation;
            contextStagePosition.setValue(Cartesian3.ZERO, deviceStage);
            contextStageOrientation.setValue(Quaternion.IDENTITY);
        }
        // update user entity
        var deviceUser = this.deviceService.user;
        var contextUser = this.user;
        if (entities[contextUser.id] === undefined) {
            var userPositionValue = this._getEntityPositionInReferenceFrame(deviceUser, time, deviceStage, this._scratchCartesian);
            var userOrientationValue = this._getEntityOrientationInReferenceFrame(deviceUser, time, deviceStage, this._scratchQuaternion);
            var contextUserPosition = contextUser.position;
            var contextUserOrientation = contextUser.orientation;
            contextUserPosition.setValue(userPositionValue, contextStage);
            contextUserOrientation.setValue(userOrientationValue);
        }
        // update view entity
        var contextView = this.view;
        if (entities[contextView.id] === undefined) {
            var contextViewPosition = contextView.position;
            var contextViewOrientation = contextView.orientation;
            contextViewPosition.setValue(Cartesian3.ZERO, contextUser);
            contextViewOrientation.setValue(Quaternion.IDENTITY);
        }
        // update subview entities
        for (var i = 0; i < frameState.subviews.length; i++) {
            if (entities['ar.view_' + i] === undefined) {
                var deviceSubview = this.deviceService.getSubviewEntity(i);
                var contextSubview = this.getSubviewEntity(i);
                var subviewPositionValue = this._getEntityPositionInReferenceFrame(deviceSubview, time, deviceUser, this._scratchCartesian);
                var subviewOrientationValue = this._getEntityOrientationInReferenceFrame(deviceSubview, time, deviceUser, this._scratchQuaternion);
                var contextSubviewPosition = contextSubview.position;
                var contextSubviewOrientation = contextSubview.orientation;
                contextSubviewPosition.setValue(subviewPositionValue, contextView);
                contextSubviewOrientation.setValue(subviewOrientationValue);
            }
        }
        // update floor entity
        if (entities[this.floor.id] === undefined) {
            var floorPosition = this.floor.position;
            floorPosition.setValue(Cartesian3.ZERO, contextStage);
        }
        // update origin entity
        if (entities[this.origin.id] === undefined) {
            var deviceOrigin = this.deviceService.origin;
            var contextOrigin = this.origin;
            var deviceOriginPositionValue = this._getEntityPositionInReferenceFrame(deviceOrigin, time, deviceStage, this._scratchCartesian);
            var deviceOriginOrientationValue = this._getEntityOrientationInReferenceFrame(deviceOrigin, time, deviceStage, this._scratchQuaternion);
            var contextOriginPosition = contextOrigin.position;
            var contextOriginOrientation = contextOrigin.orientation;
            contextOriginPosition.setValue(deviceOriginPositionValue, contextStage);
            contextOriginOrientation.setValue(deviceOriginOrientationValue);
        }
        // update view
        this.viewService._processContextFrameState(frameState, this);
        // TODO: realityService._processContextFrameState(frameState); 
        // raise events for the user to update and render the scene
        if (this._originChanged) {
            this._originChanged = false;
            var originPosition = this.origin.position;
            console.log('Updated context origin to ' + JSON.stringify(originPosition['_value']) + " at " + this._stringIdentifierFromReferenceFrame(originPosition.referenceFrame));
            this.originChangeEvent.raiseEvent(undefined);
        }
        this.updateEvent.raiseEvent(this);
        this.renderEvent.raiseEvent(this);
        this.postRenderEvent.raiseEvent(this);
        // submit frame if necessary
        var vrDisplay = this.deviceService.vrDisplay;
        if (this.deviceService.autoSubmitFrame && vrDisplay && vrDisplay.isPresenting) {
            vrDisplay.submitFrame();
        }
    };
    ContextService.prototype.getSubviewEntity = function (index) {
        var subviewEntity = this.entityService.collection.getOrCreateEntity('ar.view_' + index);
        if (!subviewEntity.position) {
            subviewEntity.position = new ConstantPositionProperty(Cartesian3.ZERO, this.user);
        }
        if (!subviewEntity.orientation) {
            subviewEntity.orientation = new ConstantProperty(Quaternion.IDENTITY);
        }
        return subviewEntity;
    };
    ContextService.prototype.subscribeGeolocation = function (options) {
        return this.entityService.subscribe(this.stage.id, options).then(function () { });
    };
    ContextService.prototype.unsubscribeGeolocation = function () {
        this.entityService.unsubscribe(this.stage.id);
    };
    Object.defineProperty(ContextService.prototype, "geoHeadingAccuracy", {
        get: function () {
            return this.user['meta'] && this.user['meta'].geoHeadingAccuracy;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "geoHorizontalAccuracy", {
        get: function () {
            return this.user['meta'] && this.user['meta'].geoHorizontalAccuracy ||
                this.stage['meta'] && this.stage['meta'].geoHorizontalAccuracy;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ContextService.prototype, "geoVerticalAccuracy", {
        get: function () {
            return this.user['meta'] && this.user['meta'].geoVerticalAccuracy ||
                this.stage['meta'] && this.stage['meta'].geoVerticalAccuracy;
        },
        enumerable: true,
        configurable: true
    });
    return ContextService;
}());
__decorate([
    deprecated('originChangeEvent'),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], ContextService.prototype, "localOriginChangeEvent", null);
__decorate([
    deprecated('origin'),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], ContextService.prototype, "localOrigin", null);
__decorate([
    deprecated(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], ContextService.prototype, "localOriginEastUpSouth", null);
__decorate([
    deprecated(),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], ContextService.prototype, "localOriginEastNorthUp", null);
__decorate([
    deprecated('timestamp'),
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], ContextService.prototype, "systemTime", null);
__decorate([
    deprecated('time'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", JulianDate)
], ContextService.prototype, "getTime", null);
__decorate([
    deprecated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Entity]),
    __metadata("design:returntype", void 0)
], ContextService.prototype, "setDefaultReferenceFrame", null);
__decorate([
    deprecated('defaultReferenceFrame'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Entity)
], ContextService.prototype, "getDefaultReferenceFrame", null);
__decorate([
    deprecated('subscribe'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Entity)
], ContextService.prototype, "subscribeToEntityById", null);
__decorate([
    deprecated('EntityService.createFixed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Cartographic, Object]),
    __metadata("design:returntype", void 0)
], ContextService.prototype, "createGeoEntity", null);
ContextService = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [EntityService,
        SessionService,
        DeviceService,
        ViewService])
], ContextService);
export { ContextService };
var ContextServiceProvider = (function () {
    function ContextServiceProvider(sessionService, contextService, entityServiceProvider, permissionServiceProvider) {
        var _this = this;
        this.sessionService = sessionService;
        this.contextService = contextService;
        this.entityServiceProvider = entityServiceProvider;
        this.permissionServiceProvider = permissionServiceProvider;
        this._cacheTime = new JulianDate(0, 0);
        this._sessionEntities = {};
        this._temp = {};
        this.desiredGeolocationOptions = {};
        this.sessionGeolocationOptions = new Map();
        this.entityServiceProvider.targetReferenceFrameMap.set(this.contextService.stage.id, ReferenceFrame.FIXED);
        // subscribe to context geolocation if any child sessions have subscribed
        this.entityServiceProvider.sessionSubscribedEvent.addEventListener(function (evt) {
            if (evt.id === _this.contextService.stage.id && evt.session !== _this.sessionService.manager) {
                _this._setGeolocationOptions(evt.session, evt.options);
                _this.contextService.subscribeGeolocation(_this.desiredGeolocationOptions);
            }
        });
        // unsubscribe from context geolocation if all child sessions are unsubscribed
        this.entityServiceProvider.sessionUnsubscribedEvent.addEventListener(function () {
            var subscribers = _this.entityServiceProvider.subscribersByEntity.get(_this.contextService.stage.id);
            if (subscribers && subscribers.size === 1 && subscribers.has(_this.sessionService.manager)) {
                _this.contextService.unsubscribeGeolocation();
            }
        });
        // publish updates to child sessions
        this.contextService.updateEvent.addEventListener(function () {
            _this._publishUpdates();
        });
    }
    ContextServiceProvider.prototype._publishUpdates = function () {
        var state = this.contextService.serializedFrameState;
        this._cacheTime = JulianDate.clone(state.time, this._cacheTime);
        for (var _i = 0, _a = this.sessionService.managedSessions; _i < _a.length; _i++) {
            var session = _a[_i];
            if (Role.isRealityAugmenter(session.info.role))
                this._sendUpdateForSession(state, session);
        }
    };
    ContextServiceProvider.prototype._sendUpdateForSession = function (state, session) {
        var sessionEntities = this._sessionEntities;
        var entityServiceProvider = this.entityServiceProvider;
        // clear session entities
        for (var id in sessionEntities) {
            delete sessionEntities[id];
        }
        // reference all entities from the primary frame state
        if (state.entities) {
            for (var id in state.entities) {
                sessionEntities[id] = state.entities[id];
            }
        }
        // always send the origin state
        sessionEntities[this.contextService.origin.id] = entityServiceProvider.getCachedSerializedEntityState(this.contextService.origin, state.time);
        // get subscribed entities for the session
        var subscriptions = entityServiceProvider.subscriptionsBySubscriber.get(session);
        // exclude the stage state unless it is explicitly subscribed 
        var contextService = this.contextService;
        var contextStageId = contextService.stage.id;
        if (!subscriptions[contextStageId])
            delete sessionEntities[contextStageId];
        // add the entity states for all subscribed entities
        var iter = subscriptions.keys();
        var item;
        while (item = iter.next(), !item.done) {
            var id_1 = item.value;
            var entity = contextService.entities.getById(id_1);
            sessionEntities[id_1] = entityServiceProvider.getCachedSerializedEntityState(entity, state.time);
        }
        // remove stage updates if geolocation permission is not granted
        if (this.permissionServiceProvider.getPermissionState(session, 'geolocation') != PermissionState.GRANTED)
            delete sessionEntities[contextStageId];
        // recycle the frame state object, but with the session entities
        var parentEntities = state.entities;
        state.entities = sessionEntities;
        state.time = state.time;
        state.sendTime = JulianDate.now(state.sendTime);
        if (session.version[0] === 0) {
            for (var _i = 0, _a = state.subviews; _i < _a.length; _i++) {
                var s = _a[_i];
                s['frustum'] = s['frustum'] || decomposePerspectiveProjectionMatrix(s.projectionMatrix, {});
            }
            var view = this._temp;
            view.viewport = state.viewport;
            view.subviews = state.subviews;
            view.pose = state.entities['ar.user'];
            delete state.subviews;
            delete state.viewport;
            delete state.entities['ar.user'];
            state['view'] = view;
            session.send('ar.context.update', state);
            delete state['view'];
            state.viewport = view.viewport;
            state.subviews = view.subviews;
        }
        else if (session.version[0] === 1 && session.version[1] === 1 && state.entities['ar.user']) {
            state.entities['ar.user'].r = 'ar.stageEUS';
            session.send('ar.context.update', state);
            state.entities['ar.user'].r = 'ar.stage';
        }
        else {
            session.send('ar.context.update', state);
        }
        // restore the parent entities
        state.entities = parentEntities;
    };
    ContextServiceProvider.prototype._setGeolocationOptions = function (session, options) {
        var _this = this;
        this.sessionGeolocationOptions.set(session, options);
        session.closeEvent.addEventListener(function () {
            _this.sessionGeolocationOptions.delete(session);
            _this._updateDesiredGeolocationOptions();
        });
        this._updateDesiredGeolocationOptions();
    };
    ContextServiceProvider.prototype._updateDesiredGeolocationOptions = function () {
        var reducedOptions = {};
        this.sessionGeolocationOptions.forEach(function (options, session) {
            reducedOptions.enableHighAccuracy =
                reducedOptions.enableHighAccuracy || (options && options.enableHighAccuracy) || false;
        });
        if (this.desiredGeolocationOptions.enableHighAccuracy !== reducedOptions.enableHighAccuracy) {
            this.desiredGeolocationOptions = reducedOptions;
        }
    };
    return ContextServiceProvider;
}());
ContextServiceProvider = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [SessionService,
        ContextService,
        EntityServiceProvider,
        PermissionServiceProvider])
], ContextServiceProvider);
export { ContextServiceProvider };
