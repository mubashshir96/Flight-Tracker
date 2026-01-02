
/**
 * Loads and parses the airport CSV data.
 * @returns {Promise<Array>} Array of airport objects
 */
export async function loadAirports() {
    try {
        const response = await fetch('/airports.csv');
        const text = await response.text();
        return parseCSV(text);
    } catch (err) {
        console.error('Error loading airports:', err);
        return [];
    }
}

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
        if (type !== 'large_airport' && type !== 'medium_airport' && type !== 'small_airport') continue;

        const iata = cols[13];
        if (!iata) continue;

        result.push({
            code: iata,
            name: cols[3],
            type: cols[2], // 'large_airport' or 'medium_airport'
            city: cols[10] || '',
            country: cols[8],
            lat: parseFloat(cols[4]),
            lon: parseFloat(cols[5])
        });
    }
    return result;
}

// Helper to parse a CSV line handling quotes
// Helper to parse a CSV line handling quotes
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
