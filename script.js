let map;
let airports = [];
let originAirport = null;
let destAirport = null;
let flightPath = null;
let markers = [];

// DOM Elements
const apiKeyInput = document.getElementById('api-key');
const setKeyBtn = document.getElementById('set-key-btn');
const apiKeySection = document.getElementById('api-key-section');
const searchSection = document.getElementById('search-section');

const originInput = document.getElementById('origin-input');
const destInput = document.getElementById('dest-input');
const originSuggestions = document.getElementById('origin-suggestions');
const destSuggestions = document.getElementById('dest-suggestions');
const trackBtn = document.getElementById('track-btn');

const flightInfoSection = document.getElementById('flight-info');
const routeOriginEl = document.getElementById('route-origin');
const routeDestEl = document.getElementById('route-dest');
const distanceInfoEl = document.getElementById('distance-info');

// Check for Environment Variable Key
const ENV_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

if (ENV_KEY) {
    console.log("Found API Key in environment variables.");
    loadGoogleMaps(ENV_KEY);
} else {
    // Show UI to enter key if not in .env
    apiKeySection.classList.remove('hidden');
    // Just in case we want to show it if env is missing (by default logic below is slightly different)
}


// Load Airports CSV
fetch('/airports.csv') // Vite serves root files at /
    .then(response => response.text())
    .then(csvText => {
        airports = parseCSV(csvText);
        console.log(`Loaded ${airports.length} airports.`);
    })
    .catch(err => console.error('Error loading airports:', err));

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];

    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCSVLine(line);

        // Columns based on standard airport-codes.csv:
        // 0: id, 1: ident, 2: type, 3: name, 4: latitude_deg, 5: longitude_deg...
        const type = cols[2];

        // Filter for meaningful airports to track flights
        if (type !== 'large_airport' && type !== 'medium_airport') continue;

        const iata = cols[13];
        if (!iata) continue;

        result.push({
            code: iata,
            name: cols[3],
            city: cols[10] || '',
            country: cols[8],
            lat: parseFloat(cols[4]),
            lon: parseFloat(cols[5])
        });
    }
    return result;
}

// Helper to parse a CSV line handling quotes
function parseCSVLine(text) {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(cur);
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur);
    return result;
}

// Event Listeners
setKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        loadGoogleMaps(key);
    }
});

trackBtn.addEventListener('click', trackFlight);

// Search Autocomplete Logic
setupAutocomplete(originInput, originSuggestions, (airport) => {
    originAirport = airport;
    console.log("Origin set to:", airport.code);
});

setupAutocomplete(destInput, destSuggestions, (airport) => {
    destAirport = airport;
    console.log("Destination set to:", airport.code);
});

function setupAutocomplete(input, suggestionBox, onSelect) {
    input.addEventListener('input', () => {
        const query = input.value.toLowerCase();
        suggestionBox.innerHTML = '';
        if (query.length < 2) {
            suggestionBox.classList.remove('active');
            return;
        }

        const matches = airports.filter(a =>
            a.code.toLowerCase().startsWith(query) ||
            (a.city && a.city.toLowerCase().includes(query)) ||
            a.name.toLowerCase().includes(query)
        ).slice(0, 10);

        if (matches.length > 0) {
            suggestionBox.classList.add('active');
            matches.forEach(airport => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<span class="highlight">${airport.code}</span> - ${airport.name} (${airport.city || 'N/A'}, ${airport.country})`;
                div.addEventListener('click', () => {
                    input.value = `${airport.code} - ${airport.city || airport.name}`;
                    suggestionBox.classList.remove('active');
                    onSelect(airport);
                });
                suggestionBox.appendChild(div);
            });
        } else {
            suggestionBox.classList.remove('active');
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
            suggestionBox.classList.remove('active');
        }
    });
}

function loadGoogleMaps(key) {
    if (window.google && window.google.maps) return;

    // Define initMap globally so the callback can find it
    window.initMap = function () {
        console.log("Initializing Map...");
        searchSection.classList.remove('disabled');

        map = new google.maps.Map(document.getElementById("map"), {
            center: { lat: 20, lng: 0 },
            zoom: 2,
            mapId: "DEMO_MAP_ID",
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            tilt: 45,
            disableDefaultUI: true,
            rotateControl: true,
            zoomControl: true,
        });
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap&v=beta&libraries=geometry`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    apiKeySection.classList.add('hidden');
}

function trackFlight() {
    if (!originAirport || !destAirport) {
        alert("Please select both an origin and a destination from the list.");
        return;
    }

    if (flightPath) flightPath.setMap(null);
    markers.forEach(m => m.setMap(null));
    markers = [];

    const origin = { lat: originAirport.lat, lng: originAirport.lon };
    const dest = { lat: destAirport.lat, lng: destAirport.lon };

    flightPath = new google.maps.Polyline({
        path: [origin, dest],
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map,
    });

    const originMarker = new google.maps.Marker({
        position: origin,
        map: map,
        title: originAirport.code,
        label: {
            text: originAirport.code,
            color: "white",
            fontWeight: "bold"
        }
    });

    const destMarker = new google.maps.Marker({
        position: dest,
        map: map,
        title: destAirport.code,
        label: {
            text: destAirport.code,
            color: "white",
            fontWeight: "bold"
        }
    });

    markers.push(originMarker, destMarker);

    const distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(origin),
        new google.maps.LatLng(dest)
    );
    const distanceKm = Math.round(distanceMeters / 1000);
    const distanceMiles = Math.round(distanceKm * 0.621371);

    flightInfoSection.classList.remove('hidden');
    routeOriginEl.textContent = originAirport.code;
    routeDestEl.textContent = destAirport.code;
    distanceInfoEl.textContent = `${distanceKm} km (${distanceMiles} miles)`;

    animateCamera(origin, dest);
}

function animateCamera(origin, dest) {
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(origin);
    bounds.extend(dest);
    map.fitBounds(bounds);
}
