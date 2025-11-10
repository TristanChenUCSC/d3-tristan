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

// Player Inventory Logic
let inventory: number | null = null;

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

updateInventoryUI();

// Cell data structure
interface Cell {
  hasToken: boolean;
  tokenValue: number | null;
  rect: leaflet.Rectangle;
  tokenMarker?: leaflet.Marker | undefined;
}

// Data representation of the grid
const grid: Record<string, Cell> = {};

// Function to create and add a rectangle for a cell at grid position (i, j)
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

    tokenMarker = leaflet.marker(center, {
      icon: tokenIcon,
      interactive: false,
    });

    tokenMarker.addTo(map);
  }

  grid[key] = {
    hasToken,
    tokenValue: hasToken ? 2 : null,
    rect,
    tokenMarker,
  };

  rect.on("click", () => handleCellClick(i, j));
}

function handleCellClick(i: number, j: number) {
  const key = `${i},${j}`;
  const cell = grid[key];

  const cellCenter = leaflet.latLng(
    CLASSROOM_COORDINATES.lat + (i + 0.5) * TILE_DEGREES,
    CLASSROOM_COORDINATES.lng + (j + 0.5) * TILE_DEGREES,
  );
  const distance = CLASSROOM_COORDINATES.distanceTo(cellCenter);

  if (distance > PLAYER_RANGE_METERS) {
    leaflet
      .popup()
      .setLatLng(cellCenter)
      .setContent("Too far away!")
      .openOn(map);
    return;
  }

  // Logic for clicking on a cell with a token
  if (cell.hasToken && cell.tokenValue !== null) {
    // If inventory is empty, pick up the token. Use popup and button to confirm
    if (inventory === null) {
      const popupDiv = document.createElement("div");
      const infoDiv = document.createElement("div");
      infoDiv.textContent =
        `You found a token with a value of ${cell.tokenValue}.`;
      const pickUpButton = document.createElement("button");
      pickUpButton.textContent = "Pick Up Token";

      popupDiv.appendChild(infoDiv);
      popupDiv.appendChild(pickUpButton);

      pickUpButton.addEventListener("click", () => {
        inventory = cell.tokenValue;
        updateInventoryUI();
        cell.hasToken = false;
        cell.tokenValue = null;
        if (cell.tokenMarker) {
          map.removeLayer(cell.tokenMarker);
          cell.tokenMarker = undefined;
        }
        map.closePopup();
      });

      leaflet
        .popup()
        .setLatLng(cellCenter)
        .setContent(popupDiv)
        .openOn(map);
      return;
    } // If inventory has a token of the same value, craft them together
    else if (cell.tokenValue === inventory) {
      const popupDiv = document.createElement("div");
      const infoDiv = document.createElement("div");
      infoDiv.textContent =
        `This token has the same value as your token (${inventory}).`;
      const craftButton = document.createElement("button");
      craftButton.textContent = "Craft them together";

      popupDiv.appendChild(infoDiv);
      popupDiv.appendChild(craftButton);

      craftButton.addEventListener("click", () => {
        cell.tokenValue! += inventory!;
        inventory = null;
        updateInventoryUI();
        if (cell.tokenMarker) {
          map.removeLayer(cell.tokenMarker);
        }
        const tokenIcon = leaflet.divIcon({
          className: "token-icon",
          html: `${cell.tokenValue}`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        cell.tokenMarker = leaflet.marker(cellCenter, {
          icon: tokenIcon,
          interactive: false,
        });
        cell.tokenMarker.addTo(map);
        map.closePopup();
      });

      leaflet
        .popup()
        .setLatLng(cellCenter)
        .setContent(popupDiv)
        .openOn(map);
      return;
    } // If inventory has a different token, do nothing
    else {
      leaflet
        .popup()
        .setLatLng(cellCenter)
        .setContent("Cannot be crafted with your token.")
        .openOn(map);
      return;
    }
  } // Logic for clicking an empty cell
  else {
    // If inventory is empty, show empty message
    if (inventory === null) {
      leaflet
        .popup()
        .setLatLng(cellCenter)
        .setContent("This is an empty Cell.")
        .openOn(map);
      return;
    } else {
      // Allow player to place token from inventory into the cell
      const popupDiv = document.createElement("div");
      const infoDiv = document.createElement("div");
      infoDiv.textContent = "You have a token. Place token here?";
      const placeButton = document.createElement("button");
      placeButton.textContent = "Place Token";

      popupDiv.appendChild(infoDiv);
      popupDiv.appendChild(placeButton);

      placeButton.addEventListener("click", () => {
        cell.hasToken = true;
        cell.tokenValue = inventory;
        inventory = null;
        updateInventoryUI();

        // Add token marker to the cell
        const tokenIcon = leaflet.divIcon({
          className: "token-icon",
          html: `${cell.tokenValue}`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        cell.tokenMarker = leaflet.marker(cellCenter, {
          icon: tokenIcon,
          interactive: false,
        });
        cell.tokenMarker.addTo(map);

        map.closePopup();
      });

      leaflet
        .popup()
        .setLatLng(cellCenter)
        .setContent(popupDiv)
        .openOn(map);
      return;
    }
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
