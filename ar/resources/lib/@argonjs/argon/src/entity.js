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
import { SessionService } from './session';
import { Event, getEntityPositionInReferenceFrame, getEntityOrientationInReferenceFrame, getSerializedEntityState, jsonEquals } from './utils';
import { PermissionServiceProvider } from './permission';
import { defined, Cartesian3, Cartographic, Entity, EntityCollection, ConstantPositionProperty, ConstantProperty, JulianDate, Matrix3, Matrix4, ReferenceFrame, ReferenceEntity, Quaternion } from './cesium/cesium-imports';
/**
 * Represents the pose of an entity relative to a particular reference frame.
 *
 * The `update` method must be called in order to update the position / orientation / poseStatus.
 */
var EntityPose = (function () {
    function EntityPose(_collection, entityOrId, referenceFrameId) {
        this._collection = _collection;
        /**
         * The status of this pose, as a bitmask.
         *
         * If the current pose is known, then the KNOWN bit is 1.
         * If the current pose is not known, then the KNOWN bit is 0.
         *
         * If the previous pose was known and the current pose is unknown,
         * then the LOST bit is 1.
         * If the previous pose was unknown and the current pose status is known,
         * then the FOUND bit is 1.
         * In all other cases, both the LOST bit and the FOUND bit are 0.
         */
        this.status = 0;
        this.position = new Cartesian3;
        this.orientation = new Quaternion;
        this.time = new JulianDate(0, 0);
        this._previousStatus = 0;
        this._getEntityPositionInReferenceFrame = getEntityPositionInReferenceFrame;
        this._getEntityOrientationInReferenceFrame = getEntityOrientationInReferenceFrame;
        if (typeof entityOrId === 'string') {
            var entity = this._collection.getById(entityOrId);
            if (!entity)
                entity = new ReferenceEntity(this._collection, entityOrId);
            this._entity = entity;
        }
        else {
            this._entity = entityOrId;
        }
        if (typeof referenceFrameId === 'string') {
            var referenceFrame = this._collection.getById(referenceFrameId);
            if (!defined(referenceFrame))
                referenceFrame = new ReferenceEntity(this._collection, referenceFrameId);
            this._referenceFrame = referenceFrame;
        }
        else {
            this._referenceFrame = referenceFrameId;
        }
    }
    Object.defineProperty(EntityPose.prototype, "entity", {
        get: function () { return this._entity; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(EntityPose.prototype, "referenceFrame", {
        get: function () {
            return this._referenceFrame;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(EntityPose.prototype, "poseStatus", {
        /**
         * alias for status
         */
        get: function () { return this.status; },
        enumerable: true,
        configurable: true
    });
    ;
    EntityPose.prototype.update = function (time) {
        var _JulianDate = JulianDate;
        var _PoseStatus = PoseStatus;
        _JulianDate.clone(time, this.time);
        if (!_JulianDate.equals(this._previousTime, time)) {
            this._previousStatus = this.status;
            this._previousTime = _JulianDate.clone(time, this._previousTime);
        }
        var entity = this.entity;
        var referenceFrame = this.referenceFrame;
        var position = this._getEntityPositionInReferenceFrame(entity, time, referenceFrame, this.position);
        var orientation = this._getEntityOrientationInReferenceFrame(entity, time, referenceFrame, this.orientation);
        var hasPose = position && orientation;
        var currentStatus = 0;
        var previousStatus = this._previousStatus;
        if (hasPose) {
            currentStatus |= _PoseStatus.KNOWN;
        }
        if (hasPose && !(previousStatus & _PoseStatus.KNOWN)) {
            currentStatus |= _PoseStatus.FOUND;
        }
        else if (!hasPose && previousStatus & _PoseStatus.KNOWN) {
            currentStatus |= _PoseStatus.LOST;
        }
        this.status = currentStatus;
    };
    return EntityPose;
}());
export { EntityPose };
/**
* A bitmask that provides metadata about the pose of an EntityPose.
*   KNOWN - the pose of the entity state is defined.
*   KNOWN & FOUND - the pose was undefined when the entity state was last queried, and is now defined.
*   LOST - the pose was defined when the entity state was last queried, and is now undefined
*/
export var PoseStatus;
(function (PoseStatus) {
    PoseStatus[PoseStatus["KNOWN"] = 1] = "KNOWN";
    PoseStatus[PoseStatus["FOUND"] = 2] = "FOUND";
    PoseStatus[PoseStatus["LOST"] = 4] = "LOST";
})(PoseStatus || (PoseStatus = {}));
/**
 * A service for subscribing/unsubscribing to entities
 */
var EntityService = (function () {
    function EntityService(sessionService) {
        this.sessionService = sessionService;
        this.collection = new EntityCollection;
        this.subscribedEvent = new Event();
        this.unsubscribedEvent = new Event();
        this.subscriptions = new Map();
        this._scratchCartesian = new Cartesian3;
        this._scratchQuaternion = new Quaternion;
        this._scratchMatrix3 = new Matrix3;
        this._scratchMatrix4 = new Matrix4;
        this._getEntityPositionInReferenceFrame = getEntityPositionInReferenceFrame;
    }
    EntityService.prototype._handleSubscribed = function (evt) {
        var s = this.subscriptions.get(evt.id);
        var stringifiedOptions = evt.options && JSON.stringify(evt.options);
        if (!s || JSON.stringify(s) === stringifiedOptions) {
            if (s)
                this._handleUnsubscribed(evt.id);
            this.subscriptions.set(evt.id, stringifiedOptions && JSON.parse(stringifiedOptions));
            this.subscribedEvent.raiseEvent(evt);
        }
        ;
    };
    EntityService.prototype._handleUnsubscribed = function (id) {
        if (this.subscriptions.has(id)) {
            this.subscriptions.delete(id);
            this.unsubscribedEvent.raiseEvent({ id: id });
        }
        ;
    };
    /**
     * Get the cartographic position of an Entity at the given time
     */
    EntityService.prototype.getCartographic = function (entity, time, result) {
        var fixedPosition = this._getEntityPositionInReferenceFrame(entity, time, ReferenceFrame.FIXED, this._scratchCartesian);
        if (fixedPosition) {
            result = result || new Cartographic();
            return Cartographic.fromCartesian(fixedPosition, undefined, result);
        }
        return undefined;
    };
    /**
    * Create an entity that is positioned at the given cartographic location,
    * with an orientation computed according to the provided `localToFixed` transform function.
    *
    * For the `localToFixed` parameter, you can pass any of the following:
    *
    * ```
    * Argon.Cesium.Transforms.eastNorthUpToFixedFrame
    * Argon.Cesium.Transforms.northEastDownToFixedFrame
    * Argon.Cesium.Transforms.northUpEastToFixedFrame
    * Argon.Cesium.Transforms.northWestUpToFixedFrame
    * ```
    *
    * Additionally, argon.js provides:
    *
    * ```
    * Argon.eastUpSouthToFixedFrame
    * ```
    *
    * Alternative transform functions can be created with:
    *
    * ```
    * Argon.Cesium.Transforms.localFrameToFixedFrameGenerator
    * ```
    */
    EntityService.prototype.createFixed = function (cartographic, localToFixed) {
        // Convert the cartographic location to an ECEF position
        var position = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height, undefined, this._scratchCartesian);
        // compute an appropriate orientation on the surface of the earth
        var transformMatrix = localToFixed(position, undefined, this._scratchMatrix4);
        var rotationMatrix = Matrix4.getRotation(transformMatrix, this._scratchMatrix3);
        var orientation = Quaternion.fromRotationMatrix(rotationMatrix, this._scratchQuaternion);
        // create the entity
        var entity = new Entity({
            position: position,
            orientation: orientation
        });
        return entity;
    };
    EntityService.prototype.subscribe = function (idOrEntity, options, session) {
        var _this = this;
        if (session === void 0) { session = this.sessionService.manager; }
        var id = idOrEntity.id || idOrEntity;
        var evt = { id: id, options: options };
        return session.whenConnected().then(function () {
            if (session.version[0] === 0 && session.version[1] < 2)
                return session.request('ar.context.subscribe', evt);
            else
                return session.request('ar.entity.subscribe', evt);
        }).then(function () {
            var entity = _this.collection.getOrCreateEntity(id);
            _this._handleSubscribed(evt);
            return entity;
        });
    };
    EntityService.prototype.unsubscribe = function (idOrEntity, session) {
        var _this = this;
        if (session === void 0) { session = this.sessionService.manager; }
        var id = idOrEntity.id || idOrEntity;
        session.whenConnected().then(function () {
            if (session.version[0] === 0 && session.version[1] < 2)
                session.send('ar.context.unsubscribe', { id: id });
            else
                session.send('ar.entity.unsubscribe', { id: id });
        }).then(function () {
            _this._handleUnsubscribed(id);
        });
    };
    /**
     * Create a new EntityPose instance to represent the pose of an entity
     * relative to a given reference frame. If no reference frame is specified,
     * then the pose is based on the context's defaultReferenceFrame.
     *
     * @param entity - the entity to track
     * @param referenceFrameOrId - the reference frame to use
     */
    EntityService.prototype.createEntityPose = function (entityOrId, referenceFrameOrId) {
        return new EntityPose(this.collection, entityOrId, referenceFrameOrId);
    };
    /**
     *
     * @param id
     * @param entityState
     */
    EntityService.prototype.updateEntityFromSerializedState = function (id, entityState) {
        var entity = this.collection.getOrCreateEntity(id);
        if (!entityState) {
            if (entity.position) {
                entity.position.setValue(undefined);
            }
            if (entity.orientation) {
                entity.orientation.setValue(undefined);
            }
            entity['meta'] = undefined;
            return entity;
        }
        var positionValue = entityState.p;
        var orientationValue = Quaternion.clone(entityState.o, this._scratchQuaternion); // workaround for https://github.com/AnalyticalGraphicsInc/cesium/issues/5031
        var referenceFrame = typeof entityState.r === 'number' ?
            entityState.r : this.collection.getOrCreateEntity(entityState.r);
        var entityPosition = entity.position;
        var entityOrientation = entity.orientation;
        if (entityPosition instanceof ConstantPositionProperty) {
            entityPosition.setValue(positionValue, referenceFrame);
        }
        else {
            entity.position = new ConstantPositionProperty(positionValue, referenceFrame);
        }
        if (entityOrientation instanceof ConstantProperty) {
            entityOrientation.setValue(orientationValue);
        }
        else {
            entity.orientation = new ConstantProperty(orientationValue);
        }
        entity['meta'] = entityState.meta;
        return entity;
    };
    return EntityService;
}());
EntityService = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [SessionService])
], EntityService);
export { EntityService };
/**
 * A service for publishing entity states to managed sessions
 */
var EntityServiceProvider = (function () {
    function EntityServiceProvider(sessionService, entityService, permissionServiceProvider) {
        var _this = this;
        this.sessionService = sessionService;
        this.entityService = entityService;
        this.permissionServiceProvider = permissionServiceProvider;
        this.subscriptionsBySubscriber = new WeakMap();
        this.subscribersByEntity = new Map();
        this.sessionSubscribedEvent = new Event();
        this.sessionUnsubscribedEvent = new Event();
        this.targetReferenceFrameMap = new Map();
        this._cacheTime = new JulianDate(0, 0);
        this._entityPoseCache = {};
        this._getSerializedEntityState = getSerializedEntityState;
        this.sessionService.ensureIsRealityManager();
        this.sessionService.connectEvent.addEventListener(function (session) {
            var subscriptions = new Map();
            _this.subscriptionsBySubscriber.set(session, subscriptions);
            session.on['ar.entity.subscribe'] = session.on['ar.context.subscribe'] = function (_a) {
                var id = _a.id, options = _a.options;
                var currentOptions = subscriptions.get(id);
                if (currentOptions && jsonEquals(currentOptions, options))
                    return;
                var subscribers = _this.subscribersByEntity.get(id) || new Set();
                _this.subscribersByEntity.set(id, subscribers);
                subscribers.add(session);
                subscriptions.set(id, options);
                _this.sessionSubscribedEvent.raiseEvent({ session: session, id: id, options: options });
                return _this.permissionServiceProvider.handlePermissionRequest(session, id, options).then(function () { });
            };
            session.on['ar.entity.unsubscribe'] = session.on['ar.context.unsubscribe'] = function (_a) {
                var id = _a.id;
                if (!subscriptions.has(id))
                    return;
                var subscribers = _this.subscribersByEntity.get(id);
                subscribers && subscribers.delete(session);
                subscriptions.delete(id);
                _this.sessionUnsubscribedEvent.raiseEvent({ id: id, session: session });
            };
            session.closeEvent.addEventListener(function () {
                _this.subscriptionsBySubscriber.delete(session);
                subscriptions.forEach(function (options, id) {
                    var subscribers = _this.subscribersByEntity.get(id);
                    subscribers && subscribers.delete(session);
                    _this.sessionUnsubscribedEvent.raiseEvent({ id: id, session: session });
                });
            });
        });
    }
    EntityServiceProvider.prototype.fillEntityStateMapForSession = function (session, time, entities) {
        var subscriptions = this.subscriptionsBySubscriber.get(session);
        if (!subscriptions)
            return;
        var iter = subscriptions.keys();
        var item;
        while (item = iter.next(), !item.done) {
            var id = item.value;
            var entity = this.entityService.collection.getById(id);
            entities[id] = entity ? this.getCachedSerializedEntityState(entity, time) : null;
        }
    };
    EntityServiceProvider.prototype.getCachedSerializedEntityState = function (entity, time) {
        if (!entity)
            return null;
        var id = entity.id;
        if (!defined(this._entityPoseCache[id]) || !this._cacheTime.equalsEpsilon(time, 0.000001)) {
            var referenceFrameId = this.targetReferenceFrameMap.get(id);
            var referenceFrame = defined(referenceFrameId) && typeof referenceFrameId === 'string' ?
                this.entityService.collection.getById(referenceFrameId) :
                defined(referenceFrameId) ? referenceFrameId : this.entityService.collection.getById('ar.stage');
            this._entityPoseCache[id] = this._getSerializedEntityState(entity, time, referenceFrame);
        }
        return this._entityPoseCache[id];
    };
    return EntityServiceProvider;
}());
EntityServiceProvider = __decorate([
    autoinject,
    __metadata("design:paramtypes", [SessionService,
        EntityService,
        PermissionServiceProvider])
], EntityServiceProvider);
export { EntityServiceProvider };
