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
  rect?: leaflet.Rectangle | undefined;
  tokenMarker?: leaflet.Marker | undefined;
}

// === Game State ===

// Location of Grid Origin
const ORIGIN_COORDINATES = leaflet.latLng(0, 0);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const TOKEN_SPAWN_PROBABILITY = 0.15;
const PLAYER_RANGE_METERS = 35;
const VICTORY_THRESHOLD = 32;

// Victory state
let victoryState = false;

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
  center: ORIGIN_COORDINATES,
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

// Player position and movable marker
let playerPosition = leaflet.latLng(
  ORIGIN_COORDINATES.lat,
  ORIGIN_COORDINATES.lng,
);
const playerMarker = leaflet.marker(playerPosition);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Player range (follows playerPosition)
const playerRangeCircle = leaflet.circle(playerPosition, {
  radius: PLAYER_RANGE_METERS,
  color: "green",
  fillColor: "green",
  fillOpacity: 0.2,
});
playerRangeCircle.addTo(map);

// === Gamepad UI ===
// Create a simple 4-button D-pad to simulate movement
const gamepad = document.createElement("div");
gamepad.id = "gamepad";

function makeButton(label: string) {
  const b = document.createElement("button");
  b.className = "gamepad-button";
  b.textContent = label;
  return b;
}

const upButton = makeButton("Go North");
const leftButton = makeButton("Go West");
const rightButton = makeButton("Go East");
const downButton = makeButton("Go South");

const row1 = document.createElement("div");
row1.className = "gamepad-row";
row1.appendChild(upButton);

const row2 = document.createElement("div");
row2.className = "gamepad-row";
row2.appendChild(leftButton);
const spacer = document.createElement("div");
spacer.className = "gamepad-spacer";
row2.appendChild(spacer);
row2.appendChild(rightButton);

const row3 = document.createElement("div");
row3.className = "gamepad-row";
row3.appendChild(downButton);

gamepad.appendChild(row1);
gamepad.appendChild(row2);
gamepad.appendChild(row3);
// Place the gamepad in the status panel (below the map) and to the right of the inventory
statusPanelDiv.appendChild(gamepad);

// Movement helper: move by TILE_DEGREES for lat/lng
function movePlayer(dLat: number, dLng: number) {
  playerPosition = leaflet.latLng(
    playerPosition.lat + dLat,
    playerPosition.lng + dLng,
  );
  playerMarker.setLatLng(playerPosition);
  playerRangeCircle.setLatLng(playerPosition);
  // Optionally pan the map to keep player in view
  map.panTo(playerPosition);
}

// Wire up buttons
upButton.addEventListener("click", () => movePlayer(TILE_DEGREES, 0));
downButton.addEventListener("click", () => movePlayer(-TILE_DEGREES, 0));
leftButton.addEventListener("click", () => movePlayer(0, -TILE_DEGREES));
rightButton.addEventListener("click", () => movePlayer(0, TILE_DEGREES));

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
    ORIGIN_COORDINATES.lat + (i + 0.5) * TILE_DEGREES,
    ORIGIN_COORDINATES.lng + (j + 0.5) * TILE_DEGREES,
  );
}

function getDistanceFromPlayer(i: number, j: number): number {
  // distance from the current player position (may move with gamepad)
  return playerPosition.distanceTo(getCellCenter(i, j));
}

function latLngToCellID(lat: number, lng: number): string {
  const i = Math.floor(lat / TILE_DEGREES);
  const j = Math.floor(lng / TILE_DEGREES);
  return `${i},${j}`;
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
      if (cell.tokenValue! >= VICTORY_THRESHOLD && !victoryState) {
        // Player wins the game
        alert(
          "Congratulations! You've crafted a token of value 32 or more and won the game!",
        );
        victoryState = true;
      }
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
  const origin = ORIGIN_COORDINATES;

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

function updateVisibleCells(bounds: leaflet.LatLngBounds) {
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();

  const bottomLeftCellID = latLngToCellID(south, west);
  const topRightCellID = latLngToCellID(north, east);

  const [iMin, jMin] = bottomLeftCellID.split(",").map(Number);
  const [iMax, jMax] = topRightCellID.split(",").map(Number);

  const visibleCells = new Set<string>();

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const cellID = `${i},${j}`;
      visibleCells.add(cellID);

      if (!grid[cellID]) {
        if (luck([i, j].toString()) < TOKEN_SPAWN_PROBABILITY) {
          createCell(i, j, true);
        } else {
          createCell(i, j, false);
        }
      }
    }
  }

  // Remove cells that are no longer visible
  for (const cellID in grid) {
    if (!visibleCells.has(cellID)) {
      const cell = grid[cellID];
      if (cell.rect) {
        map.removeLayer(cell.rect);
      }
      if (cell.tokenMarker) {
        map.removeLayer(cell.tokenMarker);
      }
      delete grid[cellID];
    }
  }
}

// Initial population of visible cells
const initialBounds = map.getBounds();
updateVisibleCells(initialBounds);

// Redraw grid after moving the map
map.on("moveend", () => {
  const bounds = map.getBounds();
  updateVisibleCells(bounds);
});
