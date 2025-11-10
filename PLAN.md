# D3: World of Bits

# Game Design Vision

World of Bits is a browser based token merging game that will incorporate elements from both 4096 and Pokemon GO. It will feature a map of the real world as a grid in addition to the player's real time location. Players should be able to move around in the world to collect tokens and craft them into tokens of higher value.

# Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

# Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?
Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### Steps

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] add visible content to cells
- [x] make cells clickable
- [x] implement randomized token spawning using luck function
- [x] implement player range for interacting with cells
- [x] implement token pick-up system that removes the token from the cell
- [x] make a player inventory
- [ ] implement crafting system
- [ ] clean up and refactor code before finishing D3.a
