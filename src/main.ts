// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./_leafletWorkaround.ts";

// Import luck function
import luck from "./_luck.ts";

// === Flyweight Implementation ===

// Intrinsic state
interface Cell {
  hasToken: boolean;
  tokenValue: number | null;
}

// Extrinsic visuals stored in maps
const cellRects: Map<string, leaflet.Rectangle> = new Map();
const cellTokenMarkers: Map<string, leaflet.Marker> = new Map();

// === Memento Implementation ===

// Memento class for storing snapshot of cell state
class CellMemento {
  hasToken: boolean;
  tokenValue: number | null;

  constructor(cell: Cell) {
    this.hasToken = cell.hasToken;
    this.tokenValue = cell.tokenValue;
  }
}

// Caretaker for tracking mementos of modified cells
class ModifiedCells {
  private mementos: Map<string, CellMemento> = new Map();

  save(cellID: string, cell: Cell) {
    this.mementos.set(cellID, new CellMemento(cell));
  }

  restore(cellID: string): Cell | null {
    const memento = this.mementos.get(cellID);
    if (memento) {
      return {
        hasToken: memento.hasToken,
        tokenValue: memento.tokenValue,
      };
    } else {
      return null;
    }
  }

  // Clear all saved mementos
  clear(): void {
    this.mementos.clear();
  }
}

const modifiedCells = new ModifiedCells();

// === Facade Implementation ===

// Facade
interface MovementController {
  start(): void;
  stop(): void;
  onMove(callback: (dLat: number, dLng: number) => void): void;
}

// Geolocation-based movement controller
class GeolocationMovementController implements MovementController {
  private callback: ((dLat: number, dLng: number) => void) | null = null;
  private watchID: number | null = null;

  start() {
    if (navigator.geolocation) {
      this.watchID = navigator.geolocation.watchPosition(
        (position) => {
          if (this.callback) {
            this.callback(position.coords.latitude, position.coords.longitude);
          }
        },
        (error) => console.error("Geolocation error:", error),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
      );
    }
  }

  stop() {
    if (this.watchID !== null) {
      navigator.geolocation.clearWatch(this.watchID);
      this.watchID = null;
    }
  }

  onMove(callback: (dLat: number, dLng: number) => void) {
    this.callback = callback;
  }
}

// Button-based movement controller
class ButtonMovementController implements MovementController {
  private callback: ((dLat: number, dLng: number) => void) | null = null;
  private step: number = TILE_DEGREES;

  constructor(
    private upButton: HTMLButtonElement,
    private downButton: HTMLButtonElement,
    private leftButton: HTMLButtonElement,
    private rightButton: HTMLButtonElement,
  ) {}

  start() {
    this.upButton.addEventListener("click", this.moveUp);
    this.downButton.addEventListener("click", this.moveDown);
    this.leftButton.addEventListener("click", this.moveLeft);
    this.rightButton.addEventListener("click", this.moveRight);
  }

  stop() {
    this.upButton.removeEventListener("click", this.moveUp);
    this.downButton.removeEventListener("click", this.moveDown);
    this.leftButton.removeEventListener("click", this.moveLeft);
    this.rightButton.removeEventListener("click", this.moveRight);
  }

  onMove(callback: (dLat: number, dLng: number) => void) {
    this.callback = callback;
  }

  private move = (dLat: number, dLng: number) => {
    if (this.callback) {
      this.callback(dLat, dLng);
    }
  };

  private moveUp = () => this.move(this.step, 0);
  private moveDown = () => this.move(-this.step, 0);
  private moveLeft = () => this.move(0, -this.step);
  private moveRight = () => this.move(0, this.step);
}

// === Game State ===

// Location of Grid Origin
const ORIGIN_COORDINATES = leaflet.latLng(0, 0);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const TOKEN_SPAWN_PROBABILITY = 0.15;
const DEFAULT_TOKEN_VALUE = 2;
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

// Gamepad UI
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

statusPanelDiv.appendChild(gamepad);

