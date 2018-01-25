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
import { Role } from '../common';
import { SessionService } from '../session';
import { ViewService } from '../view';
import { ContextService } from '../context';
import { DeviceService } from '../device';
import { RealityViewer } from './base';
var LiveRealityViewer = (function (_super) {
    __extends(LiveRealityViewer, _super);
    function LiveRealityViewer(sessionService, viewService, contextService, deviceService, uri) {
        var _this = _super.call(this, uri) || this;
        _this.sessionService = sessionService;
        _this.viewService = viewService;
        _this.contextService = contextService;
        _this.deviceService = deviceService;
        _this.uri = uri;
        if (typeof document !== 'undefined') {
            _this.settingsIframe = document.createElement('iframe');
            _this.settingsIframe.width = '0';
            _this.settingsIframe.height = '0';
            _this.settingsIframe.src = 'https://argonjs.io/tools.argonjs.io/';
            _this.settingsIframe.style.display = 'none';
            _this.videoFov = Math.PI / 2;
            _this.videoElement = document.createElement('video');
            _this.videoElement.style.width = '100%';
            _this.videoElement.style.height = 'height:100%';
            _this.videoElement.controls = false;
            _this.videoElement.autoplay = true;
            _this.videoElement.style.display = 'none';
            _this.videoElement.style.zIndex = "-100";
            var viewElement = _this.viewService.element;
            viewElement.insertBefore(_this.settingsIframe, viewElement.firstChild);
            viewElement.insertBefore(_this.videoElement, viewElement.firstChild);
            _this.canvas = document.createElement('canvas');
            _this.context = _this.canvas.getContext('2d');
            window.addEventListener('message', function (event) {
                var origin = event.origin;
                if (origin === 'http://argonjs.io') {
                    _this.videoFov = event.data; // TODO: this is not flexible. Should be passing an object with message type and data
                }
            });
        }
        _this.presentChangeEvent.addEventListener(function () {
            if (typeof document !== 'undefined') {
                _this.videoElement.style.display = _this.isPresenting ? 'initial' : 'none';
            }
        });
        return _this;
    }
    LiveRealityViewer.prototype.destroy = function () {
        _super.prototype.destroy.call(this);
        if (typeof document !== 'undefined') {
            this.settingsIframe.remove();
            this.videoElement.remove();
            this.canvas.remove();
        }
    };
    LiveRealityViewer.prototype.setupInternalSession = function (internalSession) {
        var _this = this;
        internalSession.connectEvent.addEventListener(function () {
            if (_this.videoElement) {
                var videoElement_1 = _this.videoElement;
                var mediaDevices = navigator.mediaDevices;
                var getUserMedia = (mediaDevices.getUserMedia || mediaDevices['mozGetUserMedia'] ||
                    mediaDevices['msGetUserMedia'] || mediaDevices['webkitGetUserMedia']).bind(mediaDevices);
                getUserMedia({ audio: false, video: true }).then(function (videoStream) {
                    var stopVideoStream = function () {
                        for (var _i = 0, _a = videoStream.getTracks(); _i < _a.length; _i++) {
                            var t = _a[_i];
                            t.stop();
                        }
                    };
                    if (internalSession.isConnected) {
                        videoElement_1.src = window.URL.createObjectURL(videoStream);
                        internalSession.closeEvent.addEventListener(stopVideoStream);
                    }
                    else {
                        stopVideoStream();
                    }
                }).catch(function (error) {
                    internalSession.errorEvent.raiseEvent(error);
                });
                // const viewService = this.viewService;
                var lastFrameTime_1 = -1;
                var remove1_1 = _this.deviceService.suggestedGeolocationSubscriptionChangeEvent.addEventListener(function () {
                    if (_this.deviceService.suggestedGeolocationSubscription) {
                        _this.deviceService.subscribeGeolocation(_this.deviceService.suggestedGeolocationSubscription, internalSession);
                    }
                    else {
                        _this.deviceService.unsubscribeGeolocation();
                    }
                });
                var remove2_1 = _this.deviceService.frameStateEvent.addEventListener(function (frameState) {
                    if (videoElement_1.currentTime != lastFrameTime_1) {
                        lastFrameTime_1 = videoElement_1.currentTime;
                        // const videoWidth = videoElement.videoWidth;
                        // const videoHeight = videoElement.videoHeight;
                        var contextFrameState = _this.contextService.createFrameState(frameState.time, frameState.viewport, frameState.subviews);
                        internalSession.send('ar.reality.frameState', contextFrameState);
                    }
                });
                internalSession.closeEvent.addEventListener(function () {
                    remove1_1();
                    remove2_1();
                });
            }
        });
    };
    LiveRealityViewer.prototype.load = function () {
        var _this = this;
        var session = this.sessionService.addManagedSessionPort(this.uri);
        session.connectEvent.addEventListener(function () {
            _this.connectEvent.raiseEvent(session);
        });
        var internalSession = this.sessionService.createSessionPort(this.uri);
        internalSession.suppressErrorOnUnknownTopic = true;
        this.setupInternalSession(internalSession);
        // Only connect after the caller is able to attach connectEvent handlers
        Promise.resolve().then(function () {
            if (_this.sessionService.manager.isClosed)
                return;
            var messageChannel = _this.sessionService.createSynchronousMessageChannel();
            session.open(messageChannel.port1, _this.sessionService.configuration);
            internalSession.open(messageChannel.port2, { role: Role.REALITY_VIEWER, title: 'Live', uri: _this.uri, version: _this.sessionService.configuration.version });
        });
    };
    LiveRealityViewer.isAvailable = function () {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
            var mediaDevices = navigator.mediaDevices;
            return !!(mediaDevices.getUserMedia || mediaDevices['mozGetUserMedia'] || mediaDevices['msGetUserMedia'] || mediaDevices['webkitGetUserMedia']);
        }
        else {
            return false;
        }
    };
    LiveRealityViewer.prototype.getVideoFrame = function (x, y, width, height) {
        this.canvas.width = this.videoElement.videoWidth;
        this.canvas.height = this.videoElement.videoHeight;
        this.context.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
        return this.context.getImageData(x, y, width, height);
    };
    return LiveRealityViewer;
}(RealityViewer));
LiveRealityViewer = __decorate([
    inject(SessionService, ViewService, ContextService, DeviceService),
    __metadata("design:paramtypes", [SessionService,
        ViewService,
        ContextService,
        DeviceService, String])
], LiveRealityViewer);
export { LiveRealityViewer };
