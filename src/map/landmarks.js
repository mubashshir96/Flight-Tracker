/**
 * Landmark Map Module
 * Renders landmarks on map with tier-based visibility
 */

import { getMap } from './core.js';
import { TIER_RADIUS_KM } from '../data/landmarks.js';
import { createBoundingBox, isWithinBoundingBox, getDistanceFromPath, isWithinPathExtent } from '../utils/geo.js';

// Track all landmark markers for cleanup
let landmarkMarkers = [];
let landmarkInfoWindows = [];
let currentOpenInfoWindow = null;
let closeTimeout = null;

// Zoom level thresholds for tier visibility
// All tiers now visible from zoom 2+ (user preference)
const ZOOM_THRESHOLDS = {
    TIER_1_MIN: 2,    // Always visible from zoom 2+
    TIER_2_MIN: 2,    // Now always visible
    TIER_3_MIN: 2     // Now always visible
};

// Marker styles by tier - bright colors for satellite visibility
const TIER_STYLES = {
    1: {
        scale: 8,
        fillColor: '#FFD700',  // Gold for global icons
        strokeColor: '#000000',
        strokeWeight: 2,
        zIndex: 100
    },
    2: {
        scale: 7,
        fillColor: '#00BFFF',  // Bright cyan for national (more visible)
        strokeColor: '#000000',
        strokeWeight: 2,
        zIndex: 50
    },
    3: {
        scale: 6,
        fillColor: '#FF69B4',  // Hot pink for local (stands out on green/brown terrain)
        strokeColor: '#000000',
        strokeWeight: 1.5,
        zIndex: 25
    }
};

/**
 * Filters landmarks within the flight corridor
 * @param {Array} landmarks - All landmarks
 * @param {Array} routeAirports - Route airports with {lat, lon}
 * @returns {Array} Filtered landmarks within corridor
 */
export function filterLandmarksInCorridor(landmarks, routeAirports) {
    if (!landmarks.length || !routeAirports.length) return [];

    // Phase 1: Bounding box pre-filter with generous buffer
    const maxRadiusKm = Math.max(...Object.values(TIER_RADIUS_KM));
    const bounds = createBoundingBox(routeAirports, maxRadiusKm + 50);

    const preFiltered = landmarks.filter(lm =>
        isWithinBoundingBox({ lat: lm.lat, lon: lm.lon }, bounds)
    );

    console.log(`Bounding box pre-filter: ${preFiltered.length}/${landmarks.length} landmarks`);

    // Phase 2: Corridor distance check with tier-specific radius
    const pathPoints = routeAirports.map(a => ({ lat: a.lat, lon: a.lon }));

    const filtered = preFiltered.filter(lm => {
        const point = { lat: lm.lat, lon: lm.lon };

        // Check if landmark is within path extent (not beyond endpoints)
        if (!isWithinPathExtent(point, pathPoints)) return false;

        // Check distance from path
        const distanceKm = getDistanceFromPath(point, pathPoints);
        const tierRadiusKm = TIER_RADIUS_KM[lm.tier];
        return distanceKm <= tierRadiusKm;
    });

    console.log(`Corridor filter: ${filtered.length} landmarks within detection radius`);
    return filtered;
}

/**
 * Renders landmarks on the map
 * @param {Array} landmarks - Filtered landmarks to render
 */
export function renderLandmarks(landmarks) {
    const map = getMap();
    if (!map) return;

    // Clear previous markers
    clearLandmarkMarkers();

    // Create markers for each landmark
    landmarks.forEach(landmark => {
        const style = TIER_STYLES[landmark.tier];
        const pos = { lat: landmark.lat, lng: landmark.lon };

        // Create marker
        const marker = new google.maps.Marker({
            position: pos,
            map: null, // Start hidden, visibility controlled by zoom
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: style.scale,
                fillColor: style.fillColor,
                fillOpacity: 0.9,
                strokeColor: style.strokeColor,
                strokeWeight: style.strokeWeight
            },
            zIndex: style.zIndex,
            title: landmark.name
        });

        // Create info window with landmark details
        const infoWindow = createLandmarkInfoWindow(landmark);

        // Add hover events
        marker.addListener('mouseover', () => {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
            }

            if (currentOpenInfoWindow) {
                currentOpenInfoWindow.close();
            }
            infoWindow.open(map, marker);
            currentOpenInfoWindow = infoWindow;
        });

        marker.addListener('mouseout', () => {
            closeTimeout = setTimeout(() => {
                if (currentOpenInfoWindow === infoWindow) {
                    infoWindow.close();
                    currentOpenInfoWindow = null;
                }
            }, 500); // 500ms delay to allow moving to popup
        });

        // Add domready listener to attach events to the popup content
        infoWindow.addListener('domready', () => {
            // Find the popup element using the class name
            const popup = document.querySelector('.landmark-popup'); // This selector might match others, but since only one is open it usually works. 
            // Better to match within the specific infoWindow context if possible, but IW structure is obscure.
            // Since we close others, document.querySelector is generally safe for the one recently opened.

            if (popup) {
                popup.addEventListener('mouseenter', () => {
                    if (closeTimeout) {
                        clearTimeout(closeTimeout);
                        closeTimeout = null;
                    }
                });

                popup.addEventListener('mouseleave', () => {
                    closeTimeout = setTimeout(() => {
                        infoWindow.close();
                        currentOpenInfoWindow = null;
                    }, 500);
                });
            }
        });

        // Store for cleanup and visibility control
        landmarkMarkers.push({ marker, tier: landmark.tier });
        landmarkInfoWindows.push(infoWindow);
    });

    // Setup zoom-based visibility
    setupZoomVisibility(map);

    // Initial visibility update
    updateMarkerVisibility(map.getZoom());
}

