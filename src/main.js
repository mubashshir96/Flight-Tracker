
import { loadAirports } from './data.js';
import { loadGoogleMapsScript, initMap, drawPath } from './map.js';
import { setupAutocomplete, enableSearch, updateFlightInfo } from './ui.js';

// State
let airports = [];
let originAirport = null;
let destAirport = null;

// DOM
const originInput = document.getElementById('origin-input');
const destInput = document.getElementById('dest-input');
const originSuggestions = document.getElementById('origin-suggestions');
const destSuggestions = document.getElementById('dest-suggestions');
const trackBtn = document.getElementById('track-btn');

async function main() {
    // 1. Load Data
    airports = await loadAirports();
    console.log(`Loaded ${airports.length} airports.`);

    // 2. Setup UI
    setupAutocomplete(originInput, originSuggestions, airports, (selected) => {
        originAirport = selected;
        console.log("Origin set:", selected.code);
    });

    setupAutocomplete(destInput, destSuggestions, airports, (selected) => {
        destAirport = selected;
        console.log("Destination set:", selected.code);
    });

    // 3. Setup Map (API Key from environment)
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey) {
        console.log("Using API Key from environment.");
        await initializeMap(envKey);
    } else {
        console.error("No API Key found! Set VITE_GOOGLE_MAPS_API_KEY in .env");
        alert("No API Key found! Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.");
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
        alert("Failed to load Google Maps. Please check your API Key.");
    }
}

function handleTrackFlight() {
    if (!originAirport || !destAirport) {
        alert("Please select both an origin and a destination.");
        return;
    }

    console.log("Tracking:", originAirport.code, "->", destAirport.code);

    // Draw Path
    const distanceKm = drawPath(originAirport, destAirport);

    // Update UI
    if (distanceKm) {
        updateFlightInfo(originAirport.code, destAirport.code, distanceKm);
    }
}

// Start
main();
