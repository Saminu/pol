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
import { Matrix4, Cartesian3, Quaternion, CesiumMath } from './cesium/cesium-imports';
/**
 * Default distance from a user's eyes to the floor
 */
export var AVERAGE_EYE_HEIGHT = 1.6;
/**
 * Default near plane
 */
export var DEFAULT_NEAR_PLANE = 0.01;
/**
 * Default far plane
 */
export var DEFAULT_FAR_PLANE = 10000;
/**
 * Describes the role of an [[ArgonSystem]]
 */
export var Role;
(function (Role) {
    /**
     * A system with this role is responsible for augmenting an arbitrary view of reality,
     * generally by overlaying computer generated graphics. A reality augmentor may also,
     * if appropriate, be elevated to the role of a [[REALITY_MANAGER]].
     */
    Role[Role["REALITY_AUGMENTER"] = "RealityAugmenter"] = "REALITY_AUGMENTER";
    /**
     * A system with this role is responsible for (at minimum) describing (and providing,
     * if necessary) a visual representation of the world and the 3D eye pose of the viewer.
     */
    Role[Role["REALITY_VIEWER"] = "RealityViewer"] = "REALITY_VIEWER";
    /**
     * A system with this role is responsible for mediating access to sensors/trackers
     * and pose data for known entities in the world, selecting/configuring/loading
     * [[REALITY_VIEWER]]s, and providing the mechanism by which any given [[REALITY_AUGMENTER]]
     * can augment any given [[REALITY_VIEWER]].
     */
    Role[Role["REALITY_MANAGER"] = "RealityManager"] = "REALITY_MANAGER";
    /**
     * Deprecated. Use [[REALITY_AUGMENTER]].
     * @private
     */
    Role[Role["APPLICATION"] = "Application"] = "APPLICATION";
    /**
     * Deprecated. Use [[REALITY_MANAGER]].
     * @private
     */
    Role[Role["MANAGER"] = "Manager"] = "MANAGER";
    /**
     * Deprecated. Use [[REALITY_VIEWER]]
     * @private
     */
    Role[Role["REALITY_VIEW"] = "RealityView"] = "REALITY_VIEW";
})(Role || (Role = {}));
(function (Role) {
    function isRealityViewer(r) {
        return r === Role.REALITY_VIEWER || r === Role.REALITY_VIEW;
    }
    Role.isRealityViewer = isRealityViewer;
    function isRealityAugmenter(r) {
        return r === Role.REALITY_AUGMENTER || r === Role.APPLICATION;
    }
    Role.isRealityAugmenter = isRealityAugmenter;
    function isRealityManager(r) {
        return r === Role.REALITY_MANAGER || r === Role.MANAGER;
    }
    Role.isRealityManager = isRealityManager;
})(Role || (Role = {}));
/**
 * Configuration options for an [[ArgonSystem]]
 */
var Configuration = (function () {
    function Configuration() {
    }
    return Configuration;
}());
export { Configuration };
var Viewport = (function () {
    function Viewport() {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
    }
    Viewport.clone = function (viewport, result) {
        if (result === void 0) { result = new Viewport; }
        if (!viewport)
            return undefined;
        result.x = viewport.x;
        result.y = viewport.y;
        result.width = viewport.width;
        result.height = viewport.height;
        return result;
    };
    Viewport.equals = function (viewportA, viewportB) {
        return viewportA && viewportB &&
            CesiumMath.equalsEpsilon(viewportA.x, viewportB.x, CesiumMath.EPSILON7) &&
            CesiumMath.equalsEpsilon(viewportA.y, viewportB.y, CesiumMath.EPSILON7) &&
            CesiumMath.equalsEpsilon(viewportA.width, viewportB.width, CesiumMath.EPSILON7) &&
            CesiumMath.equalsEpsilon(viewportA.height, viewportB.height, CesiumMath.EPSILON7);
    };
    return Viewport;
}());
export { Viewport };
/**
 * Viewport values are expressed using a right-handed coordinate system with the origin
 * at the bottom left corner.
 */
