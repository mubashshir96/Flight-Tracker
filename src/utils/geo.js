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
        const start = pathPoints[i];
        const end = pathPoints[i + 1];

        // Per-segment cutoffs

        // 1. Origin Cutoff: If this is the FIRST segment, enforce "Start" boundary.
        // Landmarks cannot be "behind" the start point relative to the first leg's direction.
        if (i === 0) {
            const startBearing = bearing(start, end);
            const bearingToPoint = bearing(start, point);
            const diff = Math.abs(normalizeAngle(bearingToPoint - startBearing));
            // If > 90 degrees, point is behind start -> Skip this segment as a valid candidate
            if (diff > Math.PI / 2) continue;
        }

        // 2. Destination Cutoff: If this is the LAST segment, enforce "End" boundary.
        // Landmarks cannot be "beyond" the destination relative to the last leg's direction.
        if (i === pathPoints.length - 2) {
            const endBearing = bearing(start, end);
            const bearingToPoint = bearing(end, point);
            const diff = Math.abs(normalizeAngle(bearingToPoint - endBearing));
            // If < 90 degrees, point is ahead of end -> Skip this segment
            if (diff < Math.PI / 2) continue;
        }

        const distance = pointToSegmentDistance(point, start, end);
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

    // Distances to endpoints
    const distToStart = haversineDistance(start, point);
    const distToEnd = haversineDistance(end, point);
    const segmentLength = haversineDistance(start, end);

    if (segmentLength < 0.001) return distToStart;

    // 1. Check if point is "behind" Start
    // Angle between Vector(Start->End) and Vector(Start->Point)
    const bearingStartEnd = bearing(start, end);
    const bearingStartPoint = bearing(start, point);
    const angleStart = Math.abs(normalizeAngle(bearingStartPoint - bearingStartEnd));

    if (angleStart > Math.PI / 2) {
        return distToStart;
    }

    // 2. Check if point is "beyond" End
    // Angle between Vector(End->Start) and Vector(End->Point)
    const bearingEndStart = bearing(end, start);
    const bearingEndPoint = bearing(end, point);
    const angleEnd = Math.abs(normalizeAngle(bearingEndPoint - bearingEndStart));

    if (angleEnd > Math.PI / 2) {
        return distToEnd;
    }

    // 3. Fallback: Point projects onto segment -> Perpendicular distance
    // Cross-track distance formula
    const d13 = distToStart / R; // Angular distance Start->Point
    const theta13 = bearingStartPoint;
    const theta12 = bearingStartEnd;

    const sinCrossTrack = Math.sin(d13) * Math.sin(theta13 - theta12);
    // Clamp to valid range for asin to avoid NaN
    const clampedSin = Math.max(-1, Math.min(1, sinCrossTrack));
    const dxt = Math.asin(clampedSin) * R;

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
// isWithinPathExtent removed - logic integrated into getDistanceFromPath

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
