import { Event } from '../utils';
/**
 * Abstract class for a RealityViewer
 */
var RealityViewer = (function () {
    function RealityViewer(uri) {
        var _this = this;
        this.uri = uri;
        this.providedReferenceFrames = [];
        this.connectEvent = new Event();
        this.presentChangeEvent = new Event();
        this._isPresenting = false;
        this.connectEvent.addEventListener(function (session) {
            if (_this._session)
                _this._session.close();
            _this._session = session;
            session.closeEvent.addEventListener(function () {
                if (_this._session === session)
                    _this._session = undefined;
            });
        });
    }
    Object.defineProperty(RealityViewer.prototype, "isPresenting", {
        get: function () {
            return this._isPresenting;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RealityViewer.prototype, "session", {
        get: function () {
            return this._session;
        },
        enumerable: true,
        configurable: true
    });
    RealityViewer.prototype.destroy = function () {
        this.setPresenting(false);
        if (this.session) {
            this.session.close();
        }
    };
    ;
    RealityViewer.prototype.setPresenting = function (flag) {
        if (this._isPresenting !== flag) {
            this._isPresenting = flag;
            this.presentChangeEvent.raiseEvent(undefined);
        }
    };
    RealityViewer.getType = function (uri) {
        if (uri === undefined)
            return undefined;
        if (uri.split(':')[0] === 'reality') {
            return uri;
        }
        return 'hosted';
    };
    return RealityViewer;
}());
export { RealityViewer };
RealityViewer.DEFAULT = 'reality:default';
RealityViewer.EMPTY = 'reality:empty';
RealityViewer.LIVE = 'reality:live';
