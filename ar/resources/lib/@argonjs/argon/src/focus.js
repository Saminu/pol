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
import { Event } from './utils';
/**
 * Access focus state
 */
var FocusService = (function () {
    function FocusService(sessionService) {
        var _this = this;
        /**
         * An event that is raised when this app has gained focus
         */
        this.focusEvent = new Event();
        /**
         * An event that is raised when this app has lost focus
         */
        this.blurEvent = new Event();
        this._hasFocus = false;
        sessionService.manager.on['ar.focus.state'] = function (_a) {
            var state = _a.state;
            if (_this._hasFocus !== state) {
                _this._hasFocus = state;
                if (state) {
                    _this.focusEvent.raiseEvent(undefined);
                }
                else {
                    _this.blurEvent.raiseEvent(undefined);
                }
            }
        };
    }
    Object.defineProperty(FocusService.prototype, "hasFocus", {
        /**
         * True if this app has focus
         */
        get: function () { return this._hasFocus; },
        enumerable: true,
        configurable: true
    });
    return FocusService;
}());
FocusService = __decorate([
    inject(SessionService),
    __metadata("design:paramtypes", [SessionService])
], FocusService);
export { FocusService };
/**
 * Manage focus state
 */
var FocusServiceProvider = (function () {
    function FocusServiceProvider(sessionService) {
        var _this = this;
        this.sessionService = sessionService;
        this.sessionFocusEvent = new Event();
        sessionService.ensureIsRealityManager();
        sessionService.manager.connectEvent.addEventListener(function () {
            setTimeout(function () {
                if (!_this._session && _this.sessionService.manager.isConnected)
                    _this.session = _this.sessionService.manager;
            });
        });
    }
    Object.defineProperty(FocusServiceProvider.prototype, "session", {
        get: function () { return this._session; },
        set: function (session) {
            if (session && !session.isConnected)
                throw new Error('Only a connected session can be granted focus');
            var previousFocussedSession = this._session;
            if (previousFocussedSession !== session) {
                if (previousFocussedSession)
                    previousFocussedSession.send('ar.focus.state', { state: false });
                if (session)
                    session.send('ar.focus.state', { state: true });
                this._session = session;
                this.sessionFocusEvent.raiseEvent({
                    previous: previousFocussedSession,
                    current: session
                });
            }
        },
        enumerable: true,
        configurable: true
    });
    ;
    return FocusServiceProvider;
}());
FocusServiceProvider = __decorate([
    inject(SessionService, FocusService),
    __metadata("design:paramtypes", [SessionService])
], FocusServiceProvider);
export { FocusServiceProvider };
