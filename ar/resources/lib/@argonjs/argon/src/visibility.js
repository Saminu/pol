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
 * Access visibility state
 */
var VisibilityService = (function () {
    function VisibilityService(sessionService) {
        var _this = this;
        /**
         * An event that is raised when the app becomes visible
         */
        this.showEvent = new Event();
        /**
         * An event that is raised when the app becomes hidden
         */
        this.hideEvent = new Event();
        this._isVisible = false;
        sessionService.manager.on['ar.visibility.state'] = function (_a) {
            var state = _a.state;
            if (_this._isVisible !== state) {
                _this._isVisible = state;
                if (state)
                    _this.showEvent.raiseEvent(undefined);
                else
                    _this.hideEvent.raiseEvent(undefined);
            }
        };
        sessionService.manager.closeEvent.addEventListener(function () {
            if (_this._isVisible) {
                _this._isVisible = false;
                _this.hideEvent.raiseEvent(undefined);
            }
        });
        // if running in an old manager, assume we are visible
        sessionService.manager.connectEvent.addEventListener(function () {
            if (sessionService.manager.version[0] === 0) {
                _this._isVisible = true;
                _this.showEvent.raiseEvent(undefined);
            }
        });
    }
    Object.defineProperty(VisibilityService.prototype, "isVisible", {
        /**
         * True if this app has focus
         */
        get: function () { return this._isVisible; },
        enumerable: true,
        configurable: true
    });
    return VisibilityService;
}());
VisibilityService = __decorate([
    inject(SessionService),
    __metadata("design:paramtypes", [SessionService])
], VisibilityService);
export { VisibilityService };
/**
 * Manage visibility state
 */
var VisibilityServiceProvider = (function () {
    function VisibilityServiceProvider(sessionService) {
        var _this = this;
        this.visibleSessions = new Set();
        this.sessionChangeEvent = new Event();
        sessionService.ensureIsRealityManager();
        this.sessionChangeEvent.addEventListener(function (session) {
            session.send('ar.visibility.state', { state: _this.visibleSessions.has(session) });
        });
        sessionService.manager.connectEvent.addEventListener(function () {
            _this.set(sessionService.manager, true);
        });
    }
    VisibilityServiceProvider.prototype.set = function (session, visibility) {
        if (visibility) {
            if (!this.visibleSessions.has(session)) {
                this.visibleSessions.add(session);
                this.sessionChangeEvent.raiseEvent(session);
            }
        }
        else {
            if (this.visibleSessions.has(session)) {
                this.visibleSessions.delete(session);
                this.sessionChangeEvent.raiseEvent(session);
            }
        }
    };
    return VisibilityServiceProvider;
}());
VisibilityServiceProvider = __decorate([
    inject(SessionService, VisibilityService),
    __metadata("design:paramtypes", [SessionService])
], VisibilityServiceProvider);
export { VisibilityServiceProvider };
