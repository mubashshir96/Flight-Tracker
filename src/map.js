
let map;
let flightPath = null;
let markers = [];

/**
 * Loads the Google Maps API script.
 * @param {string} key API Key
 * @returns {Promise<void>} Resolves when map is ready
 */
export function loadGoogleMapsScript(key) {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve();
            return;
        }

        window.initFlightMap = function () {
            resolve();
        };

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=initFlightMap&v=beta&libraries=geometry`;
        script.async = true;
        script.defer = true;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Initializes the map in the given container.
 * @param {HTMLElement} container 
 */
export function initMap(container) {
    console.log("Initializing 3D Map...");
    map = new google.maps.Map(container, {
        center: { lat: 30, lng: -40 },
        zoom: 3,
        minZoom: 1.5, // Prevent zooming out too far
        mapId: "DEMO_MAP_ID",
        renderingType: "VECTOR",
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        backgroundColor: "#000000",
        isFractionalZoomEnabled: true,
        tilt: 0,
        disableDefaultUI: true,
        rotateControl: false,
        zoomControl: false,
        restriction: {
            latLngBounds: {
                north: 85,
                south: -85,
                west: -180,
                east: 180
            },
            strictBounds: true,
        },
    });

    // Custom Zoom Controls
    document.getElementById('zoom-in').addEventListener('click', () => {
        map.setZoom(map.getZoom() + 1);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        map.setZoom(map.getZoom() - 1);
    });
}

/**
 * Creates HTML content for InfoWindow labels matching the UI theme
 * @param {Object} airport - Airport object
 * @param {string} direction - 'bottom' | 'top' | 'left' | 'right' for notch position
 */
function createLabelContent(airport, direction = 'bottom') {
    // Notch styles based on direction (notch points toward the airport)
    const notchStyles = {
        bottom: `
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 16px;
            height: 10px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
            pointer-events: none;
        `,
        top: `
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 16px;
            height: 10px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
            pointer-events: none;
        `,
        left: `
            position: absolute;
            left: -8px;
            top: 50%;
            transform: translateY(-50%);
            width: 10px;
            height: 16px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            clip-path: polygon(0% 50%, 100% 0%, 100% 100%);
            pointer-events: none;
        `,
        right: `
            position: absolute;
            right: -8px;
            top: 50%;
            transform: translateY(-50%);
            width: 10px;
            height: 16px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            clip-path: polygon(100% 50%, 0% 0%, 0% 100%);
            pointer-events: none;
        `
    };

    const marginStyle = {
        bottom: 'margin-bottom: 8px;',
        top: 'margin-top: 8px;',
        left: 'margin-left: 8px;',
        right: 'margin-right: 8px;'
    };

    return `
        <div style="position: relative; ${marginStyle[direction]} pointer-events: none;" tabindex="-1">
            <!-- Pointer notch -->
            <div style="${notchStyles[direction]}"></div>
            <!-- Main content -->
            <div style="
                position: relative;
                background: rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border-radius: 8px;
                padding: 8px 12px;
                color: white;
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3);
                pointer-events: none;
            ">
                <strong>${airport.code}</strong> - ${airport.city || airport.name}
            </div>
        </div>
    `;
}

export function drawPath(routeAirports) {
    if (!map || routeAirports.length < 2) return;

    // Clear previous
    markers.forEach(m => m.setMap(null));
    markers = [];

    const bounds = new google.maps.LatLngBounds();
    let totalDistanceMeters = 0;

    // Iterate through segments
    for (let i = 0; i < routeAirports.length - 1; i++) {
        const originAirport = routeAirports[i];
        const destAirport = routeAirports[i + 1];

        const origin = { lat: originAirport.lat, lng: originAirport.lon };
        const dest = { lat: destAirport.lat, lng: destAirport.lon };

        bounds.extend(origin);
        bounds.extend(dest);

        // Draw Polyline (Shadow)
        const shadowPath = new google.maps.Polyline({
            path: [origin, dest],
            geodesic: true,
            strokeColor: "#000000",
            strokeOpacity: 0.4,
            strokeWeight: 6,
            map: map,
            zIndex: 1
        });
        markers.push(shadowPath);

        // Draw Polyline (Main)
        const flightPath = new google.maps.Polyline({
            path: [origin, dest],
            geodesic: true,
            strokeColor: "#FFFFFF",
            strokeOpacity: 0.9,
            strokeWeight: 3,
            map: map,
            zIndex: 2
        });
        markers.push(flightPath);

        // Add Markers/InfoWindows for each airport (avoid duplicates if already added)
        // Ideally we just add markers for all points in routeAirports once

        // Calculate segment distance
        totalDistanceMeters += google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(origin),
            new google.maps.LatLng(dest)
        );
    }

    // Calculate offsets for overlapping labels
    const labelOffsets = calculateLabelOffsets(routeAirports);

    // Add airport markers
    routeAirports.forEach((airport, index) => {
        const pos = { lat: airport.lat, lng: airport.lon };

        // 1. Draw the white dot marker
        const dotMarker = new google.maps.Marker({
            position: pos,
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5,
                fillColor: "#FFFFFF",
                fillOpacity: 1,
                strokeColor: "#000000",
                strokeWeight: 1
            },
            zIndex: 3 // Above lines
        });
        markers.push(dotMarker);

        // 2. Add the label InfoWindow with offset
        const offset = labelOffsets[index];
        const infoWindow = new google.maps.InfoWindow({
            content: createLabelContent(airport, offset.direction),
            position: pos,
            disableAutoPan: true,
            pixelOffset: new google.maps.Size(offset.x, offset.y)
        });
        infoWindow.open(map);
        markers.push({ setMap: () => infoWindow.close() });
    });

    animateCamera(bounds);

    return totalDistanceMeters;
}

/**
 * Calculate pixel offsets for labels to avoid overlapping
 */
function calculateLabelOffsets(airports) {
    const threshold = 0.8; // Degree threshold for "near"

    return airports.map((airport, i) => {
        // Find neighbors
        const neighbors = airports.filter((other, j) => {
            if (i === j) return false;
            const latDiff = Math.abs(airport.lat - other.lat);
            const lonDiff = Math.abs(airport.lon - other.lon);
            return latDiff < threshold && lonDiff < threshold;
        });

        if (neighbors.length === 0) {
            // No neighbors, default Up
            return { x: 0, y: -5, direction: 'bottom' };
        }

        // Calculate centroid of neighbors
        const avgLat = neighbors.reduce((sum, n) => sum + n.lat, 0) / neighbors.length;
        const avgLon = neighbors.reduce((sum, n) => sum + n.lon, 0) / neighbors.length;

        // Vector from centroid to this airport
        const dLat = airport.lat - avgLat;
        const dLon = airport.lon - avgLon;

        // Determine dominant direction
        // Neutral comparison to allow natural quadrant distribution
        if (Math.abs(dLat) > Math.abs(dLon)) {
            // Vertical separation dominant
            if (dLat > 0) {
                // North of neighbors -> Label Up
                return { x: 0, y: -5, direction: 'bottom' };
            } else {
                // South of neighbors -> Label Down
                return { x: 0, y: 60, direction: 'top' };
            }
        } else {
            // Horizontal separation dominant
            if (dLon > 0) {
                // East of neighbors -> Label Right
                // direction 'left' means notch is on the left of label -> label points to right
                return { x: 65, y: 27, direction: 'left' };
            } else {
                // West of neighbors -> Label Left
                // direction 'right' means notch is on the right of label -> label points to left
                return { x: -65, y: 27, direction: 'right' };
            }
        }
    });
}

function animateCamera(bounds) {
    // Capture START State
    const startState = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        tilt: map.getTilt(),
        heading: map.getHeading()
    };

    // Calculate rough diagonal of bounds for padding logic
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    // Calculate rough distance to determine padding
    let lngDiff = Math.abs(ne.lng() - sw.lng());
    if (lngDiff > 180) lngDiff = 360 - lngDiff;
    const latDiff = Math.abs(ne.lat() - sw.lat());
    const roughDistance = Math.sqrt(lngDiff * lngDiff + latDiff * latDiff);

    // Use larger padding to ensure zoom out
    const basePadding = 120;
    const leftPadding = 520;

    // Get target state from fitBounds by applying it and capturing result
    map.fitBounds(bounds, {
        top: basePadding,
        right: basePadding,
        bottom: basePadding,
        left: leftPadding
    });

    // Ensure minimum zoom level of 1.5 (allow zooming out more for global routes)
    if (map.getZoom() < 1.5) {
        map.setZoom(1.5);
    }

    // Capture the target state that fitBounds calculated
    const targetState = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        tilt: 0,
        heading: 0
    };

    // Reset back to start position for animation
    map.moveCamera({
        center: startState.center,
        zoom: startState.zoom,
        tilt: startState.tilt,
        heading: startState.heading
    });

    // Check magnitude of move
    const startLat = startState.center.lat();
    const startLng = startState.center.lng();
    const targetLat = targetState.center.lat();
    const targetLng = targetState.center.lng();

    let animLngDiff = Math.abs(targetLng - startLng);
    if (animLngDiff > 180) animLngDiff = 360 - animLngDiff;
    const animLatDiff = Math.abs(targetLat - startLat);
    const totalDiff = Math.sqrt(animLngDiff * animLngDiff + animLatDiff * animLatDiff);

    // Use longer duration for large moves (>60 degrees)
    const isLargeMove = totalDiff > 60;

    // Animate from START to TARGET
    const startTime = performance.now();
    const duration = isLargeMove ? 3000 : 2500;

    // Calculate the shortest path for longitude (handle wrap-around at ±180)
    let targetLngForAnim = targetState.center.lng();
    const startLngForAnim = startState.center.lng();
    let lngDiffForAnim = targetLngForAnim - startLngForAnim;

    if (lngDiffForAnim > 180) {
        targetLngForAnim -= 360;
    } else if (lngDiffForAnim < -180) {
        targetLngForAnim += 360;
    }

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Cubic Ease-Out
        const ease = 1 - Math.pow(1 - progress, 3);

        if (progress < 1) {
            const curLat = startState.center.lat() + (targetState.center.lat() - startState.center.lat()) * ease;
            const curLng = startLngForAnim + (targetLngForAnim - startLngForAnim) * ease;
            const curTilt = startState.tilt + (targetState.tilt - startState.tilt) * ease;
            const curHeading = startState.heading + (targetState.heading - startState.heading) * ease;

            // Simple smooth zoom interpolation for all moves
            const curZoom = startState.zoom + (targetState.zoom - startState.zoom) * ease;

            map.moveCamera({
                center: { lat: curLat, lng: curLng },
                zoom: curZoom,
                tilt: curTilt,
                heading: curHeading
            });

            requestAnimationFrame(animate);
        } else {
            map.moveCamera(targetState);
        }
    }

    requestAnimationFrame(animate);
}
