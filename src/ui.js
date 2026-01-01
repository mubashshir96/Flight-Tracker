
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
            suggestionBox.classList.add('active');
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

export function updateFlightInfo(originCode, destCode, distanceMeters) {
    flightInfoSection.classList.remove('hidden');
    routeOriginEl.textContent = originCode;
    routeDestEl.textContent = destCode;

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

    distanceInfoEl.textContent = `${metricText} | ${imperialText} | ${nauticalText}`;
}
