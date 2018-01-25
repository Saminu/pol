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
import { createGuid } from '../cesium/cesium-imports';
import { SessionService } from '../session';
import { ViewService } from '../view';
import { RealityViewer } from './base';
var HostedRealityViewer = (function (_super) {
    __extends(HostedRealityViewer, _super);
    function HostedRealityViewer(sessionService, viewService, uri) {
        var _this = _super.call(this, uri) || this;
        _this.sessionService = sessionService;
        _this.viewService = viewService;
        _this.uri = uri;
        _this.type = 'hosted';
        if (typeof document !== 'undefined' && document.createElement) {
            var iframeElement = _this.iframeElement = document.createElement('iframe');
            iframeElement.name = createGuid();
            iframeElement.style.border = '0';
            iframeElement.width = '100%';
            iframeElement.height = '100%';
            iframeElement.style.position = 'absolute';
            iframeElement.style.opacity = '0';
            iframeElement.style.pointerEvents = 'none';
            iframeElement.style.zIndex = "-100";
            var viewElement = _this.viewService.element;
            viewElement.insertBefore(iframeElement, viewElement.firstChild);
            _this.presentChangeEvent.addEventListener(function () {
                _this.iframeElement.style.opacity = _this.isPresenting ? '1' : '0';
            });
        }
        return _this;
    }
    HostedRealityViewer.prototype.destroy = function () {
        _super.prototype.destroy.call(this);
        if (this.iframeElement) {
            this.iframeElement.remove();
        }
    };
    HostedRealityViewer.prototype.load = function () {
        var _this = this;
        if (typeof document !== 'undefined' && document.createElement) {
            var session_1 = this.sessionService.addManagedSessionPort(this.uri);
            session_1.connectEvent.addEventListener(function () {
                if (_this.sessionService.manager.isClosed)
                    return;
                _this.connectEvent.raiseEvent(session_1);
            });
            var handleConnectMessage_1 = function (ev) {
                if (ev.data.type !== 'ARGON_SESSION')
                    return;
                var name = ev.data.name;
                var messagePort = ev.ports && ev.ports[0];
                if (!messagePort)
                    throw new Error('Received an ARGON_SESSION message without a MessagePort object');
                if (name !== _this.iframeElement.name)
                    return;
                window.removeEventListener('message', handleConnectMessage_1);
                session_1.open(messagePort, _this.sessionService.configuration);
            };
            window.addEventListener('message', handleConnectMessage_1);
            this.iframeElement.src = '';
            this.iframeElement.src = this.uri;
        }
    };
    return HostedRealityViewer;
}(RealityViewer));
HostedRealityViewer = __decorate([
    inject(SessionService, ViewService),
    __metadata("design:paramtypes", [SessionService,
        ViewService, String])
], HostedRealityViewer);
export { HostedRealityViewer };
// @singleton()
// @inject(SessionFactory)
// export class DOMSessionListenerService {
// 	public sessionEvent = new Event<Session>();
// 	constructor(sessionFactory:SessionFactory) {
// 		window.addEventListener('message', ev => {
// 			if (ev.data.type != 'ARGON_SESSION') return;
// 			const messagePort:MessagePortLike = ev.ports && ev.ports[0];
// 			if (!messagePort) 
// 				throw new Error('Received an ARGON_SESSION message without a MessagePort object');
// 			// get the event.source iframe
// 			let i = 0;
// 			let frame:HTMLIFrameElement = null;
// 			while (i < window.frames.length && frame != null) {
// 				if (window.frames[i] == ev.source)
// 					frame = document.getElementsByTagName( 'iframe' )[i];
// 			}			
// 			const session = sessionFactory.create();
// 			session.frame = frame;
// 			if (frame) frame.addEventListener('load', function close() {
// 				frame.removeEventListener('load', close);
// 				console.log('IFrameSessionHandler: frame load detected, closing current session.', frame, session)
// 				session.close()
// 			});
// 			this.sessionEvent.raiseEvent(session);
// 		});
// 	}
// }
