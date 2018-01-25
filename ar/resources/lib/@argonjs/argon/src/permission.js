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
var Permission = (function () {
    function Permission(type, state) {
        this.type = type;
        this.state = state || PermissionState.NOT_REQUIRED;
    }
    return Permission;
}());
export { Permission };
export var PermissionState;
(function (PermissionState) {
    PermissionState[PermissionState["NOT_REQUIRED"] = 'not_required'] = "NOT_REQUIRED";
    PermissionState[PermissionState["PROMPT"] = 'prompt'] = "PROMPT";
    PermissionState[PermissionState["GRANTED"] = 'granted'] = "GRANTED";
    PermissionState[PermissionState["DENIED"] = 'denied'] = "DENIED";
})(PermissionState || (PermissionState = {}));
/**
 * Access permission states
 */
var PermissionService = (function () {
    function PermissionService(sessionService) {
        this.sessionService = sessionService;
    }
    /**
     * Query current state of permission
     *
     * @returns A Promise that resolves to the current state of the permission
     */
    // public query() : Promise<Permission[]>;
    PermissionService.prototype.query = function (type, session) {
        if (session === void 0) { session = this.sessionService.manager; }
        // let permissionMaps: Permission[] = [];
        return session.request('ar.permission.query', { type: type }).then(function (_a) {
            var state = _a.state;
            return state || PermissionState.NOT_REQUIRED;
        });
    };
    /**
     * Revoke permissions
     *
     * @returns A promise that resolves to the state of requested permission after revoking.
     * Should be PermissionState.Denied on success.
     */
    PermissionService.prototype.revoke = function (type) {
        var session = this.sessionService.manager;
        return session.request('ar.permission.revoke', { type: type }).then(function (_a) {
            var state = _a.state;
            return state;
        });
    };
    return PermissionService;
}());
PermissionService = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [SessionService])
], PermissionService);
export { PermissionService };
/**
 * Manage permissions
 */
var PermissionServiceProvider = (function () {
    function PermissionServiceProvider(sessionService) {
        var _this = this;
        this.sessionService = sessionService;
        this.sessionService.ensureIsRealityManager();
        this.sessionService.connectEvent.addEventListener(function (session) {
            session.on['ar.permission.query'] = function (_a) {
                var type = _a.type;
                return Promise.resolve({ state: _this.getPermissionState(session, type) });
            };
            /**
             * Browswer should override this if they want to allow revoking permissions.
             * @param type
             * @returns A promise that resolves to the state of the permission after revoking
             */
            session.on['ar.permission.revoke'] = function (_a) {
                var type = _a.type;
                return Promise.reject(new Error("Revoking permission is not supported on this browser."));
            };
        });
    }
    /**
     * Browsers should override this and ask the users via their own UI.
     * The permissions should be stored locally based on the host name and id(=type).
     * @param session Used to acquire hostname from the uri.
     * @param id Can be used as a type of permission. Also can be random id's on Vuforia requests.
     * @returns A resolved promise if subscription is permitted.
     * @returns A rejected promise if subscription is not permitted.
     */
    PermissionServiceProvider.prototype.handlePermissionRequest = function (session, id, options) {
        return Promise.resolve();
    };
    /**
     * Browsers should override this to check their locally stored permissions.
     * @param type
     * @returns The current state of the permission
     */
    PermissionServiceProvider.prototype.getPermissionState = function (session, type) {
        return PermissionState.GRANTED;
    };
    return PermissionServiceProvider;
}());
PermissionServiceProvider = __decorate([
    autoinject(),
    __metadata("design:paramtypes", [SessionService])
], PermissionServiceProvider);
export { PermissionServiceProvider };
