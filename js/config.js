// =================================
// Settings (only values to tweak - runtime state lives in the files that use it)
// =================================

// tools
var TOOL_RADIUS_DEFAULT = 100; // start size of the tool circle around the mouse (mouse wheel or pinch changes it)
var TOOL_RADIUS_MIN = 30;
var TOOL_RADIUS_MAX = 500;
var TOOL_COLORS = { water: [0.27, 0.12, 264], cut: [0.30, 0.11, 27] }; // OKLCH: [lightness 0-1, chroma 0-0.4, hue 0-360]
var WATER_BOOST = 20; // growth multiplier under the water circle (and while holding "G" in debug mode)

// text
var DEFAULT_TEXT_SIZE = 100; // font size for a ?text=... without a size
var RND_SIZE_MIN = 60; // size "rnd" picks a font size in this range
var RND_SIZE_MAX = 160;
var LINE_SPACING = 1.1; // newline: distance between baselines = the line's size x this

// plant genes
var SIZE_MIN_FACTOR = 0.6; // a plant's maxSize stays within [SIZE_MIN_FACTOR, SIZE_MAX_FACTOR] x its letter's original size
var SIZE_MAX_FACTOR = 1.4;
var SIZE_MUTATION = 1 / 20; // a child's maxSize = parent's +/- up to this fraction
var GROW_DURATION_DEFAULT = 600; // seconds from seed to full size (without watering)
var GROW_DURATION_MIN = 120;
var GROW_DURATION_MAX = 1800;
var GROW_DURATION_MUTATION = 1 / 12; // a child's grow duration = parent's +/- up to this fraction
var HUE_MUTATION = 10; // a child's hue = parent's +/- up to this many degrees (a new lineage gets a random hue)
var MATURING_START = 0.8; // fraction of its full size at which a plant starts fruiting

// spreading
var SPREAD_RANGE_FACTOR = 0.8; // seeds land up to this x maxSize away from the parent
var INITIAL_SPREAD_RANGE_FACTOR = 0.6; // same, for the initially planted text (keeps it readable at first)
var SEEDS_MIN = 1; // number of scattered seeds per grown plant (besides its successor)
var SEEDS_MAX = 3;
var ALWAYS_PLANT_SUCCESSOR = false; // true: a grown plant is always replaced near its spot (keeps the text readable); false: only seeds that find space, so plants can die out
var SUCCESSOR_DRIFT_FACTOR = 1 / 8; // the successor lands up to this x maxSize away from its parent (ignores the space check)
var SPACE_OVERLAP_ALLOWANCE = 0.9; // a seed needs distance >= (sum of ground-circle radii) x this; 1 = ground circles may only touch, smaller = more overlap

// rare lineages
var RARE_SPROUT_CHANCE = 1 / 30; // per second, for an extinct lineage (one lineage per letter of the original text)
var RARE_POPULATION_SCALE = 1.5; // how fast that chance fades with living plants: chance x e^(-count / scale); 1.5 -> 1: 51%, 2: 26%, 5: 4%

// drawing
var PERSPECTIVE = 0.40; // 1 = circular/top-down; smaller = flatter, more angled ground-plane ellipse
var BACKGROUND_COLOR = 'oklch(0.19 0 0)'; // all colors are OKLCH: lightness 0-1, chroma 0-0.4, hue 0-360
var GROUND_FILL = 'oklch(0.28 0 0)'; // a plant's ground ellipse
var GROUND_OUTLINE = 'oklch(0.43 0 0)'; // its outline
var PLANT_LIGHTNESS = 0.65; // the same for all plants - only the hue differs
var PLANT_CHROMA = 0.15;
var TILT_MAX = 8; // degrees; each letter is tilted randomly by up to this, left or right
var FRUIT_OUTLINE_MAX = 5; // px; thickness of the fruiting outline when a plant is fully grown
var FRUIT_LIGHTNESS = 0.78; // the fruiting outline is the plant's hue with this lightness and chroma
var FRUIT_CHROMA = 0.2;

// performance & saving
var TARGET_FPS = 30; // the garden moves slowly - more frames would mostly cost CPU/GPU
var MAX_FRAME_TIME = 0.1; // s; longer frames (e.g. after a backgrounded tab) count as this long, so nothing jumps
var GARDEN_STORAGE_KEY = 'gardenOfTextState'; // plant positions are relative to the screen center
var GARDEN_SAVE_INTERVAL = 5000; // ms
