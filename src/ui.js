
// UI Elements
const searchSection = document.getElementById('search-section');

const flightInfoSection = document.getElementById('flight-info');


export function enableSearch() {
    searchSection.classList.remove('disabled');
}

export function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;

    // Choose icon/symbol based on type
    let icon = 'ℹ️';
    if (type === 'error') icon = '⚠️';
    if (type === 'success') icon = '✅';

    toast.innerHTML = `<span style="font-size: 1.2em;">${icon}</span><span>${message}</span>`;

    container.appendChild(toast);

    // Auto remove after animation (3s total: 0.3s in + 2.4s wait + 0.3s out)
    setTimeout(() => {
        if (container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 3000);
}

export function findBestMatch(query, airports) {
    if (!query || query.length < 2) return null;
    query = query.toLowerCase();

    const matches = airports.filter(a =>
        a.code.toLowerCase().startsWith(query) ||
        (a.city && a.city.toLowerCase().includes(query)) ||
        a.name.toLowerCase().includes(query)
    );

    if (matches.length === 0) return null;

    matches.sort((a, b) => compareMatches(a, b, query));
    return matches[0];
}

function compareMatches(a, b, query) {
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

    return 0;
}

export function setupAutocomplete(input, suggestionBox, airports, onSelect) {
    if (!input || !suggestionBox) return;

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

        // Reuse logic? Valid approach is to just duplicate filter for now to keep autocomplete showing multiple
        // We can't strictly use findBestMatch because we need ALL matches for the UI list
        let matches = airports.filter(a =>
            a.code.toLowerCase().startsWith(query) ||
            (a.city && a.city.toLowerCase().includes(query)) ||
            a.name.toLowerCase().includes(query)
        );

        matches.sort((a, b) => compareMatches(a, b, query));

        currentMatches = matches.slice(0, 10);

        if (currentMatches.length > 0) {
            if (suggestionBox.parentNode !== document.body) {
                document.body.appendChild(suggestionBox);
            }
            suggestionBox.classList.add('active');
            const rect = input.getBoundingClientRect();
            suggestionBox.style.position = 'fixed';
            suggestionBox.style.top = `${rect.bottom + 5}px`;
            suggestionBox.style.left = `${rect.left}px`;
            suggestionBox.style.width = `${rect.width}px`;

            currentMatches.forEach((airport, index) => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<span class="highlight">${airport.code}</span> - ${airport.name} (${airport.city || 'N/A'}, ${airport.country})`;
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectAirport(airport);
                });
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

    document.addEventListener('scroll', (e) => {
        if (suggestionBox.classList.contains('active')) {
            if (e.target === suggestionBox || suggestionBox.contains(e.target)) return;
            suggestionBox.classList.remove('active');
            input.blur();
        }
    }, true);

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
            e.preventDefault();
            const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0;
            selectAirport(currentMatches[indexToSelect]);
        } else if (e.key === 'Tab') {
            const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0;
            selectAirport(currentMatches[indexToSelect]);
        } else if (e.key === 'Escape') {
            suggestionBox.classList.remove('active');
            highlightedIndex = -1;
        }
    });

    input.addEventListener('click', () => {
        input.select();
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            suggestionBox.classList.remove('active');
            highlightedIndex = -1;
        }, 100);
    });

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
        if (!canAddMoreStops()) {
            showNotification('Maximum 10 stops allowed (including origin and destination).', 'error');
            return;
        }

        const id = Date.now();
        const group = document.createElement('div');
        group.className = 'input-group layover-group';
        group.dataset.id = id;
        group.style.position = 'relative';

        group.innerHTML = `
            <span class="drag-handle">⠿</span>
            <div style="display: flex; gap: 5px; flex-grow: 1;">
                <input type="text" placeholder="Stop (e.g. CDG)" autocomplete="off" class="layover-input" style="flex-grow: 1;">
                <button class="remove-layover-btn">×</button>
            </div>
            <div class="suggestions"></div>
        `;

        // Clear dataset on input so we don't use stale selected data if user changes text
        const inputEl = group.querySelector('input');
        inputEl.addEventListener('input', () => {
            delete inputEl.dataset.airport;
        });

        container.appendChild(group);
        container.scrollTop = container.scrollHeight;

        group.querySelector('.remove-layover-btn').addEventListener('click', () => {
            container.removeChild(group);
            const suggestions = group.querySelector('.suggestions');
            if (suggestions && suggestions.parentNode === document.body) {
                document.body.removeChild(suggestions);
            }
            onUpdate();
            updateAddButtonState();
        });

        const input = group.querySelector('input');
        const suggestions = group.querySelector('.suggestions');

        setupAutocomplete(input, suggestions, airports, (selected) => {
            // Store selected airport on the input element
            input.dataset.airport = JSON.stringify(selected);
            onUpdate(); // Trigger update to redraw path
        });

        // Enable DnD for this new item
        setupDragItems();

        // Update button state
        updateAddButtonState();
    });
}

const MAX_TOTAL_STOPS = 10; // Including origin and destination

export function canAddMoreStops() {
    const container = document.getElementById('layovers-container');
    const layoverCount = container.querySelectorAll('.layover-group').length;
    return (layoverCount + 2) < MAX_TOTAL_STOPS;
}

export function updateAddButtonState() {
    const addBtn = document.getElementById('add-layover-btn');
    if (!canAddMoreStops()) {
        addBtn.disabled = true;
        addBtn.style.opacity = '0.4';
        addBtn.style.cursor = 'not-allowed';
    } else {
        addBtn.disabled = false;
        addBtn.style.opacity = '';
        addBtn.style.cursor = '';
    }
}

// Helper for exit animation
function animateExit(elements, callback) {
    elements = Array.isArray(elements) ? elements : [elements];
    elements.forEach(el => {
        el.classList.add('fade-exit');
        el.offsetHeight; // Force reflow
        el.classList.add('fade-exit-active');
    });

    setTimeout(() => {
        elements.forEach(el => {
            el.classList.remove('fade-exit', 'fade-exit-active');
        });
        if (callback) callback();
    }, 200); // Match CSS duration
}

// Helper for enter animation
function animateEnter(elements) {
    elements = Array.isArray(elements) ? elements : [elements];
    elements.forEach(el => {
        el.classList.add('fade-enter');
    });

    requestAnimationFrame(() => {
        elements.forEach(el => {
            el.classList.add('fade-enter-active');
        });
    });

    setTimeout(() => {
        elements.forEach(el => {
            el.classList.remove('fade-enter', 'fade-enter-active');
        });
    }, 300); // Match CSS duration
}

export function collapseStops() {
    const container = document.getElementById('layovers-container');
    const stopsContainer = document.getElementById('stops-container');
    const layoverGroups = container.querySelectorAll('.layover-group');
    const originGroup = document.querySelector('[data-type="origin"]');
    const destGroup = document.querySelector('[data-type="dest"]');
    const originInput = document.getElementById('origin-input');
    const destInput = document.getElementById('dest-input');
    const addBtn = document.getElementById('add-layover-btn');
    const trackBtn = document.getElementById('track-btn');

    // Animate out inputs and buttons
    animateExit([originGroup, destGroup, container, addBtn, trackBtn], () => {
        // Hide all input groups and center line
        stopsContainer.classList.add('collapsed');
        originGroup.style.display = 'none';
        destGroup.style.display = 'none';
        container.style.display = 'none';
        addBtn.style.display = 'none';
        trackBtn.style.display = 'none';

        // Create collapsed view
        let collapsed = document.getElementById('collapsed-stops');
        if (!collapsed) {
            collapsed = document.createElement('div');
            collapsed.id = 'collapsed-stops';
            originGroup.parentNode.insertBefore(collapsed, originGroup.nextSibling);
        }

        collapsed.innerHTML = '';

        // Helper to get country code from dataset
        function getCountryCode(input) {
            if (input.dataset.airport) {
                try {
                    const airport = JSON.parse(input.dataset.airport);
                    return airport.country ? airport.country.slice(0, 2).toUpperCase() : '';
                } catch (e) { }
            }
            return '';
        }

        // Origin text with country
        const originCountry = getCountryCode(originInput);
        const originText = document.createElement('div');
        originText.className = 'collapsed-endpoint';
        originText.textContent = (originInput.value || 'Origin') + (originCountry ? ` (${originCountry})` : '');
        collapsed.appendChild(originText);

        // Layover texts with truncation
        const MAX_VISIBLE_STOPS = 5;
        const layoverArray = Array.from(layoverGroups);
        const totalLayovers = layoverArray.length;

        if (totalLayovers <= MAX_VISIBLE_STOPS) {
            // Show all
            layoverArray.forEach((group) => {
                const input = group.querySelector('input');
                const country = getCountryCode(input);
                let displayText = (input.value || 'Stop') + (country ? ` (${country})` : '');

                const stopText = document.createElement('div');
                stopText.className = 'collapsed-stop-item';
                stopText.innerHTML = `<span class="collapsed-stop-text">${displayText}</span>`;
                collapsed.appendChild(stopText);
            });
        } else {
            // Truncate: show first 2, then ..., then last 2
            for (let i = 0; i < 2; i++) {
                const input = layoverArray[i].querySelector('input');
                const country = getCountryCode(input);
                let displayText = (input.value || 'Stop') + (country ? ` (${country})` : '');

                const stopText = document.createElement('div');
                stopText.className = 'collapsed-stop-item';
                stopText.innerHTML = `<span class="collapsed-stop-text">${displayText}</span>`;
                collapsed.appendChild(stopText);
            }

            // Truncation indicator
            const truncatedCount = totalLayovers - 4;
            const truncText = document.createElement('div');
            truncText.className = 'collapsed-stop-item';
            truncText.innerHTML = `<span class="collapsed-stop-text" style="font-style: italic;">... ${truncatedCount} stop${truncatedCount > 1 ? 's' : ''} ...</span>`;
            collapsed.appendChild(truncText);

            // Last 2
            for (let i = totalLayovers - 2; i < totalLayovers; i++) {
                const input = layoverArray[i].querySelector('input');
                const country = getCountryCode(input);
                let displayText = (input.value || 'Stop') + (country ? ` (${country})` : '');

                const stopText = document.createElement('div');
                stopText.className = 'collapsed-stop-item';
                stopText.innerHTML = `<span class="collapsed-stop-text">${displayText}</span>`;
                collapsed.appendChild(stopText);
            }
        }

        // Destination text with country
        const destCountry = getCountryCode(destInput);
        const destText = document.createElement('div');
        destText.className = 'collapsed-endpoint';
        destText.textContent = (destInput.value || 'Destination') + (destCountry ? ` (${destCountry})` : '');
        collapsed.appendChild(destText);

        collapsed.addEventListener('click', expandStops);



        // Add edit hint inside collapsed div
        const editHint = document.createElement('div');
        editHint.id = 'edit-hint';
        editHint.textContent = 'Click anywhere to edit';
        editHint.style.textAlign = 'center';
        editHint.style.color = 'var(--text-muted)';
        editHint.style.fontSize = '0.8em';
        editHint.style.padding = '5px 0';
        editHint.style.cursor = 'pointer';
        editHint.style.opacity = '0.4';
        editHint.addEventListener('click', expandStops);
        collapsed.appendChild(editHint);

        // Animate in collapsed view
        animateEnter(collapsed);
    });
}

export function expandStops() {
    const container = document.getElementById('layovers-container');
    const stopsContainer = document.getElementById('stops-container');
    const collapsed = document.getElementById('collapsed-stops');
    const flightInfo = document.getElementById('flight-info');
    const originGroup = document.querySelector('[data-type="origin"]');
    const destGroup = document.querySelector('[data-type="dest"]');

    // Animate out collapsed view
    if (collapsed) {
        animateExit(collapsed, () => {
            collapsed.remove();

            // Show inputs again and center line
            stopsContainer.classList.remove('collapsed');
            originGroup.style.display = '';
            destGroup.style.display = '';
            container.style.display = '';

            // Remove edit hint
            const editHint = document.getElementById('edit-hint');
            if (editHint) {
                editHint.remove();
            }

            // Show buttons again
            const addBtn = document.getElementById('add-layover-btn');
            const trackBtn = document.getElementById('track-btn');
            addBtn.style.display = '';
            trackBtn.style.display = '';

            if (flightInfo) {
                flightInfo.classList.add('hidden');
            }

            // Animate in inputs
            animateEnter([originGroup, destGroup, container, addBtn, trackBtn]);
        });
    } else {
        // Fallback if no collapsed view
        stopsContainer.classList.remove('collapsed');
        originGroup.style.display = '';
        destGroup.style.display = '';
        container.style.display = '';
    }
}

// Helper to re-attach drag events
export function setupDragItems() {
    const draggables = document.querySelectorAll('.input-group');

    draggables.forEach(group => {
        // Skip if already set up
        if (group.dataset.dragSetup === 'true') return;
        group.dataset.dragSetup = 'true';

        const handle = group.querySelector('.drag-handle');
        if (!handle) return;

        // Make the handle the drag initiator
        handle.addEventListener('mousedown', () => {
            group.setAttribute('draggable', 'true');
        });

        group.addEventListener('dragstart', (e) => {
            group.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', ''); // Required for Firefox
        });

        group.addEventListener('dragend', () => {
            group.classList.remove('dragging');
            group.removeAttribute('draggable');
            // Clean up any lingering drag-over states
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        // Allow drops
        group.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            e.dataTransfer.dropEffect = 'move';
            // Add drag-over class here for more reliable detection
            if (!group.classList.contains('dragging')) {
                group.classList.add('drag-over');
            }
        });

        group.addEventListener('dragenter', (e) => {
            e.preventDefault();
        });

        group.addEventListener('dragleave', (e) => {
            // Only remove if leaving to a non-child element
            if (!group.contains(e.relatedTarget)) {
                group.classList.remove('drag-over');
            }
        });

        group.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            group.classList.remove('drag-over');
            const sourceGroup = document.querySelector('.dragging');
            if (sourceGroup && sourceGroup !== group) {
                swapInputs(sourceGroup, group);
            }
        });
    });
}

function swapInputs(groupA, groupB) {
    const inputA = groupA.querySelector('input');
    const inputB = groupB.querySelector('input');

    // Swap values
    const tempVal = inputA.value;
    inputA.value = inputB.value;
    inputB.value = tempVal;

    // Swap datasets (the actual airport objects)
    const tempDataset = inputA.dataset.airport;
    if (inputB.dataset.airport) {
        inputA.dataset.airport = inputB.dataset.airport;
    } else {
        delete inputA.dataset.airport;
    }

    if (tempDataset) {
        inputB.dataset.airport = tempDataset;
    } else {
        delete inputB.dataset.airport;
    }

    // Optional: Visual feedback
    groupA.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    groupB.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    setTimeout(() => {
        groupA.style.backgroundColor = '';
        groupB.style.backgroundColor = '';
    }, 300);
}

export function getLayovers(airports) { // Now needs airports list for smart matching
    const inputs = document.querySelectorAll('.layover-input');
    const layovers = [];

    for (const input of inputs) {
        if (input.dataset.airport) {
            try {
                layovers.push(JSON.parse(input.dataset.airport));
            } catch (e) {
                console.error("Failed to parse airport data", e);
            }
        } else if (input.value.trim().length > 0) {
            // Smart Match
            const match = findBestMatch(input.value.trim(), airports);
            if (match) {
                input.value = `${match.code} - ${match.city || match.name}`;
                input.dataset.airport = JSON.stringify(match); // Save it
                layovers.push(match);
                showNotification(`Auto-selected layover: ${match.code}`, 'info');
            } else {
                throw new Error(`Layover '${input.value}' matches no known airport.`);
            }
        }
    }
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
        legDiv.style.marginRight = '3px';
        legDiv.style.background = 'rgba(255,255,255,0.05)';
        legDiv.style.padding = '8px';
        legDiv.style.borderRadius = '8px';

        legDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 600; text-align: left;">${origin.code}</span>
                <span style="text-align: center; white-space: nowrap;">
                    <span style="color: var(--text-muted); font-size: 0.85em;">${legTimeStr}</span>
                    <span class="arrow" style="font-size: 0.9em; color: white; margin: 0 4px;">✈</span>
                </span>
                <span style="font-weight: 600; text-align: right;">${dest.code}</span>
            </div>
            <div style="text-align: center; font-size: 0.8em; color: var(--text-muted);">
                ${formatDistance(distMeters).metric} | ${formatDistance(distMeters).imperial} | ${formatDistance(distMeters).nautical}
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

const TO_RAD = Math.PI / 180;
const BASE_SPEED_KMH = 900;

/**
 * Calculates estimation of flight duration accounting for wind belts
 * @returns {number} Duration in hours
 */
function calculateFlightDuration(origin, dest, distanceMeters) {
    const lat1 = origin.lat * TO_RAD;
    const lat2 = dest.lat * TO_RAD;
    const dLon = (dest.lon - origin.lon) * TO_RAD;

    // Calculate Bearing (Initial Bearing)
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

    // Wind Effect (Westerlies in mid-latitudes)
    // Cosine of (Bearing - 90 deg) gives 1 for East, -1 for West
    // We assume a net wind component of ~100 km/h
    // This is a simplified model of the Jet Stream effect
    const windComponent = Math.cos((bearing - 90) * TO_RAD) * 100;

    const effectiveSpeed = BASE_SPEED_KMH + windComponent;

    // Calculate raw flight time
    const distanceKm = distanceMeters / 1000;
    const flightHours = distanceKm / effectiveSpeed;

    // Add 30 mins (0.5h) for taxi, takeoff, approach, landing
    return flightHours + 0.5;
}