/**
 * Creates an info window for a landmark with image and Wikipedia link
 * @param {Object} landmark
 * @returns {google.maps.InfoWindow}
 */
function createLandmarkInfoWindow(landmark) {
    const imageHtml = landmark.imageUrl
        ? `<img src="${landmark.imageUrl}" alt="${landmark.name}" class="landmark-popup-image" onerror="this.style.display='none'">`
        : '';

    // Description section
    const descriptionHtml = landmark.description
        ? `<p class="landmark-popup-description">${landmark.description}</p>`
        : '';

    // Link section - Wikipedia if available, otherwise Google search
    let linkHtml;
    if (landmark.wikiUrl && landmark.wikiUrl.trim() !== '') {
        linkHtml = `<a href="${landmark.wikiUrl}" target="_blank" rel="noopener noreferrer" class="landmark-popup-link">
            View on Wikipedia →
        </a>`;
    } else {
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(landmark.name)}`;
        linkHtml = `<span class="landmark-popup-no-wiki">No Wikipedia article available</span>
        <a href="${googleSearchUrl}" target="_blank" rel="noopener noreferrer" class="landmark-popup-link landmark-popup-search">
            Search on Google →
        </a>`;
    }

    const content = `
        <div class="landmark-popup">
            ${imageHtml}
            <div class="landmark-popup-content">
                <h3 class="landmark-popup-title">${landmark.name}</h3>
                ${descriptionHtml}
                <div class="landmark-popup-meta">
                    <span class="landmark-tier tier-${landmark.tier}">
                        ${getTierLabel(landmark.tier)}
                    </span>
                </div>
                ${linkHtml}
            </div>
        </div>
    `;

    return new google.maps.InfoWindow({
        content,
        disableAutoPan: true,
        maxWidth: 320
    });
}


/**
 * Gets human-readable tier label
 * @param {number} tier
 * @returns {string}
 */
function getTierLabel(tier) {
    switch (tier) {
        case 1: return 'Global Icon';
        case 2: return 'National Landmark';
        case 3: return 'Local Interest';
        default: return 'Landmark';
    }
}

/**
 * Sets up zoom change listener for tier visibility
 * @param {google.maps.Map} map
 */
function setupZoomVisibility(map) {
    map.addListener('zoom_changed', () => {
        updateMarkerVisibility(map.getZoom());
    });
}

/**
 * Updates marker visibility based on current zoom level
 * @param {number} zoom
 */
function updateMarkerVisibility(zoom) {
    landmarkMarkers.forEach(({ marker, tier }) => {
        let visible = false;

        switch (tier) {
            case 1:
                visible = zoom >= ZOOM_THRESHOLDS.TIER_1_MIN;
                break;
            case 2:
                visible = zoom >= ZOOM_THRESHOLDS.TIER_2_MIN;
                break;
            case 3:
                visible = zoom >= ZOOM_THRESHOLDS.TIER_3_MIN;
                break;
        }

        marker.setMap(visible ? getMap() : null);
    });
}

/**
 * Clears all landmark markers from the map
 */
export function clearLandmarkMarkers() {
    landmarkMarkers.forEach(({ marker }) => marker.setMap(null));
    landmarkMarkers = [];

    landmarkInfoWindows.forEach(iw => iw.close());
    landmarkInfoWindows = [];

    currentOpenInfoWindow = null;
}
