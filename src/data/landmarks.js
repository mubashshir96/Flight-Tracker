/**
 * Landmark Data Module
 * Loads and parses landmark CSV data with tier assignment
 */

// Tier thresholds based on sitelinks count
const TIER_THRESHOLDS = {
    TIER_1: 40,  // > 40 sitelinks = Global Icon
    TIER_2: 10   // 10-40 sitelinks = National, < 10 = Local
};

// Corridor detection radius in kilometers
export const TIER_RADIUS_KM = {
    1: 80,   // 50 miles
    2: 32,   // 20 miles
    3: 8     // 5 miles
};

let landmarksCache = null;

/**
 * Loads and parses the landmark CSV data.
 * @returns {Promise<Array>} Array of landmark objects
 */
export async function loadLandmarks() {
    if (landmarksCache) return landmarksCache;

    try {
        const response = await fetch('/data/landmarks_with_description.csv');
        const text = await response.text();
        landmarksCache = parseLandmarkCSV(text);
        console.log(`Loaded ${landmarksCache.length} landmarks.`);
        return landmarksCache;
    } catch (err) {
        console.error('Error loading landmarks:', err);
        return [];
    }
}

/**
 * Parses landmark CSV text into structured objects
 * New format: article,name,coords,sitelinks,image,description
 * @param {string} csvText - Raw CSV content
 * @returns {Array} Array of landmark objects with tier assignment
 */
function parseLandmarkCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];
    const seenIds = new Set(); // Deduplicate by article URL

    // Skip header (line 0): article,name,coords,sitelinks,image,description
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCSVLine(line);
        if (cols.length < 4) continue;

        const articleUrl = cols[0];  // Wikipedia URL (may be empty)
        const name = cols[1];
        const coordsStr = cols[2];
        const sitelinks = parseInt(cols[3], 10) || 0;
        const imageUrl = cols[4] || '';
        const description = cols[5] || '';

        // Skip duplicates based on article URL + name combo
        const uniqueKey = articleUrl || name;
        if (seenIds.has(uniqueKey)) continue;
        seenIds.add(uniqueKey);

        // Parse coordinates from "Point(lon lat)" format
        const coords = parsePointCoords(coordsStr);
        if (!coords) continue;

        // Assign tier based on sitelinks
        const tier = getTier(sitelinks);

        result.push({
            id: uniqueKey,
            name,
            lat: coords.lat,
            lon: coords.lon,
            sitelinks,
            tier,
            imageUrl,
            description,
            wikiUrl: articleUrl  // Wikipedia URL (empty string if none)
        });
    }

    return result;
}

/**
 * Parses "Point(lon lat)" format to coordinates
 * @param {string} str - Coordinate string
 * @returns {{lat: number, lon: number}|null}
 */
function parsePointCoords(str) {
    if (!str || !str.startsWith('Point(')) return null;

    const match = str.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
    if (!match) return null;

    const lon = parseFloat(match[1]);
    const lat = parseFloat(match[2]);

    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
}

/**
 * Determines tier based on sitelinks count
 * @param {number} sitelinks
 * @returns {number} Tier (1, 2, or 3)
 */
function getTier(sitelinks) {
    if (sitelinks > TIER_THRESHOLDS.TIER_1) return 1;
    if (sitelinks >= TIER_THRESHOLDS.TIER_2) return 2;
    return 3;
}

/**
 * Helper to parse a CSV line handling quotes
 * @param {string} text
 * @returns {string[]}
 */
function parseCSVLine(text) {
    const result = [];
    let start = 0;
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            let field = text.substring(start, i);
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.substring(1, field.length - 1).replace(/""/g, '"');
            }
            result.push(field);
            start = i + 1;
        }
    }

    // Last field
    let field = text.substring(start);
    if (field.startsWith('"') && field.endsWith('"')) {
        field = field.substring(1, field.length - 1).replace(/""/g, '"');
    }
    result.push(field);

    return result;
}
