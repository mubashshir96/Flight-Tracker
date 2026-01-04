
import { loadAirports } from './data.js';
import { loadLandmarks } from './data/landmarks.js';
import { loadGoogleMapsScript, initMap, drawPath, filterLandmarksInCorridor, renderLandmarks, clearLandmarkMarkers } from './map.js';
import { setupAutocomplete, enableSearch, updateFlightInfo, setupLayoverControls, getLayovers, showNotification, findBestMatch, setupDragItems, collapseStops, canAddMoreStops } from './ui.js';

// State
let airports = [];
let landmarks = [];

// DOM
const originInput = document.getElementById('origin-input');
const destInput = document.getElementById('dest-input');
const originSuggestions = document.getElementById('origin-suggestions');
const destSuggestions = document.getElementById('dest-suggestions');
const trackBtn = document.getElementById('track-btn');

// Clear state on input (prevents stale selection bug)
originInput.addEventListener('input', () => { delete originInput.dataset.airport; });
destInput.addEventListener('input', () => { delete destInput.dataset.airport; });

async function main() {
    // 1. Load Data
    airports = await loadAirports();
    console.log(`Loaded ${airports.length} airports.`);

    // Load landmarks (async, doesn't block UI)
    loadLandmarks().then(lm => {
        landmarks = lm;
        console.log(`Loaded ${landmarks.length} unique landmarks.`);
    });

    // 2. Setup UI
    setupAutocomplete(originInput, originSuggestions, airports, (selected) => {
        originInput.dataset.airport = JSON.stringify(selected);
        console.log("Origin set:", selected.code);
    });

    setupAutocomplete(destInput, destSuggestions, airports, (selected) => {
        destInput.dataset.airport = JSON.stringify(selected);
        console.log("Destination set:", selected.code);
    });

    // Setup Layover UI
    setupLayoverControls(airports, () => {
        // Optional: Auto-update if tracking is already active? 
        // For now, we wait for user to click Track
    });

    // Initialize DnD for initial items (Origin/Dest)
    setupDragItems();

    // 3. Setup Map (API Key from environment)
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey) {
        console.log("Using API Key from environment.");
        await initializeMap(envKey);
    } else {
        console.error("No API Key found! Set VITE_GOOGLE_MAPS_API_KEY in .env");
        showNotification("No API Key found! Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.", 'error');
    }

    trackBtn.addEventListener('click', handleTrackFlight);
}

async function initializeMap(key) {
    try {
        await loadGoogleMapsScript(key);
        initMap(document.getElementById('map'));
        enableSearch();
    } catch (err) {
        console.error("Failed to load Google Maps:", err);
        showNotification("Failed to load Google Maps. Please check your API Key.", 'error');
    }
}

function handleTrackFlight() {
    let originAirport = null;
    let destAirport = null;

    // Resolve Origin
    if (originInput.dataset.airport) {
        try {
            originAirport = JSON.parse(originInput.dataset.airport);
        } catch (e) { console.error(e); }
    } else if (originInput.value.trim().length > 0) {
        // Smart Match Origin
        const match = findBestMatch(originInput.value.trim(), airports);
        if (match) {
            originAirport = match;
            originInput.value = `${match.code} - ${match.city || match.name}`;
            originInput.dataset.airport = JSON.stringify(match);
            showNotification(`Auto-selected Origin: ${match.code}`, 'info');
        } else {
            showNotification(`Unknown Origin: '${originInput.value}'`, 'error');
            return;
        }
    }

    // Resolve Destination
    if (destInput.dataset.airport) {
        try {
            destAirport = JSON.parse(destInput.dataset.airport);
        } catch (e) { console.error(e); }
    } else if (destInput.value.trim().length > 0) {
        // Smart Match Destination
        const match = findBestMatch(destInput.value.trim(), airports);
        if (match) {
            destAirport = match;
            destInput.value = `${match.code} - ${match.city || match.name}`;
            destInput.dataset.airport = JSON.stringify(match);
            showNotification(`Auto-selected Destination: ${match.code}`, 'info');
        } else {
            showNotification(`Unknown Destination: '${destInput.value}'`, 'error');
            return;
        }
    }

    if (!originAirport || !destAirport) {
        showNotification("Please select both an origin and a destination.", 'error');
        return;
    }

    // Collect Layover Airports
    let layovers = [];
    try {
        layovers = getLayovers(airports);
    } catch (e) {
        showNotification(e.message, 'error');
        return;
    }

    // Construct full route array
    const routeAirports = [originAirport, ...layovers, destAirport];

    // Validation: Check for consecutive duplicates
    for (let i = 0; i < routeAirports.length - 1; i++) {
        if (routeAirports[i].code === routeAirports[i + 1].code) {
            showNotification(`Invalid Route: You cannot go from ${routeAirports[i].code} to ${routeAirports[i + 1].code} directly. Please adjust your layovers.`, 'error');
            return;
        }
    }

    // Blur any focused inputs to clean up UI state
    originInput.blur();
    destInput.blur();
    trackBtn.blur();

    console.log("Tracking Route:", routeAirports.map(a => a.code).join(' -> '));

    // Draw Path (handle multi-leg)
    const totalDistanceMeters = drawPath(routeAirports);

    // Update UI (pass full route and total distance)
    if (totalDistanceMeters !== undefined) {
        updateFlightInfo(routeAirports, totalDistanceMeters);
    }

    // Collapse stops to text-only view
    collapseStops();

    // Render landmarks along the flight corridor
    if (landmarks.length > 0) {
        const filteredLandmarks = filterLandmarksInCorridor(landmarks, routeAirports);
        renderLandmarks(filteredLandmarks);
    }
}

// Start
main();
