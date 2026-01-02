# Flight Visualizer

A modern web application that visualizes flight paths on an interactive 3D Google Maps globe. Built with Vanilla JS and Vite.

## Features

- **3D Globe Visualization**: WebGL-powered Vector Maps with smooth rotation and tilt
- **Smart Pathing**: Accurate geodesic (curved) flight paths between airports
- **Multi-Leg Routing**: Add up to 8 layovers with drag-and-drop reordering
- **Advanced Metrics**:
  - Distance in Metric (km), Imperial (mi), and Nautical (NM)
  - Wind-aware flight time estimates (jet stream effects)
  - Per-leg and total trip statistics
- **Premium UI**: Glassmorphism design, cinematic camera animations, responsive layout

## Getting Started

### Prerequisites

- Node.js (v16+)
- Google Maps API Key with **Maps JavaScript API** and **Geometry Library** enabled

### Installation

```bash
git clone https://github.com/Cynid-22/Flight-Tracker.git
cd Flight-Tracker
npm install
```

### Configuration

Create a `.env` file in the root directory:

```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

### Run

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Project Structure

```
src/
├── main.js           # Entry point
├── data.js           # Airport CSV parser
├── map.js            # Map barrel (re-exports)
├── ui.js             # UI barrel (re-exports)
├── flight/
│   └── duration.js   # Flight time calculator
├── map/
│   ├── core.js       # Map initialization
│   ├── path.js       # Path drawing
│   ├── labels.js     # Airport labels
│   └── animation.js  # Camera animation
├── ui/
│   ├── autocomplete.js
│   ├── layovers.js
│   ├── dragdrop.js
│   ├── collapse.js
│   ├── flightInfo.js
│   └── animations.js
└── utils/
    ├── constants.js
    ├── formatting.js
    └── notifications.js

styles/
├── main.css          # Master import
├── variables.css     # CSS custom properties
├── base.css          # Reset, body, map
├── layout.css        # Container, cards
├── components.css    # Buttons, inputs
├── layovers.css      # Stop management
├── suggestions.css   # Autocomplete dropdown
├── flight-info.css   # Route display
├── notifications.css # Toast messages
├── animations.css    # Transitions
└── map-controls.css  # Zoom buttons
```

## Controls

| Action | Input |
|--------|-------|
| Rotate/Tilt | `Ctrl` + Left Click + Drag |
| Zoom | Scroll wheel or pinch |
| Select Airport | Type code (JFK) or city, press `Enter`/`Tab` |
| Reorder Stops | Drag the ⠿ handle |

## License

MIT License. See [LICENSE](LICENSE) for details.