// New Game button: clears persisted state and mementos, then reloads the page
const newGameButton = document.createElement("button");
newGameButton.id = "newGameButton";
newGameButton.textContent = "New Game";
controlPanelDiv.appendChild(newGameButton);
newGameButton.addEventListener("click", () => {
  // Clear persisted game state and in-memory mementos
  localStorage.removeItem("gameState");
  modifiedCells.clear();

  // Reload the page to start a fresh session
  location.reload();
});

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

function movePlayer(lat: number, lng: number) {
  playerPosition = leaflet.latLng(lat, lng);
  playerMarker.setLatLng(playerPosition);
  playerRangeCircle.setLatLng(playerPosition);
  // Optionally pan the map to keep player in view
  map.panTo(playerPosition);
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

// === Cell modifying actions ===

function pickUpToken(cellCenter: leaflet.LatLng, cell: Cell, cellID: string) {
  createPopup(
    cellCenter,
    `You found a token with a value of ${cell.tokenValue}.`,
    "Pick Up Token",
    () => {
      inventory = cell.tokenValue;
      updateInventoryUI();
      cell.hasToken = false;
      cell.tokenValue = null;
      if (cellTokenMarkers.has(cellID)) {
        const marker = cellTokenMarkers.get(cellID);
        map.removeLayer(marker!);
        cellTokenMarkers.delete(cellID);
      }
      modifiedCells.save(cellID, cell);
      map.closePopup();
    },
  );
}

function craftToken(cellCenter: leaflet.LatLng, cell: Cell, cellID: string) {
  createPopup(
    cellCenter,
    `This token has the same value as your token (${inventory}).`,
    "Craft them together",
    () => {
      cell.tokenValue! += inventory!;
      if (cell.tokenValue! >= VICTORY_THRESHOLD && !victoryState) {
        // Player wins the game
        alert(
          `Congratulations! You've crafted a token of value ${VICTORY_THRESHOLD} or more and won the game!`,
        );
        victoryState = true;
      }
      inventory = null;
      updateInventoryUI();
      if (cellTokenMarkers.has(cellID)) {
        const marker = cellTokenMarkers.get(cellID);
        map.removeLayer(marker!);
      }
      const newTokenMarker = createTokenMarker(
        cell.tokenValue!,
        cellCenter,
        map,
      );
      cellTokenMarkers.set(cellID, newTokenMarker);
      modifiedCells.save(cellID, cell);
      map.closePopup();
    },
  );
}

function placeToken(cellCenter: leaflet.LatLng, cell: Cell, cellID: string) {
  createPopup(
    cellCenter,
    "You have a token. Place token here?",
    "Place Token",
    () => {
      cell.hasToken = true;
      cell.tokenValue = inventory;
      inventory = null;
      updateInventoryUI();
      const newTokenMarker = createTokenMarker(
        cell.tokenValue!,
        cellCenter,
        map,
      );
      cellTokenMarkers.set(cellID, newTokenMarker);
      modifiedCells.save(cellID, cell);
      map.closePopup();
    },
  );
}

// === Main Game Logic ===

// Movement controllers
const geoMovement: MovementController = new GeolocationMovementController();
geoMovement.onMove((lat, lng) => {
  movePlayer(lat, lng);
});

const buttonMovement: MovementController = new ButtonMovementController(
  upButton,
  downButton,
  leftButton,
  rightButton,
);
buttonMovement.onMove((dLat, dLng) => {
  movePlayer(playerPosition.lat + dLat, playerPosition.lng + dLng);
});

geoMovement.start();
buttonMovement.start();

// Player Inventory
let inventory: number | null = null;
updateInventoryUI();

// Grid data structures for cell memory
const grid: Map<string, Cell> = new Map();

// Function to create a cell
function createCell(i: number, j: number, cell: Cell) {
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
  cellRects.set(key, rect);

  let tokenMarker: leaflet.Marker | undefined = undefined;
  if (cell.hasToken) {
    // Add visible token marker in the center of the cell
    const center = getCellCenter(i, j);
    tokenMarker = createTokenMarker(cell.tokenValue!, center, map);
    cellTokenMarkers.set(key, tokenMarker);
  }

  rect.on("click", () => handleCellClick(i, j));

  grid.set(key, cell);
}

// Function to handle cell clicks
function handleCellClick(i: number, j: number) {
  const key = `${i},${j}`;
  const cell = grid.get(key)!;
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
      pickUpToken(cellCenter, cell, key);
      return;
    } // If inventory has a token of the same value, craft them together
    else if (cell.tokenValue === inventory) {
      craftToken(cellCenter, cell, key);
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
      placeToken(cellCenter, cell, key);
      return;
    }
  }
}

