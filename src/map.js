
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
        minZoom: 2, // Prevent zooming out too far
        mapId: "DEMO_MAP_ID",
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        tilt: 45,
        disableDefaultUI: true,
        rotateControl: true,
        zoomControl: true,
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
}

/**
 * Creates HTML content for InfoWindow labels matching the UI theme
 */
function createLabelContent(airport) {
    return `
        <div style="position: relative; margin-bottom: 8px; pointer-events: none;" tabindex="-1">
            <!-- Pointer notch (triangle) -->
            <div style="
                position: absolute;
                bottom: -8px;
                left: 50%;
                transform: translateX(-50%);
                width: 16px;
                height: 10px;
                background: rgba(255, 255, 255, 0.5);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
                pointer-events: none;
            "></div>
            <!-- Main content (on top) -->
            <div style="
                position: relative;
                background: rgba(255, 255, 255, 0.3);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border-radius: 8px;
                padding: 8px 12px;
                color: white;
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3);
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                pointer-events: none;
            ">
                <strong>${airport.code}</strong> - ${airport.city || airport.name}
            </div>
        </div>
    `;
}

export function drawPath(originAirport, destAirport) {
    if (!map) return;

    // Clear previous
    if (flightPath) flightPath.setMap(null);
    markers.forEach(m => m.setMap(null));
    markers = [];

    const origin = { lat: originAirport.lat, lng: originAirport.lon };
    const dest = { lat: destAirport.lat, lng: destAirport.lon };

    // Draw Polyline with shadow effect (two lines - shadow underneath, main on top)
    // Shadow line (darker, wider, offset slightly)
    const shadowPath = new google.maps.Polyline({
        path: [origin, dest],
        geodesic: true,
        strokeColor: "#000000",
        strokeOpacity: 0.4,
        strokeWeight: 6,
        map: map,
        zIndex: 1
    });

    // Main flight path (white at 90% opacity)
    flightPath = new google.maps.Polyline({
        path: [origin, dest],
        geodesic: true,
        strokeColor: "#FFFFFF",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        map: map,
        zIndex: 2
    });

    // Store shadow for cleanup
    markers.push(shadowPath);

    // Create InfoWindow-style labels (speech bubbles)
    const originInfoWindow = new google.maps.InfoWindow({
        content: createLabelContent(originAirport),
        position: origin,
        disableAutoPan: true
    });
    originInfoWindow.open(map);

    const destInfoWindow = new google.maps.InfoWindow({
        content: createLabelContent(destAirport),
        position: dest,
        disableAutoPan: true
    });
    destInfoWindow.open(map);

    // Store for cleanup (using markers array for simplicity)
    markers.push({ setMap: () => originInfoWindow.close() });
    markers.push({ setMap: () => destInfoWindow.close() });

    animateCamera(origin, dest);

    // Calculate distance
    const distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(origin),
        new google.maps.LatLng(dest)
    );
    return distanceMeters;
}

function animateCamera(origin, dest) {
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(origin);
    bounds.extend(dest);

    // Calculate rough distance to determine padding
    let lngDiff = Math.abs(dest.lng - origin.lng);
    if (lngDiff > 180) lngDiff = 360 - lngDiff;
    const latDiff = Math.abs(dest.lat - origin.lat);
    const roughDistance = Math.sqrt(lngDiff * lngDiff + latDiff * latDiff);

    // Use smaller padding for long-distance flights (zoom in more)
    const basePadding = roughDistance > 100 ? 40 : 80;
    const leftPadding = roughDistance > 100 ? 350 : 400;

    // Capture START State
    const startState = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        tilt: map.getTilt(),
        heading: map.getHeading()
    };

    // Get target state from fitBounds by applying it and capturing result
    map.fitBounds(bounds, {
        top: basePadding,
        right: basePadding,
        bottom: basePadding,
        left: leftPadding
    });

    // Ensure minimum zoom level of 2 (don't zoom out too far)
    if (map.getZoom() < 2) {
        map.setZoom(2);
    }

    // Capture the target state that fitBounds calculated
    const targetState = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        tilt: 0,
        heading: 0
    };

    // Check if the distance is too far - use different animation strategy
    const startLat = startState.center.lat();
    const startLng = startState.center.lng();
    const targetLat = targetState.center.lat();
    const targetLng = targetState.center.lng();

    // Calculate rough distance for animation strategy (in degrees)
    let animLngDiff = Math.abs(targetLng - startLng);
    if (animLngDiff > 180) animLngDiff = 360 - animLngDiff; // Handle wrap-around
    const animLatDiff = Math.abs(targetLat - startLat);
    const totalDiff = Math.sqrt(animLngDiff * animLngDiff + animLatDiff * animLatDiff);

    // Use longer duration for large moves (>60 degrees)
    const isLargeMove = totalDiff > 60;

    // Reset back to start position for animation
    map.moveCamera({
        center: startState.center,
        zoom: startState.zoom,
        tilt: startState.tilt,
        heading: startState.heading
    });

    // Animate from START to TARGET
    const startTime = performance.now();
    const duration = isLargeMove ? 3000 : 2500; // Longer duration for large moves

    // Calculate the shortest path for longitude (handle wrap-around at ±180)
    let targetLngForAnim = targetState.center.lng();
    const startLngForAnim = startState.center.lng();
    let lngDiffForAnim = targetLngForAnim - startLngForAnim;

    // If the difference is more than 180, go the other way
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
