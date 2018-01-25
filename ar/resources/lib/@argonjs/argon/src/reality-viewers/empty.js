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
import { inject, Container } from 'aurelia-dependency-injection';
import { CameraEventAggregator, CameraEventType, ReferenceFrame, Cartesian3, Quaternion, Matrix3, Matrix4, PerspectiveFrustum, CesiumMath } from '../cesium/cesium-imports';
import { Configuration, Role, SerializedSubviewList } from '../common';
import { SessionService, ConnectService, SessionConnectService } from '../session';
import { eastUpSouthToFixedFrame, decomposePerspectiveProjectionMatrix, getEntityPositionInReferenceFrame, getEntityOrientationInReferenceFrame } from '../utils';
import { EntityService } from '../entity';
import { ContextService } from '../context';
import { DeviceService } from '../device';
import { ViewService } from '../view';
import { PoseStatus } from '../entity';
import { RealityViewer } from './base';
import { RealityService } from '../reality';
import { VisibilityService } from '../visibility';
var EmptyRealityViewer = (function (_super) {
    __extends(EmptyRealityViewer, _super);
    function EmptyRealityViewer(sessionService, viewService, container, uri) {
        var _this = _super.call(this, uri) || this;
        _this.sessionService = sessionService;
        _this.viewService = viewService;
        _this.container = container;
        _this.uri = uri;
        _this.type = 'empty';
        _this._moveFlags = {
            moveForward: false,
            moveBackward: false,
            moveUp: false,
            moveDown: false,
            moveLeft: false,
            moveRight: false
        };
        _this._scratchMatrix3 = new Matrix3;
        _this._scratchMatrix4 = new Matrix4;
        function getFlagForKeyCode(keyCode) {
            switch (keyCode) {
                case 'W'.charCodeAt(0):
                    return 'moveForward';
                case 'S'.charCodeAt(0):
                    return 'moveBackward';
                case 'E'.charCodeAt(0):
                    return 'moveUp';
                case 'R'.charCodeAt(0):
                    return 'moveDown';
                case 'D'.charCodeAt(0):
                    return 'moveRight';
                case 'A'.charCodeAt(0):
                    return 'moveLeft';
                default:
                    return undefined;
            }
        }
        var keydownListener = function (e) {
            var flagName = getFlagForKeyCode(e.keyCode);
            if (typeof flagName !== 'undefined') {
                _this._moveFlags[flagName] = true;
            }
        };
        var keyupListener = function (e) {
            var flagName = getFlagForKeyCode(e.keyCode);
            if (typeof flagName !== 'undefined') {
                _this._moveFlags[flagName] = false;
            }
        };
        if (typeof document !== 'undefined') {
            _this.presentChangeEvent.addEventListener(function () {
                if (_this.isPresenting) {
                    _this.viewService.element.style.backgroundColor = 'white';
                    if (!_this._aggregator && _this.viewService.element) {
                        _this.viewService.element['disableRootEvents'] = true;
                        _this._aggregator = new CameraEventAggregator(_this.viewService.element);
                        document.addEventListener('keydown', keydownListener, false);
                        document && document.addEventListener('keyup', keyupListener, false);
                    }
                }
                else {
                    delete _this.viewService.element.style.backgroundColor;
                    _this._aggregator && _this._aggregator.destroy();
                    _this._aggregator = undefined;
                    document && document.removeEventListener('keydown', keydownListener);
                    document && document.removeEventListener('keyup', keyupListener);
                    for (var k in _this._moveFlags) {
                        _this._moveFlags[k] = false;
                    }
                }
            });
        }
        return _this;
    }
    EmptyRealityViewer.prototype.load = function () {
        var _this = this;
        // Create a child container so that we can conveniently setup all the services
        // that would exist in a normal hosted reality viewer 
        var child = this.container.createChild();
        // Create the session instance that will be used by the manager to talk to the reality 
        var session = this.sessionService.addManagedSessionPort(this.uri);
        session.connectEvent.addEventListener(function () {
            _this.connectEvent.raiseEvent(session); // let the manager know the session is ready
        });
        // use a SessionConnectService to create a connection via the session instance we created
        child.registerInstance(ConnectService, new SessionConnectService(session, this.sessionService.configuration));
        // setup the configuration for our empty reality
        child.registerInstance(Configuration, {
            role: Role.REALITY_VIEWER,
            uri: this.uri,
            title: 'Empty',
            version: this.sessionService.configuration.version,
            supportsCustomProtocols: true,
            protocols: ['ar.configureStage@v1']
        });
        // Create the basic services that we need to use. 
        // Note: we won't create a child ViewService here,
        // as we are already managing the DOM with the
        // ViewService that exists in the root container. 
        child.autoRegisterAll([SessionService, EntityService, VisibilityService, ContextService, DeviceService, RealityService]);
        var childContextService = child.get(ContextService);
        var childDeviceService = child.get(DeviceService);
        var childSessionService = child.get(SessionService);
        var childRealityService = child.get(RealityService);
        var childViewService = child.get(ViewService);
        // the child device service should *not* submit frames to the vrdisplay. 
        childDeviceService.autoSubmitFrame = false;
        var customStagePosition;
        var customStageOrientation;
        // Create protocol handlers for `ar.configureStage` protocol
        childRealityService.connectEvent.addEventListener(function (session) {
            session.on['ar.configureStage.setStageGeolocation'] = function (_a) {
                var geolocation = _a.geolocation;
                customStagePosition = Cartesian3.fromRadians(geolocation.longitude, geolocation.latitude, geolocation.height, undefined, customStagePosition);
                var transformMatrix = eastUpSouthToFixedFrame(customStagePosition, undefined, _this._scratchMatrix4);
                var rotationMatrix = Matrix4.getRotation(transformMatrix, _this._scratchMatrix3);
                customStageOrientation = Quaternion.fromRotationMatrix(rotationMatrix, customStageOrientation);
            };
            session.on['ar.configureStage.resetStageGeolocation'] = function () {
                customStagePosition = undefined;
                customStageOrientation = undefined;
            };
        });
        // Setup everything after connected to the manager. The manager only connects once.
        childSessionService.manager.connectEvent.addEventListener(function () {
            // since we aren't create a child view service and viewport service, 
            // suppress any errors from not handling these messages
            childSessionService.manager.suppressErrorOnUnknownTopic = true;
            var scratchQuaternion = new Quaternion;
            var scratchQuaternionDragYaw = new Quaternion;
            // const pitchQuat = new Quaternion;
            var positionScratchCartesian = new Cartesian3;
            var movementScratchCartesian = new Cartesian3;
            var orientationMatrix = new Matrix3;
            var up = new Cartesian3(0, 0, 1);
            var right = new Cartesian3(1, 0, 0);
            var forward = new Cartesian3(0, -1, 0);
            var scratchFrustum = new PerspectiveFrustum();
            var deviceStage = childDeviceService.stage;
            var deviceUser = childDeviceService.user;
            var NEGATIVE_UNIT_Z = new Cartesian3(0, 0, -1);
            // const X_90ROT = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, CesiumMath.PI_OVER_TWO);
            var subviews = [];
            var deviceUserPose = childContextService.createEntityPose(deviceUser, deviceStage);
            var checkSuggestedGeolocationSubscription = function () {
                if (childDeviceService.suggestedGeolocationSubscription) {
                    childDeviceService.subscribeGeolocation(childDeviceService.suggestedGeolocationSubscription);
                }
                else {
                    childDeviceService.unsubscribeGeolocation();
                }
            };
            checkSuggestedGeolocationSubscription();
            var remove1 = childDeviceService.suggestedGeolocationSubscriptionChangeEvent.addEventListener(checkSuggestedGeolocationSubscription);
            var remove2 = childDeviceService.frameStateEvent.addEventListener(function (frameState) {
                if (childSessionService.manager.isClosed)
                    return;
                var aggregator = _this._aggregator;
                var flags = _this._moveFlags;
                if (!_this.isPresenting) {
                    aggregator && aggregator.reset();
                    return;
                }
                SerializedSubviewList.clone(frameState.subviews, subviews);
                // provide fov controls
                if (!childDeviceService.strict) {
                    decomposePerspectiveProjectionMatrix(subviews[0].projectionMatrix, scratchFrustum);
                    scratchFrustum.fov = childViewService.subviews[0] && childViewService.subviews[0].frustum.fov || CesiumMath.PI_OVER_THREE;
                    if (aggregator && aggregator.isMoving(CameraEventType.WHEEL)) {
                        var wheelMovement = aggregator.getMovement(CameraEventType.WHEEL);
                        var diff = wheelMovement.endPosition.y;
                        scratchFrustum.fov = Math.min(Math.max(scratchFrustum.fov - diff * 0.02, Math.PI / 8), Math.PI - Math.PI / 8);
                    }
                    if (aggregator && aggregator.isMoving(CameraEventType.PINCH)) {
                        var pinchMovement = aggregator.getMovement(CameraEventType.PINCH);
                        var diff = pinchMovement.distance.endPosition.y - pinchMovement.distance.startPosition.y;
                        scratchFrustum.fov = Math.min(Math.max(scratchFrustum.fov - diff * 0.02, Math.PI / 8), Math.PI - Math.PI / 8);
                    }
                    subviews.forEach(function (s) {
                        var aspect = s.viewport.width / s.viewport.height;
                        scratchFrustum.aspectRatio = isFinite(aspect) ? aspect : 1;
                        Matrix4.clone(scratchFrustum.projectionMatrix, s.projectionMatrix);
                    });
                }
                var time = frameState.time;
                deviceUserPose.update(time);
                var overrideUser = !(deviceUserPose.status & PoseStatus.KNOWN);
                // provide controls if the device does not have a physical pose
                if (overrideUser) {
                    var contextUser = childContextService.user;
                    var contextStage = childContextService.stage;
                    var position = getEntityPositionInReferenceFrame(contextUser, time, contextStage, positionScratchCartesian) ||
                        Cartesian3.fromElements(0, childDeviceService.suggestedUserHeight, 0, positionScratchCartesian);
                    var orientation_1 = getEntityOrientationInReferenceFrame(contextUser, time, contextStage, scratchQuaternion) ||
                        Quaternion.clone(Quaternion.IDENTITY, scratchQuaternion);
                    if (aggregator && aggregator.isMoving(CameraEventType.LEFT_DRAG)) {
                        var dragMovement = aggregator.getMovement(CameraEventType.LEFT_DRAG);
                        if (orientation_1) {
                            // const dragPitch = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, frustum.fov * (dragMovement.endPosition.y - dragMovement.startPosition.y) / app.view.getViewport().height, scratchQuaternionDragPitch);
                            var dragYaw = Quaternion.fromAxisAngle(Cartesian3.UNIT_Y, scratchFrustum.fov * (dragMovement.endPosition.x - dragMovement.startPosition.x) / frameState.viewport.width, scratchQuaternionDragYaw);
                            // const drag = Quaternion.multiply(dragPitch, dragYaw, dragYaw);
                            orientation_1 = Quaternion.multiply(orientation_1, dragYaw, dragYaw);
                            contextUser.orientation.setValue(orientation_1);
                        }
                    }
                    Matrix3.fromQuaternion(orientation_1, orientationMatrix);
                    Matrix3.multiplyByVector(orientationMatrix, Cartesian3.UNIT_Y, up);
                    Matrix3.multiplyByVector(orientationMatrix, Cartesian3.UNIT_X, right);
                    Matrix3.multiplyByVector(orientationMatrix, NEGATIVE_UNIT_Z, forward);
                    var moveRate = 0.02;
                    if (flags.moveForward) {
                        Cartesian3.multiplyByScalar(forward, moveRate, movementScratchCartesian);
                        Cartesian3.add(position, movementScratchCartesian, position);
                    }
                    if (flags.moveBackward) {
                        Cartesian3.multiplyByScalar(forward, -moveRate, movementScratchCartesian);
                        Cartesian3.add(position, movementScratchCartesian, position);
                    }
                    if (flags.moveUp) {
                        Cartesian3.multiplyByScalar(up, moveRate, movementScratchCartesian);
                        Cartesian3.add(position, movementScratchCartesian, position);
                    }
                    if (flags.moveDown) {
                        Cartesian3.multiplyByScalar(up, -moveRate, movementScratchCartesian);
                        Cartesian3.add(position, movementScratchCartesian, position);
                    }
                    if (flags.moveLeft) {
                        Cartesian3.multiplyByScalar(right, -moveRate, movementScratchCartesian);
                        Cartesian3.add(position, movementScratchCartesian, position);
                    }
                    if (flags.moveRight) {
                        Cartesian3.multiplyByScalar(right, moveRate, movementScratchCartesian);
                        Cartesian3.add(position, movementScratchCartesian, position);
                    }
                    contextUser.position.setValue(position, contextStage);
                    contextUser.orientation.setValue(orientation_1);
                }
                var overrideStage = customStagePosition && customStageOrientation ? true : false;
                if (overrideStage) {
                    var contextStage = childContextService.stage;
                    contextStage.position.setValue(customStagePosition, ReferenceFrame.FIXED);
                    contextStage.orientation.setValue(customStageOrientation);
                }
                var contextFrameState = childContextService.createFrameState(time, frameState.viewport, subviews, {
                    overrideUser: overrideUser,
                    overrideStage: overrideStage
                });
                childContextService.submitFrameState(contextFrameState);
                aggregator && aggregator.reset();
            });
            childSessionService.manager.closeEvent.addEventListener(function () {
                remove1();
                remove2();
            });
        });
        childSessionService.connect();
    };
    return EmptyRealityViewer;
}(RealityViewer));
EmptyRealityViewer = __decorate([
    inject(SessionService, ViewService, Container),
    __metadata("design:paramtypes", [SessionService,
        ViewService,
        Container, String])
], EmptyRealityViewer);
export { EmptyRealityViewer };
