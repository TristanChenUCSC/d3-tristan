// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import luck function
import luck from "./_luck.ts";

// Basic UI elements
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// Location of Classroom
const CLASSROOM_COORDINATES = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const GRID_SIZE = 30;
const TOKEN_SPAWN_PROBABILITY = 0.15;

// Create the map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_COORDINATES,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(CLASSROOM_COORDINATES);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Function to create and add a rectangle for a cell at grid position (i, j)
function createCell(i: number, j: number, token: boolean) {
  const origin = CLASSROOM_COORDINATES;
  const cellBounds = leaflet.latLngBounds(
    [
      origin.lat + i * TILE_DEGREES,
      origin.lng + j * TILE_DEGREES,
    ],
    [
      origin.lat + (i + 1) * TILE_DEGREES,
      origin.lng + (j + 1) * TILE_DEGREES,
    ],
  );

  const rect = leaflet.rectangle(cellBounds);
  rect.addTo(map);

  if (token) {
    // Add visible token in the center of the cell
    const center = leaflet.latLng(
      origin.lat + (i + 0.5) * TILE_DEGREES,
      origin.lng + (j + 0.5) * TILE_DEGREES,
    );

    const tokenIcon = leaflet.divIcon({
      className: "token-icon",
      html: `2`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const tokenMarker = leaflet.marker(center, {
      icon: tokenIcon,
      interactive: false,
    });

    tokenMarker.addTo(map);
    rect.bindPopup("You found a token of value 2!");
  } else {
    // No token in this cell
    rect.bindPopup("Empty cell");
  }
}

// Create a grid of cells around the classroom
for (let i = -GRID_SIZE; i < GRID_SIZE; i++) {
  for (let j = -GRID_SIZE; j < GRID_SIZE; j++) {
    if (luck([i, j].toString()) < TOKEN_SPAWN_PROBABILITY) {
      createCell(i, j, true);
    } else {
      createCell(i, j, false);
    }
  }
}