var CanvasViewport = (function (_super) {
    __extends(CanvasViewport, _super);
    function CanvasViewport() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.pixelRatio = 1;
        _this.renderWidthScaleFactor = 1;
        _this.renderHeightScaleFactor = 1;
        return _this;
    }
    CanvasViewport.clone = function (viewport, result) {
        if (result === void 0) { result = new CanvasViewport; }
        if (!viewport)
            return undefined;
        Viewport.clone(viewport, result);
        result.renderWidthScaleFactor = viewport.renderWidthScaleFactor;
        result.renderHeightScaleFactor = viewport.renderHeightScaleFactor;
        return result;
    };
    CanvasViewport.equals = function (viewportA, viewportB) {
        return viewportA && viewportB && Viewport.equals(viewportA, viewportB) &&
            CesiumMath.equalsEpsilon(viewportA.renderWidthScaleFactor, viewportB.renderWidthScaleFactor, CesiumMath.EPSILON7) &&
            CesiumMath.equalsEpsilon(viewportA.renderHeightScaleFactor, viewportB.renderHeightScaleFactor, CesiumMath.EPSILON7);
    };
    return CanvasViewport;
}(Viewport));
export { CanvasViewport };
/**
 * Identifies a subview in a [[SerializedSubview]]
 */
export var SubviewType;
(function (SubviewType) {
    /*
     * Identities a subview for a handheld display.
     */
    SubviewType[SubviewType["SINGULAR"] = "Singular"] = "SINGULAR";
    /*
     * Identifies a subview for the left eye (when the user is wearing an HMD or Viewer)
     */
    SubviewType[SubviewType["LEFTEYE"] = "LeftEye"] = "LEFTEYE";
    /*
     * Identifies a subview for the right eye (when the user is wearing an HMD or Viewer)
     */
    SubviewType[SubviewType["RIGHTEYE"] = "RightEye"] = "RIGHTEYE";
    /*
     * Identifies a subview for a custom view configuration
     */
    SubviewType[SubviewType["OTHER"] = "Other"] = "OTHER";
})(SubviewType || (SubviewType = {}));
export var SerializedEntityState;
(function (SerializedEntityState) {
    function clone(state, result) {
        if (!state)
            return null;
        result = result || {};
        result.p = Cartesian3.clone(state.p, result.p);
        result.o = Quaternion.clone(state.o, result.o);
        result.r = state.r;
        result.meta = state.meta;
        return result;
    }
    SerializedEntityState.clone = clone;
})(SerializedEntityState || (SerializedEntityState = {}));
export var SerializedSubview;
(function (SerializedSubview) {
    function clone(subview, result) {
        result = result || {};
        result.type = subview.type;
        result.projectionMatrix = Matrix4.clone(subview.projectionMatrix, result.projectionMatrix);
        result.viewport = Viewport.clone(subview.viewport, result.viewport);
        // result.pose = subview.pose ? SerializedEntityState.clone(subview.pose, result.pose) : undefined;
        return result;
    }
    SerializedSubview.clone = clone;
    function equals(left, right) {
        return left && right &&
            left.type === right.type &&
            Viewport.equals(left.viewport, right.viewport) &&
            Matrix4.equals(left.projectionMatrix, right.projectionMatrix);
    }
    SerializedSubview.equals = equals;
})(SerializedSubview || (SerializedSubview = {}));
// export interface PhysicalViewState {
//     time: JulianDate,
//     stagePose: SerializedEntityPose|undefined,
//     stageHorizontalAccuracy: number|undefined,
//     stageVerticalAccuracy: number|undefined,
//     eyePose: SerializedEntityPose|undefined,
//     eyeCompassAccuracy: number|undefined,
//     subviews: SerializedSubviewList,
//     strict:boolean;
// }
// export interface ViewState {
//     /**
//      * The viewing pose.
//      */
//     pose: SerializedEntityState|undefined,
//     /**
//      * The viewport to render into. In a DOM environment, 
//      * the bottom left corner of the document element (document.documentElement) 
//      * is the origin. 
//      */
//     viewport: Viewport,
//     /**
//      * The list of subviews to render.
//      */
//     subviews:SerializedSubviewList,
//     /**
//      * The current field of view (of each subview)
//      */
//     fovs: number[]
// }
var SerializedSubviewList = (function (_super) {
    __extends(SerializedSubviewList, _super);
    function SerializedSubviewList() {
        return _super.call(this) || this;
    }
    SerializedSubviewList.clone = function (subviews, result) {
        if (!subviews)
            return undefined;
        result = result || new SerializedSubviewList;
        result.length = subviews.length;
        for (var i = 0; i < subviews.length; i++) {
            var s = subviews[i];
            result[i] = SerializedSubview.clone(s, result[i]);
        }
        return result;
    };
    return SerializedSubviewList;
}(Array));
export { SerializedSubviewList };
