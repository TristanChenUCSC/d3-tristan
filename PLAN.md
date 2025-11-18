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
- [x] implement crafting system
- [x] clean up and refactor code before finishing D3.a

## D3.b: Globe-spanning gameplay

Key technical challenge: Can you set up your implementation to support gameplay anywhere in the real world, not just locations near our classroom?
Key gameplay challenge: Can players craft an even higher value token by moving to other locations to get access to additional crafting materials?

### Steps

- [x] create buttons for player movement in the UI
- [x] implement logic for player movement
- [x] implement globe-spanning grid that generates and removes cells as player moves/scrolls
- [x] anchor the grid at Null Island
- [x] create victory threshold
- [x] clean up and refactor code before finishing D3.b

## D3.c: Object persistence

Key technical challenge: Can your software accurately remember the state of map cells even when they scroll off the screen?
Key gameplay challenge: Can you fix a gameplay bug where players can farm tokens by moving into and out of a region repeatedly to get access to fresh resources?

### Steps

- [x] apply flyweight pattern to limit how many cells are stored in memory
- [x] use memento pattern to preserve the state of modified cells
- [x] create cells that appear to keep their states even when they are off-screen
- [x] clean up and refactor code before finishing D3.c

## D3.d: Gameplay across real-world space and time

Key technical challenges: Can your software remember game state even when the page is closed? Is the player character’s in-game movement controlled by the real-world geolocation of their device?
Key gameplay challenge: Can the user test the game with multiple gameplay sessions, some involving real-world movement and some involving simulated movement?

### Steps

- [x] integrate browser geolocation API for geolocation-based movement
- [x] implement new player movement control system using the Facade design pattern
- [x] integrate browser localStorage API for game state to persist across page loads
- [ ] add button that allows player to start a new game
- [ ] add button that switches between button-based and geolocation-based movement
- [ ] clean up and refactor code before finishing D3.d
