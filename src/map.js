/**
 * Map Module - Barrel File
 * Re-exports all map functionality for convenient importing
 */

// Core
export { loadGoogleMapsScript, initMap, getMap } from './map/core.js';

// Path drawing
export { drawPath } from './map/path.js';

// Animation (exported for potential direct use)
export { animateCamera } from './map/animation.js';

// Labels (exported for potential direct use)
export { createLabelContent, calculateLabelOffsets } from './map/labels.js';

// Landmarks
export { filterLandmarksInCorridor, renderLandmarks, clearLandmarkMarkers } from './map/landmarks.js';
