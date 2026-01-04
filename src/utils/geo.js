/**
 * Geo Utilities Module
 * Geographic calculations for corridor filtering
 */

/**
 * Calculates haversine distance between two points in kilometers
 * @param {Object} point1 - {lat, lon}
 * @param {Object} point2 - {lat, lon}
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(point1, point2) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(point2.lat - point1.lat);
    const dLon = toRad(point2.lon - point1.lon);
    const lat1 = toRad(point1.lat);
    const lat2 = toRad(point2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Converts degrees to radians
 * @param {number} deg
 * @returns {number}
 */
function toRad(deg) {
    return deg * Math.PI / 180;
}

/**
 * Creates a bounding box around a route with buffer
 * @param {Array} routeAirports - Array of {lat, lon} objects
 * @param {number} bufferKm - Buffer distance in km
 * @returns {{minLat, maxLat, minLon, maxLon}}
 */
export function createBoundingBox(routeAirports, bufferKm = 100) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    for (const airport of routeAirports) {
        minLat = Math.min(minLat, airport.lat);
        maxLat = Math.max(maxLat, airport.lat);
        minLon = Math.min(minLon, airport.lon);
        maxLon = Math.max(maxLon, airport.lon);
    }

    // Approximate degree offset for buffer (1 degree ≈ 111km at equator)
    const latBuffer = bufferKm / 111;
    const lonBuffer = bufferKm / (111 * Math.cos(toRad((minLat + maxLat) / 2)));

    return {
        minLat: minLat - latBuffer,
        maxLat: maxLat + latBuffer,
        minLon: minLon - lonBuffer,
        maxLon: maxLon + lonBuffer
    };
}

/**
 * Checks if a point is within a bounding box
 * @param {Object} point - {lat, lon}
 * @param {Object} bounds - {minLat, maxLat, minLon, maxLon}
 * @returns {boolean}
 */
export function isWithinBoundingBox(point, bounds) {
    return point.lat >= bounds.minLat && point.lat <= bounds.maxLat &&
        point.lon >= bounds.minLon && point.lon <= bounds.maxLon;
}

/**
 * Finds the minimum distance from a point to a polyline path
 * @param {Object} point - {lat, lon}
 * @param {Array} pathPoints - Array of {lat, lon} objects
 * @returns {number} Minimum distance in km
 */
export function getDistanceFromPath(point, pathPoints) {
    let minDistance = Infinity;

    for (let i = 0; i < pathPoints.length - 1; i++) {
        const segmentStart = pathPoints[i];
        const segmentEnd = pathPoints[i + 1];
        const distance = pointToSegmentDistance(point, segmentStart, segmentEnd);
        minDistance = Math.min(minDistance, distance);
    }

    // Also check distance to endpoints
    for (const pathPoint of pathPoints) {
        const distance = haversineDistance(point, { lat: pathPoint.lat, lon: pathPoint.lon });
        minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
}

/**
 * Calculates perpendicular distance from point to line segment
 * Uses cross-track distance formula for great circle paths
 * @param {Object} point - {lat, lon}
 * @param {Object} start - {lat, lon}
 * @param {Object} end - {lat, lon}
 * @returns {number} Distance in km
 */
function pointToSegmentDistance(point, start, end) {
    const R = 6371; // Earth radius in km

    // Convert to radians
    const lat1 = toRad(start.lat);
    const lon1 = toRad(start.lon);
    const lat2 = toRad(end.lat);
    const lon2 = toRad(end.lon);
    const lat3 = toRad(point.lat);
    const lon3 = toRad(point.lon);

    // Angular distance from start to point
    const d13 = haversineDistance(start, point) / R;

    // Initial bearing from start to end
    const theta13 = bearing(start, point);
    const theta12 = bearing(start, end);

    // Cross-track distance
    const dxt = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12)) * R;

    // Along-track distance
    const dat = Math.acos(Math.cos(d13) / Math.cos(dxt / R)) * R;

    // Distance from start to end
    const d12 = haversineDistance(start, end);

    // If the perpendicular falls outside the segment, return distance to nearest endpoint
    if (dat < 0 || dat > d12) {
        return Math.min(
            haversineDistance(point, start),
            haversineDistance(point, end)
        );
    }

    return Math.abs(dxt);
}

/**
 * Calculates initial bearing between two points
 * @param {Object} start - {lat, lon}
 * @param {Object} end - {lat, lon}
 * @returns {number} Bearing in radians
 */
function bearing(start, end) {
    const lat1 = toRad(start.lat);
    const lat2 = toRad(end.lat);
    const dLon = toRad(end.lon - start.lon);

    const x = Math.sin(dLon) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return Math.atan2(x, y);
}

/**
 * Checks if a point falls within the corridor extent (between origin and destination)
 * Uses perpendicular cutoff planes at each endpoint
 * @param {Object} point - {lat, lon}
 * @param {Array} pathPoints - Array of {lat, lon} objects (route waypoints)
 * @returns {boolean} True if point is within the path extent
 */
export function isWithinPathExtent(point, pathPoints) {
    if (pathPoints.length < 2) return false;

    const origin = pathPoints[0];
    const destination = pathPoints[pathPoints.length - 1];

    // Calculate overall path bearing from origin to destination
    const pathBearing = bearing(origin, destination);

    // Check if point is "ahead" of origin (not behind it)
    const bearingToPointFromOrigin = bearing(origin, point);
    const angleDiffOrigin = Math.abs(normalizeAngle(bearingToPointFromOrigin - pathBearing));

    // If angle difference > 90 degrees, point is behind origin
    if (angleDiffOrigin > Math.PI / 2) return false;

    // Check if point is "behind" destination (not ahead of it)
    const reverseBearing = normalizeAngle(pathBearing + Math.PI);
    const bearingToPointFromDest = bearing(destination, point);
    const angleDiffDest = Math.abs(normalizeAngle(bearingToPointFromDest - reverseBearing));

    // If angle difference > 90 degrees, point is beyond destination
    if (angleDiffDest > Math.PI / 2) return false;

    return true;
}

/**
 * Normalizes an angle to be within [-PI, PI]
 * @param {number} angle - Angle in radians
 * @returns {number} Normalized angle
 */
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}
