# ✈️ 3D Flight Tracker

A modern, high-performance web application that visualizes flight paths on an interactive Google Maps overlay. Built with Vanilla JS and Vite for speed and simplicity.

## ✨ Features

- **3D Globe Visualization**: Uses WebGL-powered Vector Maps for a stunning, rotatable earth view.
- **Smart Pathing**: Draws accurate geodesic (curved) flight paths between airports.
- **Multi-Leg Routing**: Support for multiple layovers with dynamic route updates.
- **Advanced Metrics**:
  - Distance displayed in Metric (km), Imperial (mi), and Nautical (nm) units.
  - **Wind-Aware Flight Time**: Estimates duration accounting for jet streams (Eastbound flights are faster!).
  - Detailed per-leg and total trip statistics.
- **Premium UI/UX**:
  - **Glassmorphism Design**: "Smoked Glass" aesthetic with backdrop blurring.
  - **Cinematic Animations**: Smooth camera transitions.
  - **Responsive Layout**: Flexbox-based interface that adapts to screen height without cutting off content.
  - **Portal-based Menus**: Autocomplete suggestions float above the interface to prevent clipping.

## 🚀 Getting Started

### Prerequisites

- Node.js installed.
- A valid Google Maps API Key with **Maps JavaScript API** enabled.

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/flight-tracker.git
    cd flight-tracker
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    - Create a `.env` file in the root directory.
    - Add your API Key:
      ```env
      VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
      ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

## 🛠️ Project Structure

The codebase is modularized for maintainability:

-   `src/main.js`: Application entry point and logic orchestration.
-   `src/map.js`: Google Maps API initialization, 3D rendering, and marker management.
-   `src/ui.js`: DOM manipulation, event listeners, and autocomplete logic.
-   `src/data.js`: Efficient parsing of the CSV airport database.
-   `style.css`: All styling variables, glassmorphism effects, and responsive layout rules.

## 🎮 Controls

-   **Rotate/Tilt**: Hold `Ctrl` (or `Shift`) + Left Click and drag.
-   **Zoom**: Scroll wheel or pinch.
-   **Select Airport**: Type code (e.g., "JFK") or city name. Press `Enter`/`Tab` to auto-select the best match.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