// Function to update visible cells based on map bounds
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

      // Restore modified cell
      const restoredCell = modifiedCells.restore(cellID);

      if (grid.has(cellID)) {
        if (restoredCell) {
          // Update existing cell's state to restored state
          const cell = grid.get(cellID)!;
          cell.hasToken = restoredCell.hasToken;
          cell.tokenValue = restoredCell.tokenValue;

          // Update marker
          if (cellTokenMarkers.has(cellID)) {
            map.removeLayer(cellTokenMarkers.get(cellID)!);
            cellTokenMarkers.delete(cellID);
          }

          if (cell.hasToken) {
            const center = getCellCenter(i, j);
            const tokenMarker = createTokenMarker(
              cell.tokenValue!,
              center,
              map,
            );
            cellTokenMarkers.set(cellID, tokenMarker);
          }
        }

        continue;
      }

      // Create cell from restored state if it exists
      if (restoredCell) {
        createCell(i, j, restoredCell);
        continue;
      }

      // If cell has never been modified, create it with default logic
      const spawnWithToken = luck([i, j].toString()) < TOKEN_SPAWN_PROBABILITY;
      if (spawnWithToken) {
        createCell(i, j, { hasToken: true, tokenValue: DEFAULT_TOKEN_VALUE });
      } else {
        createCell(i, j, { hasToken: false, tokenValue: null });
      }
    }
  }

  // Remove cells that are no longer visible
  for (const cellID of grid.keys()) {
    if (!visibleCells.has(cellID)) {
      if (cellRects.has(cellID)) {
        map.removeLayer(cellRects.get(cellID)!);
        cellRects.delete(cellID);
      }

      if (cellTokenMarkers.has(cellID)) {
        map.removeLayer(cellTokenMarkers.get(cellID)!);
        cellTokenMarkers.delete(cellID);
      }

      grid.delete(cellID);
    }
  }
}

// Initial population of visible cells
const initialBounds = map.getBounds();
updateVisibleCells(initialBounds);

// === Event Listeners ===

// Redraw grid if the map is moved
map.on("moveend", () => {
  const bounds = map.getBounds();
  updateVisibleCells(bounds);
});

// Save game state when the page is unloaded
globalThis.addEventListener("beforeunload", () => {
  saveGameState();
});

// Load game state when the page is loaded
globalThis.addEventListener("load", () => {
  loadGameState();
});

// === Save/Load Game State ===

function saveGameState() {
  const gameState = {
    playerPosition: {
      lat: playerPosition.lat,
      lng: playerPosition.lng,
    },
    inventory: inventory,
    modifiedCells: Array.from(
      modifiedCells["mementos"].entries().map(
        (
          [cellID, memento],
        ) => [cellID, {
          hasToken: memento.hasToken,
          tokenValue: memento.tokenValue,
        }],
      ),
    ),
    victoryState: victoryState,
  };

  localStorage.setItem("gameState", JSON.stringify(gameState));
}

function loadGameState() {
  const savedState = localStorage.getItem("gameState");
  if (savedState) {
    const gameState = JSON.parse(savedState);

    movePlayer(gameState.playerPosition.lat, gameState.playerPosition.lng);
    inventory = gameState.inventory;
    updateInventoryUI();
    victoryState = gameState.victoryState;

    for (const [cellID, cellData] of gameState.modifiedCells) {
      modifiedCells["mementos"].set(cellID, new CellMemento(cellData));
    }

    const bounds = map.getBounds();
    updateVisibleCells(bounds);
  }
}
