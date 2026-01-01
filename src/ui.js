
// UI Elements
const searchSection = document.getElementById('search-section');

const flightInfoSection = document.getElementById('flight-info');
const routeOriginEl = document.getElementById('route-origin');
const routeDestEl = document.getElementById('route-dest');
const distanceInfoEl = document.getElementById('distance-info');

export function enableSearch() {
    searchSection.classList.remove('disabled');
}

export function setupAutocomplete(input, suggestionBox, airports, onSelect) {
    if (!input || !suggestionBox) return;

    // Store current matches and highlighted index
    let currentMatches = [];
    let highlightedIndex = -1;

    function selectAirport(airport) {
        input.value = `${airport.code} - ${airport.city || airport.name}`;
        suggestionBox.classList.remove('active');
        highlightedIndex = -1;
        onSelect(airport);
    }

    function updateHighlight() {
        const items = suggestionBox.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === highlightedIndex) {
                item.classList.add('highlighted');
                // Scroll into view if needed
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
    }

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase();
        suggestionBox.innerHTML = '';
        currentMatches = [];
        highlightedIndex = -1;

        if (query.length < 2) {
            suggestionBox.classList.remove('active');
            return;
        }

        let matches = airports.filter(a =>
            a.code.toLowerCase().startsWith(query) ||
            (a.city && a.city.toLowerCase().includes(query)) ||
            a.name.toLowerCase().includes(query)
        );

        // Sort matches to prioritize IATA codes
        matches.sort((a, b) => {
            const codeA = a.code.toLowerCase();
            const codeB = b.code.toLowerCase();

            // Exact code match gets highest priority
            if (codeA === query && codeB !== query) return -1;
            if (codeB === query && codeA !== query) return 1;

            // Starts with code gets second priority
            const startsA = codeA.startsWith(query);
            const startsB = codeB.startsWith(query);
            if (startsA && !startsB) return -1;
            if (!startsA && startsB) return 1;

            // Prioritize large_airport over medium_airport
            if (a.type === 'large_airport' && b.type !== 'large_airport') return -1;
            if (b.type === 'large_airport' && a.type !== 'large_airport') return 1;

            // Prioritize medium_airport over small_airport
            if (a.type === 'medium_airport' && b.type !== 'medium_airport') return -1;
            if (b.type === 'medium_airport' && a.type !== 'medium_airport') return 1;

            return 0; // Default order
        });

        currentMatches = matches.slice(0, 10);

        if (currentMatches.length > 0) {
            // Portal: Move to body to avoid stacking context issues (backdrop-filter)
            if (suggestionBox.parentNode !== document.body) {
                document.body.appendChild(suggestionBox);
            }

            suggestionBox.classList.add('active');

            // Float the suggestions box using fixed positioning
            const rect = input.getBoundingClientRect();
            suggestionBox.style.position = 'fixed';
            suggestionBox.style.top = `${rect.bottom + 5}px`;
            suggestionBox.style.left = `${rect.left}px`;
            suggestionBox.style.width = `${rect.width}px`;

            // Re-calculate on scroll or resize to keep it attached
            // (Simple version: just hide on scroll/resize to avoid complexity/lag)

            currentMatches.forEach((airport, index) => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<span class="highlight">${airport.code}</span> - ${airport.name} (${airport.city || 'N/A'}, ${airport.country})`;

                // Use mousedown instead of click to fire before blur
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent blur
                    selectAirport(airport);
                });

                // Highlight on hover
                div.addEventListener('mouseenter', () => {
                    highlightedIndex = index;
                    updateHighlight();
                });

                suggestionBox.appendChild(div);
            });
        } else {
            suggestionBox.classList.remove('active');
        }
    });

    // Hide suggestions on scroll (body or containers) to prevent floating ghosts
    document.addEventListener('scroll', () => {
        if (suggestionBox.classList.contains('active')) {
            suggestionBox.classList.remove('active');
            input.blur(); // Also blur to fully reset state
        }
    }, true); // Capture phase to catch all scrolls

    // Handle keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (!suggestionBox.classList.contains('active') || currentMatches.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = (highlightedIndex + 1) % currentMatches.length;
            updateHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = highlightedIndex <= 0 ? currentMatches.length - 1 : highlightedIndex - 1;
            updateHighlight();
        } else if (e.key === 'Enter') {
            e.preventDefault(); // Stop form submit
            // Select highlighted or first if none highlighted
            const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0;
            selectAirport(currentMatches[indexToSelect]);
        } else if (e.key === 'Tab') {
            // Do NOT prevent default - let it move to next field
            const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0;
            selectAirport(currentMatches[indexToSelect]);
        } else if (e.key === 'Escape') {
            suggestionBox.classList.remove('active');
            highlightedIndex = -1;
        }
    });

    // Select all text on click to allow easy overwrite
    input.addEventListener('click', () => {
        input.select();
    });

    // Close suggestions on blur (focus lost)
    input.addEventListener('blur', () => {
        // Delay slightly to check if we just clicked an item
        setTimeout(() => {
            suggestionBox.classList.remove('active');
            highlightedIndex = -1;
        }, 100);
    });

    // Close suggestions when clicking outside (fallback)
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
            suggestionBox.classList.remove('active');
            highlightedIndex = -1;
        }
    });
}

export function setupLayoverControls(airports, onUpdate) {
    const container = document.getElementById('layovers-container');
    const addBtn = document.getElementById('add-layover-btn');

    addBtn.addEventListener('click', () => {
        const id = Date.now();
        const group = document.createElement('div');
        group.className = 'input-group layover-group';
        group.dataset.id = id;
        group.style.position = 'relative';

        group.innerHTML = `
            <label>Layover</label>
            <div style="display: flex; gap: 5px;">
                <div style="position: relative; flex-grow: 1;">
                    <input type="text" placeholder="City or Code" autocomplete="off" class="layover-input">
                    <div class="suggestions"></div>
                </div>
                <button class="remove-layover-btn">×</button>
            </div>
        `;

        container.appendChild(group);

        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;

        // Setup removal
        group.querySelector('.remove-layover-btn').addEventListener('click', () => {
            container.removeChild(group);

            // Cleanup detached suggestion box if it exists in body
            const suggestions = group.querySelector('.suggestions');
            if (suggestions && suggestions.parentNode === document.body) {
                document.body.removeChild(suggestions);
            }

            onUpdate(); // Trigger update to redraw path
        });

        // Setup autocomplete
        const input = group.querySelector('input');
        const suggestions = group.querySelector('.suggestions');

        setupAutocomplete(input, suggestions, airports, (selected) => {
            // Store selected airport on the input element
            input.dataset.airport = JSON.stringify(selected);
            console.log("Layover set:", selected.code);
            onUpdate(); // Trigger update to redraw path
        });
    });
}

export function getLayovers() {
    const inputs = document.querySelectorAll('.layover-input');
    const layovers = [];
    inputs.forEach(input => {
        if (input.dataset.airport) {
            try {
                layovers.push(JSON.parse(input.dataset.airport));
            } catch (e) {
                console.error("Failed to parse airport data", e);
            }
        }
    });
    return layovers;
}

export function updateFlightInfo(routeAirports, totalDistanceMeters) {
    flightInfoSection.classList.remove('hidden');

    // Clear previous info
    flightInfoSection.innerHTML = '';

    // Header for Total Stats
    const totalStatsDiv = document.createElement('div');
    totalStatsDiv.style.marginBottom = '15px';
    totalStatsDiv.style.paddingBottom = '10px';
    totalStatsDiv.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

    // Calculate total duration
    let totalDuration = 0;
    for (let i = 0; i < routeAirports.length - 1; i++) {
        const origin = routeAirports[i];
        const dest = routeAirports[i + 1];
        const dist = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(origin.lat, origin.lon),
            new google.maps.LatLng(dest.lat, dest.lon)
        );
        totalDuration += calculateFlightDuration(origin, dest, dist);
    }

    const totalHours = Math.floor(totalDuration);
    const totalMinutes = Math.round((totalDuration - totalHours) * 60);
    const totalTimeStr = `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}`;

    totalStatsDiv.innerHTML = `
        <div class="route-info" style="justify-content: center;">
            <span style="font-size: 1.1em;">Total Trip</span>
        </div>
        <div style="display: flex; justify-content: space-around; align-items: center; margin-top: 5px;">
            <div style="text-align: center;">
                <div class="tiny-text" style="margin-bottom: 5px;">DISTANCE</div>
                <div style="font-weight: 600;">${formatDistance(totalDistanceMeters).metric}</div>
            </div>
            <div style="text-align: center;">
                 <div class="tiny-text" style="margin-bottom: 5px;">TIME</div>
                 <div style="font-weight: 600;">${totalTimeStr}</div>
            </div>
        </div>
    `;
    flightInfoSection.appendChild(totalStatsDiv);

    // Per Leg Stats
    const legsContainer = document.createElement('div');
    legsContainer.id = 'flight-legs-container';
    legsContainer.style.maxHeight = '200px';
    legsContainer.style.overflowY = 'auto';

    for (let i = 0; i < routeAirports.length - 1; i++) {
        const origin = routeAirports[i];
        const dest = routeAirports[i + 1];

        const distMeters = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(origin.lat, origin.lon),
            new google.maps.LatLng(dest.lat, dest.lon)
        );

        const duration = calculateFlightDuration(origin, dest, distMeters);
        const legHours = Math.floor(duration);
        const legMinutes = Math.round((duration - legHours) * 60);
        const legTimeStr = `${legHours.toString().padStart(2, '0')}:${legMinutes.toString().padStart(2, '0')}`;

        const legDiv = document.createElement('div');
        legDiv.style.marginBottom = '10px';
        legDiv.style.background = 'rgba(255,255,255,0.05)';
        legDiv.style.padding = '8px';
        legDiv.style.borderRadius = '8px';

        legDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 600;">${origin.code}</span>
                <span class="arrow" style="font-size: 0.8em; color: white;">✈</span>
                <span style="font-weight: 600;">${dest.code}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--text-muted);">
                <span>${formatDistance(distMeters).metric}</span>
                <span>${legTimeStr}</span>
            </div>
        `;
        legsContainer.appendChild(legDiv);
    }
    flightInfoSection.appendChild(legsContainer);
}

