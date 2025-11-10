// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import luck function
import luck from "./_luck.ts";

// === Type Definitions ===
interface Cell {
  hasToken: boolean;
  tokenValue: number | null;
  rect: leaflet.Rectangle;
  tokenMarker?: leaflet.Marker | undefined;
}

// === Game State ===

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
const PLAYER_RANGE_METERS = 35;

// === DOM Initialization ===

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

// Inventory UI
const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";

const inventoryTitle = document.createElement("div");
inventoryTitle.className = "inventory-title";
inventoryTitle.textContent = "Inventory";

const inventorySlot = document.createElement("div");
inventorySlot.className = "inventory-slot";

const inventoryToken = document.createElement("div");
inventoryToken.className = "token-icon inventory-token";

inventorySlot.appendChild(inventoryToken);
inventoryDiv.appendChild(inventoryTitle);
inventoryDiv.appendChild(inventorySlot);
statusPanelDiv.appendChild(inventoryDiv);

// === Map Initialization ===

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

// Player range
const playerRangeCircle = leaflet.circle(CLASSROOM_COORDINATES, {
  radius: PLAYER_RANGE_METERS,
  color: "green",
  fillColor: "#green",
  fillOpacity: 0.2,
});
playerRangeCircle.addTo(map);

// === Utility functions ===

function updateInventoryUI() {
  if (inventory === null) {
    // hide token visual when inventory is empty
    inventoryToken.textContent = "";
    inventoryToken.classList.add("inventory-empty-token");
  } else {
    inventoryToken.textContent = String(inventory);
    inventoryToken.classList.remove("inventory-empty-token");
  }
}

function getCellCenter(i: number, j: number): leaflet.LatLng {
  return leaflet.latLng(
    CLASSROOM_COORDINATES.lat + (i + 0.5) * TILE_DEGREES,
    CLASSROOM_COORDINATES.lng + (j + 0.5) * TILE_DEGREES,
  );
}

function getDistanceFromPlayer(i: number, j: number): number {
  return CLASSROOM_COORDINATES.distanceTo(getCellCenter(i, j));
}

function createTokenMarker(
  value: number,
  center: leaflet.LatLng,
  map: leaflet.Map,
): leaflet.Marker {
  const tokenIcon = leaflet.divIcon({
    className: "token-icon",
    html: `${value}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  const tokenMarker = leaflet.marker(center, {
    icon: tokenIcon,
    interactive: false,
  });

  tokenMarker.addTo(map);
  return tokenMarker;
}

function createPopup(
  latLng: leaflet.LatLng,
  message: string,
  buttonText?: string,
  onClick?: () => void,
) {
  const popupDiv = document.createElement("div");
  const infoDiv = document.createElement("div");
  infoDiv.textContent = message;
  popupDiv.appendChild(infoDiv);

  if (buttonText && onClick) {
    const button = document.createElement("button");
    button.textContent = buttonText;
    button.addEventListener("click", onClick);
    popupDiv.appendChild(button);
  }

  leaflet
    .popup()
    .setLatLng(latLng)
    .setContent(popupDiv)
    .openOn(map);
}

// === Functions for core game actions ===

function pickUpToken(cellCenter: leaflet.LatLng, cell: Cell) {
  createPopup(
    cellCenter,
    `You found a token with a value of ${cell.tokenValue}.`,
    "Pick Up Token",
    () => {
      inventory = cell.tokenValue;
      updateInventoryUI();
      cell.hasToken = false;
      cell.tokenValue = null;
      if (cell.tokenMarker) {
        map.removeLayer(cell.tokenMarker);
        cell.tokenMarker = undefined;
      }
      map.closePopup();
    },
  );
}

function craftToken(cellCenter: leaflet.LatLng, cell: Cell) {
  createPopup(
    cellCenter,
    `This token has the same value as your token (${inventory}).`,
    "Craft them together",
    () => {
      cell.tokenValue! += inventory!;
      inventory = null;
      updateInventoryUI();
      if (cell.tokenMarker) {
        map.removeLayer(cell.tokenMarker);
      }
      cell.tokenMarker = createTokenMarker(cell.tokenValue!, cellCenter, map);
      map.closePopup();
    },
  );
}

function placeToken(cellCenter: leaflet.LatLng, cell: Cell) {
  createPopup(
    cellCenter,
    "You have a token. Place token here?",
    "Place Token",
    () => {
      cell.hasToken = true;
      cell.tokenValue = inventory;
      inventory = null;
      updateInventoryUI();
      cell.tokenMarker = createTokenMarker(cell.tokenValue!, cellCenter, map);
      map.closePopup();
    },
  );
}

// === Main Game Logic ===

// Player Inventory
let inventory: number | null = null;
updateInventoryUI();

// Data representation of the grid
const grid: Record<string, Cell> = {};

// Function to create a cell
function createCell(i: number, j: number, hasToken: boolean) {
  const key = `${i},${j}`;
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

  let tokenMarker: leaflet.Marker | undefined = undefined;
  if (hasToken) {
    // Add visible token marker in the center of the cell
    const center = getCellCenter(i, j);

    tokenMarker = createTokenMarker(2, center, map);
  }

  grid[key] = {
    hasToken,
    tokenValue: hasToken ? 2 : null,
    rect,
    tokenMarker,
  };

  rect.on("click", () => handleCellClick(i, j));
}

// Function to handle cell clicks
function handleCellClick(i: number, j: number) {
  const key = `${i},${j}`;
  const cell = grid[key];
  const cellCenter = getCellCenter(i, j);
  const distance = getDistanceFromPlayer(i, j);

  if (distance > PLAYER_RANGE_METERS) {
    createPopup(
      cellCenter,
      "Too far away!",
    );
    return;
  }

  // If clicked cell has a token
  if (cell.hasToken && cell.tokenValue !== null) {
    // If inventory is empty, pick up the token. Use popup and button to confirm
    if (inventory === null) {
      pickUpToken(cellCenter, cell);
      return;
    } // If inventory has a token of the same value, craft them together
    else if (cell.tokenValue === inventory) {
      craftToken(cellCenter, cell);
      return;
    } // If inventory has a different token, do nothing
    else {
      createPopup(
        cellCenter,
        "Cannot be crafted with your token.",
      );
      return;
    }
  } // Else apply logic for clicking an empty cell
  else {
    // If inventory is empty, show message that cell is empty
    if (inventory === null) {
      createPopup(
        cellCenter,
        "This is an empty Cell.",
      );
      return;
    } else {
      // Allow player to place token from inventory into the cell
      placeToken(cellCenter, cell);
      return;
    }
  }
}

// Generate the grid of cells
for (let i = -GRID_SIZE; i < GRID_SIZE; i++) {
  for (let j = -GRID_SIZE; j < GRID_SIZE; j++) {
    if (luck([i, j].toString()) < TOKEN_SPAWN_PROBABILITY) {
      createCell(i, j, true);
    } else {
      createCell(i, j, false);
    }
  }
}
