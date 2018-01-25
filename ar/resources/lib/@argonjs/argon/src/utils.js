import { defined, PerspectiveOffCenterFrustum, ConstantPositionProperty, OrientationProperty, ConstantProperty, Quaternion, Cartesian3, Matrix4, Transforms, sampleTerrain } from './cesium/cesium-imports';
import { MapzenTerrariumTerrainProvider } from './cesium/MapzenTerrariumTerrainProvider';
export * from './utils/command-queue';
export * from './utils/event';
export * from './utils/message-channel';
export { default as getEventSynthesizier } from './utils/ui-event-synthesizer';
export { default as createEventForwarder } from './utils/ui-event-forwarder';
var reNative = /\{\s*\[native code\]\s*\}/;
export function isNativeFunction(f) {
    return typeof f === 'function' && reNative.test(Function.prototype.toString.call(f));
}
export var hasNativeWebVRImplementation = typeof navigator !== 'undefined' &&
    isNativeFunction(navigator.getVRDisplays) &&
    !Object.getOwnPropertyDescriptor(navigator, "getVRDisplays");
export var suggestedWebGLContextAntialiasAttribute = hasNativeWebVRImplementation;
export function stringIdentifierFromReferenceFrame(referenceFrame) {
    var rf = referenceFrame;
    return defined(rf.id) ? rf.id : '' + rf;
}
export function jsonEquals(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
/**
 * Computes a 4x4 transformation matrix from a reference frame with an east-up-south axes centered at the provided origin to the provided ellipsoid's fixed reference frame. The local axes are defined as:
 * The x axis points in the local east direction.
 * The y axis points in the points in the direction of the ellipsoid surface normal which passes through the position..
 * The z axis points in the local south direction.
 */
export var eastUpSouthToFixedFrame = Transforms.localFrameToFixedFrameGenerator('east', 'up');
/**
 * Get array of ancestor reference frames of a Cesium Entity, ordered from
 * farthest ancestor to the passed frame, excluding the passed frame.
 * @param frame A Cesium Entity to get ancestor reference frames.
 * @param frames An array of reference frames of the Cesium Entity.
 */
export function getAncestorReferenceFrames(frame, result) {
    if (result === void 0) { result = []; }
    var frames = result;
    frames.length = 0;
    var f = frame;
    do {
        var position = f.position;
        f = position && position.referenceFrame;
        if (defined(f))
            frames.unshift(f);
    } while (defined(f));
    return frames;
}
var scratchAncestorCartesian = new Cartesian3;
var scratchAncestorQuaternion = new Quaternion;
/**
 * Get array of ancestor reference frames of a Cesium Entity, ordered from
 * farthest ancestor which has a valid pose to the passed frame, excluding the passed frame.
 * @param frame A Cesium Entity to get ancestor reference frames.
 * @param frames An array of reference frames of the Cesium Entity.
 */
export function getReachableAncestorReferenceFrames(frame, time, result) {
    if (result === void 0) { result = []; }
    var frames = result;
    frames.length = 0;
    var f = frame;
    var isValid = false;
    do {
        var position = f.position;
        var orientation_1 = f && f.orientation;
        f = position && position.referenceFrame;
        var hasParentFrame = defined(f);
        var pValue = hasParentFrame && position && position.getValueInReferenceFrame(time, f, scratchAncestorCartesian);
        var oValue = hasParentFrame && pValue && orientation_1 && orientation_1.getValue(time, scratchAncestorQuaternion);
        isValid = pValue && oValue;
        if (isValid)
            frames.unshift(f);
    } while (isValid);
    return frames;
}
/**
 * Gets the value of the Position property at the provided time and in the provided reference frame.
 * @param entity The entity to get position.
 * @param time The time for which to retrieve the value.
 * @param referenceFrame The desired referenceFrame of the result.
 * @param result The object to store the value into.
 * @return The modified result parameter.
 */
export function getEntityPositionInReferenceFrame(entity, time, referenceFrame, result) {
    return entity.position && entity.position.getValueInReferenceFrame(time, referenceFrame, result);
}
/**
 * Alias of getEntityPositionInReferenceFrame
 */
export var getEntityPosition = getEntityPositionInReferenceFrame;
/**
 * Get the value of the Orientation property at the provided time and in the provided reference frame.
 * @param entity The entity to get position.
 * @param time The time for which to retrieve the value.
 * @param referenceFrame The desired referenceFrame of the result.
 * @param result The object to store the value into.
 * @return The modified result parameter.
 */
export function getEntityOrientationInReferenceFrame(entity, time, referenceFrame, result) {
    var entityFrame = entity.position && entity.position.referenceFrame;
    if (!defined(entityFrame))
        return undefined;
    var orientation = entity.orientation && entity.orientation.getValue(time, result);
    if (!defined(orientation))
        return undefined;
    return OrientationProperty.convertToReferenceFrame(time, orientation, entityFrame, referenceFrame, result);
}
/**
 * Alias of getEntityOrientationInReferenceFrame
 */
export var getEntityOrientation = getEntityOrientationInReferenceFrame;
// const scratchCartesianPositionFIXED = new Cartesian3
// const scratchMatrix4 = new Matrix4
// const scratchMatrix3 = new Matrix3
//  {
//         // if no orientation is available, calculate an orientation based on position
//         const entityPositionFIXED = getEntityPositionInReferenceFrame(entity, time, ReferenceFrame.FIXED, scratchCartesianPositionFIXED)
//         if (!entityPositionFIXED) return Quaternion.clone(Quaternion.IDENTITY, result)
//         if (Cartesian3.ZERO.equals(entityPositionFIXED)) throw new Error('invalid cartographic position')
//         const transform = Transforms.eastNorthUpToFixedFrame(entityPositionFIXED, Ellipsoid.WGS84, scratchMatrix4);
//         const rotation = Matrix4.getRotation(transform, scratchMatrix3);
//         const fixedOrientation = Quaternion.fromRotationMatrix(rotation, result);
//         return OrientationProperty.convertToReferenceFrame(time, fixedOrientation, ReferenceFrame.FIXED, referenceFrame, result)
//     }
var _scratchFramesArray = [];
var _entityStateCache = {};
/**
 * Create a SerializedEntityPose from a source entity.
 * @param entity The entity which the serialized pose represents.
 * @param time The time which to retrieve the pose.
 * @param referenceFrame The reference frame to use for generating the pose.
 * If a target reference frame is not provided, the entity pose will be
 * serialized according to the furthest ancestor frame that resolves to a valid pose.
 * @return An EntityPose object with orientation, position and referenceFrame.
 */
export function getSerializedEntityState(entity, time, frame) {
    var frames = undefined;
    if (!defined(frame)) {
        frames = getReachableAncestorReferenceFrames(entity, time, _scratchFramesArray);
        frame = frames[0];
    }
    if (!defined(frame))
        return null;
    if (entity === frame)
        return null;
    var key = entity.id + '@' + (frame.id ? frame.id : frame);
    var result = _entityStateCache[key];
    if (!result)
        result = {}, _entityStateCache[key] = result;
    var p = getEntityPositionInReferenceFrame(entity, time, frame, result.p || {});
    if (!p)
        return null;
    var o = getEntityOrientationInReferenceFrame(entity, time, frame, result.o || {});
    if (!o)
        return null;
    if (p && o) {
        result.p = p;
        result.o = o;
        result.r = typeof frame === 'number' ? frame : frame.id,
            result.meta = entity['meta'];
        return result;
    }
    return null;
}
var urlParser = typeof document !== 'undefined' ? document.createElement("a") : undefined;
/**
 * If urlParser does not have a value, throw error message "resolveURL requires DOM api".
 * If inURL is undefined, throw error message "expected inURL".
 * Otherwise, assign value of inURL to urlParser.href.
 * @param inURL A URL needed to be resolved.
 * @returns A URL ready to be parsed.
 */
export function resolveURL(inURL) {
    if (!urlParser)
        throw new Error("resolveURL requires DOM api");
    if (inURL === undefined)
        throw new Error('Expected inURL');
    urlParser.href = '';
    urlParser.href = inURL;
    return urlParser.href;
}
/**
 * Parse URL to an object describing details of the URL with href, protocol,
 * hostname, port, pathname, search, hash, host.
 * @param inURL A URL needed to be parsed.
 * @return An object showing parsed URL with href, protocol,
 * hostname, port, pathname, search, hash, host.
 */
export function parseURL(inURL) {
    if (!urlParser)
        throw new Error("parseURL requires DOM api");
    if (inURL === undefined)
        throw new Error('Expected inURL');
    urlParser.href = '';
    urlParser.href = inURL;
    return {
        href: urlParser.href,
        protocol: urlParser.protocol,
        hostname: urlParser.hostname,
        port: urlParser.port,
        pathname: urlParser.pathname,
        search: urlParser.search,
        hash: urlParser.hash,
        host: urlParser.host
    };
}
export function resolveElement(elementOrSelector) {
    if (elementOrSelector instanceof HTMLElement) {
        return Promise.resolve(elementOrSelector);
    }
    else {
        return new Promise(function (resolve, reject) {
            var resolveElement = function () {
                var e = document.querySelector("" + elementOrSelector);
                if (!e)
                    reject(new Error("Unable to resolve element id " + elementOrSelector));
                else
                    resolve(e);
            };
            if (document.readyState == 'loading') {
                document.addEventListener('DOMContentLoaded', resolveElement);
            }
            else {
                resolveElement();
            }
        });
    }
}
export function decomposePerspectiveOffCenterProjectionMatrix(mat, result) {
    var m11 = mat[Matrix4.COLUMN0ROW0];
    // const m12 = mat[Matrix4.COLUMN0ROW1];
    var m22 = mat[Matrix4.COLUMN1ROW1];
    var m31 = mat[Matrix4.COLUMN2ROW0];
    var m32 = mat[Matrix4.COLUMN2ROW1];
    var m33 = mat[Matrix4.COLUMN2ROW2];
    var m43 = mat[Matrix4.COLUMN3ROW2];
    var near = result.near = m43 / (m33 - 1);
    result.far = m43 / (m33 + 1);
    result.bottom = near * (m32 - 1) / m22;
    result.top = near * (m32 + 1) / m22;
    result.left = near * (m31 - 1) / m11;
    result.right = near * (m31 + 1) / m11;
    return result;
}
var scratchPerspectiveOffCenterFrustum = new PerspectiveOffCenterFrustum;
export function decomposePerspectiveProjectionMatrix(mat, result) {
    var f = decomposePerspectiveOffCenterProjectionMatrix(mat, scratchPerspectiveOffCenterFrustum);
    var xOffset = (f.left + f.right) / 2;
    var yOffset = (f.top + f.bottom) / 2;
    var near = f.near;
    var far = f.far;
    // const left = f.left - xOffset;
    var right = f.right - xOffset;
    var top = f.top - yOffset;
    // const bottom = f.bottom - yOffset;
    var aspectRatio = right / top;
    var fovy = 2 * Math.atan(top / near);
    var fov;
    if (aspectRatio < 1) {
        fov = fovy;
    }
    else {
        fov = Math.atan(Math.tan(fovy * 0.5) * aspectRatio) * 2.0;
    }
    result.near = near;
    result.far = far;
    result.fov = fov;
    result.aspectRatio = aspectRatio;
    result.xOffset = xOffset;
    result.yOffset = yOffset;
    return result;
}
var scratchCartesian = new Cartesian3;
var scratchOrientation = new Quaternion;
/**
 * Convert an Entity's position and orientation properties to a new reference frame.
 * The properties must be constant properties.
 * @param entity The entity to convert.
 * @param time The time which to retrieve the pose up the reference chain.
 * @param referenceFrame The reference frame to convert the position and oriention to.
 * @return a boolean indicating success or failure.  Will be false if either property is
 * not constant, or if either property cannot be converted to the new frame.
 */
export function convertEntityReferenceFrame(entity, time, frame) {
    if (!entity.position || !(entity.position instanceof ConstantPositionProperty) ||
        !entity.orientation || !(entity.orientation instanceof ConstantProperty)) {
        return false;
    }
    if (!getEntityPositionInReferenceFrame(entity, time, frame, scratchCartesian)) {
        return false;
    }
    if (!getEntityOrientationInReferenceFrame(entity, time, frame, scratchOrientation)) {
        return false;
    }
    entity.position.setValue(scratchCartesian, frame);
    entity.orientation.setValue(scratchOrientation);
    return true;
}
export var isIOS = typeof navigator !== 'undefined' && typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window['MSStream'];
export var isAndroid = typeof navigator !== 'undefined' && typeof window !== 'undefined' &&
    /Android/.test(navigator.userAgent) && !window['MSStream'];
export function installArgonApp() {
    if (isIOS) {
        window.location.href = "https://itunes.apple.com/us/app/argon4/id1089308600?mt=8";
    }
    else if (isAndroid) {
        window.location.href = "http://play.google.com/store/apps/details?id=edu.gatech.argon4";
    }
}
export function openInArgonApp() {
    if (isIOS) {
        window.location.href = "argon4://open?url=" + encodeURIComponent(window.location.href);
    }
    else if (isAndroid) {
        window.location.href = "intent:/#Intent;scheme=argon4;package=edu.gatech.argon4;S.url=" + encodeURIComponent(window.location.href) + ";end";
    }
}
// requestAnimationFrame / cancelAnimationFrame polyfills
var lastTime = 0;
var rAF = (typeof window !== 'undefined' && window.requestAnimationFrame) ?
    window.requestAnimationFrame.bind(window) : function (callback) {
    var currTime = performance.now();
    var timeToCall = Math.max(0, 16 - (currTime - lastTime));
    var id = setTimeout(function () { callback(currTime + timeToCall); }, timeToCall);
    lastTime = currTime + timeToCall;
    return id;
};
var cAF = (typeof window !== 'undefined') ?
    window.cancelAnimationFrame.bind(window) : clearTimeout;
export { rAF as requestAnimationFrame, cAF as cancelAnimationFrame };
export function deprecated(alternative) {
    var didPrintWarning = false;
    var decorator = function (target, name, descriptor) {
        var original = descriptor.get || descriptor.value;
        var originalType = typeof descriptor.value === 'function' ? 'function' : 'property';
        var message = "The \"" + name + "\" " + originalType + " is deprecated. ";
        if (alternative) {
            var alternativeType = typeof target[alternative] === 'function' ? 'function' : 'property';
            message += "Please use the \"" + alternative + "\" " + alternativeType + " instead.";
        }
        var wrapped = function () {
            if (!didPrintWarning) {
                console.warn(message);
                didPrintWarning = true;
            }
            return original.apply(this, arguments);
        };
        if (descriptor.value)
            descriptor.value = wrapped;
        else
            descriptor.get = wrapped;
        return descriptor;
    };
    return decorator;
}
export var defaultTerrainProvider = new MapzenTerrariumTerrainProvider({
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/',
    requestWaterMask: true,
    requestVertexNormals: true
});
export function updateHeightFromTerrain(cartographic) {
    return Promise.resolve(sampleTerrain(defaultTerrainProvider, 15, [cartographic]).then(_valueAtFirstIndex));
}
function _valueAtFirstIndex(array) {
    return array[0];
}
