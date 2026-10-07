var myGarden;

var mouseOverCanvas = true;

var DEBUG = false;
var toolRadius = 100; // size of the tool circle around the mouse (mouse wheel or pinch changes it)
var TOOL_RADIUS_MIN = 30;
var TOOL_RADIUS_MAX = 500;
var touchPinched = false; // true while the current touch involves (or involved) a second finger
var pinchAnchor = null; // garden position where the tool circle is frozen since the last pinch (null = follows the mouse/finger)
var toolMode = 'water'; // 'water': hovering boosts growth / 'cut': left click removes plants; right click toggles
var TOOL_COLORS = { water: [5, 30, 95], cut: [90, 10, 10] };
var PERSPECTIVE = 0.40; // 1 = circular/top-down; smaller = flatter, more angled ground-plane ellipse

var DEFAULT_TEXT_SIZE = 100; // font size for a ?text=... without a size
var RND_SIZE_MIN = 60; // size "rnd" picks a font size in this range
var RND_SIZE_MAX = 160;
var LINE_SPACING = 1.1; // newline: distance between baselines = the line's size x this

var SIZE_MIN_FACTOR = 0.6; // a plant's maxSize stays within [SIZE_MIN_FACTOR, SIZE_MAX_FACTOR] x its letter's original size
var SIZE_MAX_FACTOR = 1.4;
var SIZE_MUTATION = 1 / 20; // a child's maxSize = parent's +/- up to this fraction
var GROW_DURATION_DEFAULT = 600; // seconds from seed to full size (without watering)
var GROW_DURATION_MIN = 120;
var GROW_DURATION_MAX = 1800;
var GROW_DURATION_MUTATION = 1 / 12; // a child's grow duration = parent's +/- up to this fraction
var COLOR_MUTATION = 25; // a child's r, g and b = parent's +/- up to this amount (0-255)

var SPREAD_RANGE_FACTOR = 0.8; // seeds land up to this x maxSize away from the parent
var INITIAL_SPREAD_RANGE_FACTOR = 0.6; // same, for the initially planted text (keeps it readable at first)
var SEEDS_MIN = 1; // number of scattered seeds per grown plant (besides its successor)
var SEEDS_MAX = 3;
var ALWAYS_PLANT_SUCCESSOR = false; // true: a grown plant is always replaced near its spot (keeps the text readable); false: only seeds that find space, so plants can die out
var SUCCESSOR_DRIFT_FACTOR = 1 / 8; // the successor lands up to this x maxSize away from its parent (ignores the space check)
var SPACE_OVERLAP_ALLOWANCE = 0.9; // a seed needs distance >= (sum of ground-circle radii) x this; 1 = ground circles may only touch, smaller = more overlap
var RARE_SPROUT_CHANCE = 1 / 30; // per second, for an extinct lineage (one lineage per letter of the original text)
var RARE_POPULATION_SCALE = 1.5; // how fast that chance fades with living plants: chance x e^(-count / scale); 1.5 -> 1: 51%, 2: 26%, 5: 4%
var FRUIT_SATURATION_BOOST = 1.5; // the fruiting outline is the plant's color at full brightness, with saturation multiplied by this

var GARDEN_STORAGE_KEY = 'gardenOfTextState'; // plant positions are relative to the screen center
var GARDEN_SAVE_INTERVAL = 5000; // ms
var TARGET_FPS = 30; // the garden moves slowly - more frames would mostly cost CPU/GPU
var MAX_FRAME_TIME = 0.1; // s; longer frames (e.g. after a backgrounded tab) count as this long, so nothing jumps
var gardenLineSignature = ''; // identifies which ?text=... params the saved garden belongs to