function formatDistance(distanceMeters) {
    // Helper to format number based on magnitude
    function formatValue(value, isSmallUnit = false) {
        if (isSmallUnit) return Math.round(value); // m or ft always integer
        if (value >= 100) return Math.round(value);
        if (value >= 10) return value.toFixed(1);
        return value.toFixed(2);
    }

    // 1. Metric
    const distKm = distanceMeters / 1000;
    let metricText;
    if (distKm < 1) {
        metricText = `${Math.round(distanceMeters)} m`;
    } else {
        metricText = `${formatValue(distKm)} km`;
    }

    // 2. Imperial
    const distMiles = distanceMeters * 0.000621371;
    let imperialText;
    if (distMiles < 1) {
        const distFeet = distanceMeters * 3.28084;
        imperialText = `${Math.round(distFeet)} ft`;
    } else {
        imperialText = `${formatValue(distMiles)} miles`;
    }

    // 3. Nautical
    const distNM = distanceMeters * 0.000539957;
    const nauticalText = `${formatValue(distNM)} NM`;

    return {
        metric: metricText,
        imperial: imperialText,
        nautical: nauticalText
    };
}

/**
 * Calculates estimation of flight duration accounting for wind belts
 * @returns {number} Duration in hours
 */
function calculateFlightDuration(origin, dest, distanceMeters) {
    const toRad = (d) => d * Math.PI / 180;
    const lat1 = toRad(origin.lat);
    const lat2 = toRad(dest.lat);
    const dLon = toRad(dest.lon - origin.lon);

    // Calculate Bearing (Initial Bearing)
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

    // Base Speed (Typical commercial jet cruising speed)
    const baseSpeedKmh = 900;

    // Wind Effect (Westerlies in mid-latitudes)
    // Cosine of (Bearing - 90 deg) gives 1 for East, -1 for West
    // We assume a net wind component of ~100 km/h
    // This is a simplified model of the Jet Stream effect
    const windComponent = Math.cos((bearing - 90) * Math.PI / 180) * 100;

    const effectiveSpeed = baseSpeedKmh + windComponent;

    // Calculate raw flight time
    const distanceKm = distanceMeters / 1000;
    const flightHours = distanceKm / effectiveSpeed;

    // Add 30 mins (0.5h) for taxi, takeoff, approach, landing
    return flightHours + 0.5;
}
