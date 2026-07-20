"""
CONFIG — every tunable in the terrain pipeline, in one place.

Nothing in the pipeline modules hard-codes a number; they all read from here.
Each setting lists what it does, a sane range, and what breaks if you push it.

Read order if you are tuning for the first time:
    1. SCALE        pick CELL first - everything else is derived from it
    2. HEIGHT       the voxel step ladder (the visual language)
    3. MATERIALS    surface pattern per material
    4. RELIEF       how hard the faces read
    5. BOUNDARY     how much the digicam dithers each material's edge
    6. GROVE        tree placement + jitter
"""

# =============================================================== 1. SCALE
# CELL is the master. Change it and grain, jitter, canopy width, path width and
# face heights all rescale together, because they are all expressed in CELL.
CELL = 96          # px per world cell.       range 64-192. Below 64 the digicam
                   #                          block goes sub-pixel (assert fires).
VPC = 8            # voxels per cell on UNITS. Match your voxel tool's export.
DIGI_PER_VOXEL = 4 # digicam blocks per unit voxel. Ground detail is this many
                   # times finer than the man-made units.  range 2-6.

VOXEL = CELL / VPC                  # unit voxel size in px
DIGI = VOXEL / DIGI_PER_VOXEL       # digicam block size in px  (>=2 required)

SEED = 7           # master seed. Same seed -> byte-identical bake.


# =============================================================== 2. DEPTH TABLE
# The map is a HEIGHT MAP. Material is a FUNCTION OF LEVEL, not the reverse.
# That inversion is what makes "grass drops one level -> becomes dirt" happen
# automatically instead of being a special case, and it is what cliff rules
# are built on.
#
# Every height is an integer multiple of U. Where the ground drops N units
# toward the player, the exposed face is exactly N*U px tall and HARD EDGED.
U = 3              # micro-unit in px. range 2-4.

# level -> the normal material for ground sitting at that level.
# Add levels above STANDARD for highlands, below WATER_TABLE for deeps.
LEVELS = {
     3: "rock",    #  +9px  highland / cliff top - bare rock above the soil line
     2: "grass",   #  +6px  STANDARD TERRAIN  <-- the reference surface
     1: "dirt",    #  +3px  exposed soil: worn paths, and grass dropped one level
     0: "rock",    #   0px  bedrock
    -1: "water",   #  -3px  water table
}
STANDARD_LEVEL = 2      # where untouched terrain sits. grass by default.
WATER_TABLE_LEVEL = -1  # ground at or below this level is water.

# Resulting steps (px), all one unit apart in the soil column:
#   grass(2) -> dirt(1)   3px      dirt(1) -> rock(0)   3px
#   dirt(1)  -> water(-1) 6px  = exactly 2x the grass step
#   grass(2) -> water(-1) 9px

# TERRACING. No single face may exceed MAX_STEP_UNITS. Deeper drops are
# STAGGERED into that many one-unit steps as concentric bands, so every face on
# the map is the same height. Each band picks up the material for ITS level
# from the table above - which is where grass->dirt on a step down comes from.
MAX_STEP_UNITS = 1     # max units per face. 1 = fully staggered. 0 = off.
TERRACE_BAND_PX = 9    # width of each terrace band in px. 5-18.
                       # Narrow = tight shelf. Wide = a broad bank/beach.
TERRACE_TARGETS = ["water", "rock"]   # deep materials whose surrounds terrace

# CLIFFS. A cliff is the deliberate exception to terracing: it keeps its full
# drop as ONE tall face instead of staggering into shelves. That is what makes
# it read as a cliff rather than a slope.
CLIFF_CODES = {3}            # terrain codes authored as cliffs
CLIFF_DROP_UNITS = 3         # how far a cliff falls, in units. 2-5.
CLIFF_FACE_MATERIAL = "rock" # exposed cliff face is bare rock
CLIFF_TOP_LEVEL = 3          # level of the ground on top of a cliff
CLIFF_NO_TERRACE = True      # exempt cliffs from staggering (keeps them sheer)

# =============================================================== 3. MATERIALS
# Surface pattern per material. Three independent characters come from three
# dials: tone span, block size, and patch clumping.
#
#   n        number of tone steps.            2-4. More = richer, needs a
#                                             NARROW span or it reads noisy.
#   v_min    value multiplier of the darkest  0.60-0.98. Lower = wider span.
#            tone (1.0 = same as base)        Wide span reads ROUGH.
#   s_mult   saturation multiplier applied    1.00-1.20. >1 keeps darks rich
#            progressively as tones darken    instead of muddy grey.
#   weights  share of surface per tone        base-dominant reads calmer.
#   block    grain size in DIGI blocks        0.5-3.0. Small = fine variation,
#                                             large = coarse chunks/clumps.
#   patch    ONE tone index clusters into     None = uniform noise.
#            low-frequency patches            {"tone":i,"cells":f,"boost":f}
#              cells  patch size in cells     1.0-2.5
#              boost  clump strength          0.4-1.0. Above ~0.9 reads blotchy.
#   dither   how much the digicam dithers     0.15-1.0. Rule: INVERSE to step
#            THIS material's boundary         depth. A material far below its
#                                             neighbours needs a CLEAN edge, or
#                                             every speck becomes a full-depth
#                                             face and reads as shoreline noise.
MATERIALS = {
    "rock": dict(
        base=(128, 124, 118), n=3, v_min=0.66, s_mult=1.14,
        weights=[0.42, 0.34, 0.24], block=2.0, patch=None, dither=0.45,
    ),
    "dirt": dict(
        base=(120, 86, 50), n=3, v_min=0.92, s_mult=1.03,
        weights=[0.55, 0.28, 0.17], block=1.0, patch=None, dither=1.00,
    ),
    "grass": dict(
        base=(104, 142, 66), n=3, v_min=0.88, s_mult=1.05,
        weights=[0.60, 0.26, 0.14], block=1.0,
        patch={"tone": 2, "cells": 1.5, "boost": 0.85}, dither=1.00,
    ),
    "water": dict(
        base=(74, 126, 168), n=3, v_min=0.86, s_mult=1.06,
        weights=[0.58, 0.28, 0.14], block=2.0,
        patch={"tone": 2, "cells": 2.0, "boost": 0.70}, dither=0.22,
    ),
}
MATS = ["grass", "dirt", "rock", "water"]     # draw/index order

# derived: material -> its canonical (lowest) level, for legacy callers
HEIGHT_UNITS = {}
for _lv in sorted(LEVELS):
    HEIGHT_UNITS.setdefault(LEVELS[_lv], _lv)


# =============================================================== 4. RELIEF
# How hard the rigid faces read. All hard-edged; these only set intensity.
# Light direction, in degrees, measured as the direction the light COMES FROM,
# clockwise from screen-up:   0 = from the top      90 = from the right
#                           180 = from the bottom  270 = from the left
# 315 = from the TOP-LEFT (the default, and what the voxel units are lit with).
# A 45 degree diagonal is what gives cliffs consistent treatment: it puts an
# equal component on the vertical and horizontal faces, so a cliff edge reads
# the same whichever way it runs. Snap to 45/135/225/315 for balanced cliffs;
# 0/90/180/270 makes one axis go flat.
LIGHT_FROM_DEG = 315.0
SUN_FROM_TOP_LEFT = True   # legacy flag, kept for older scripts

# A side (east/west) face is seen edge-on at this camera tilt, so it is
# foreshortened relative to a front (north/south) face. This is what makes a
# cliff running north-south read at the same strength as one running east-west
# instead of collapsing to a 1px sliver.
SIDE_FACE_RATIO = 0.55     # side face extent / front face extent. 0.3-1.0

FACE_DARK = 0.55   # darkness of a player-facing face.  0.35-0.75
                   # this is the FAR-side seam (step down toward the player)
FACE_DEPTH_FULL = 4        # face depth in UNITS that reaches full darkness.
                           # deeper faces cap here. 3-6.
TOP_LIT = 0.20     # lift on the lit top edge of a riser (NEAR side). 0.10-0.30
                   # keep well below FACE_DARK - the near edge should stay quiet
LIT_BAND_RATIO = 1.0/3.0
                   # The bright band is NOT a face. The dark band is a real
                   # vertical face and is as tall as the drop. The bright band
                   # is only the REFLECTION ON THE CORNER where the lower block
                   # turns up to meet the light, so it must be much shorter.
                   # 1/3 of the dark transition. range 0.20-0.50.
                   # At U=3 a normal step gives a 3px dark band and a 1px
                   # bright corner; a 9px cliff gives 9px dark, 3px bright.
SIDE_DARK = 0.30   # east-facing one-px sliver.  0.15-0.45
SIDE_LIT = 0.22    # west-facing one-px sliver.  0.10-0.35


# =============================================================== 5. BOUNDARY
BOUNDARY_STRENGTH = 0.55   # global digicam dither at material edges. 0.3-0.8
                           # multiplied by each material's own `dither`.
PRESENCE_BLUR_CELLS = 0.8  # width of the transition band, in cells. 0.4-1.2
                           # this blur touches the MATERIAL field only, never
                           # the height field.

DESPECKLE = ["water", "rock"]   # deep materials get isolated pixels removed,
                                # so a stray speck can't cast a full-depth face
DESPECKLE_MIN_FRAC = 0.60  # keep a pixel if this fraction of its neighbourhood
                           # agrees. 0.45-0.70. Higher = more aggressive.
DESPECKLE_RADIUS = 2       # neighbourhood radius in px. 1-3
DESPECKLE_PASSES = 2       # 1-3

# Shoreline smoothing. THIS is what puts the high-contrast seam on the FAR side
# only. A ragged outline has local spots where land sits above water even along
# the near shore, and each one draws a full-depth face there -- which reads as
# noise and destroys the far/near asymmetry. Closing+opening the deep material's
# outline removes those inversions.
#   measured on a test lake, kernel px -> far/near face ratio:
#       0 -> 2.9x     5 -> 4.0x     9 -> 8.7x
SHORE_SMOOTH = ["water", "rock"]
SHORE_SMOOTH_PX = 9        # kernel size in px. 0 = off. 5-13.
                           # Larger = smoother coastline, less dithered detail.
                           # Above ~15 small ponds start dissolving.

PATH_TRAFFIC_THRESHOLD = 0.16  # normalised traffic above which a cell becomes
                               # worn dirt. 0.08-0.30. Lower = wider lanes.


# =============================================================== 6. GROVE
# Tree placement. All deterministic from SEED - baker and runtime placer call
# the same functions and cannot drift apart.
BROAD_SCALE = 0.16   # canopy-swell frequency. LOW = broad organic swells.
                     # 0.08-0.30. Raise for choppier, more varied heights.
JITTER_X = 0.22      # max x offset as a fraction of CELL. 0.0-0.30
                     # CANOPY_W_MULT must cover 2*JITTER_X or slits appear.
JITTER_Y = 0.10      # max y offset. KEEP BELOW JITTER_X - y feeds the depth
                     # sort and can open gaps in the top-edge rank. 0.0-0.15
Y_BIAS_TOP = 0.5     # top-edge caps bias downward only, so a cap can never
                     # pull up off the grove mass. 0.0-1.0
Z_VARIANCE = 0.10    # per-tree height variance, +/- fraction. 0.05-0.20
BASE_H_CELLS = 2.0   # nominal tree height in cells. 1.5-3.0
CAP_RATIO = 0.82     # canopy-cap height as a fraction of a full tree. 0.7-0.9
CANOPY_W_MULT = 1.45 # canopy width as a multiple of CELL.
                     # HARD REQUIREMENT: >= 1 + 2*JITTER_X, else adjacent caps
                     # separate and you get vertical slits in the rank.

TREE_CODES = {4, 7}  # terrain codes that count as grove cells

# PRODUCTION OUTPUT
BAKE_INCLUDE_RANK = False  # False = leave the top-edge/isolated trees OUT of the
                           # bake and export them as runtime sprites instead, so
                           # units can pass behind them. True only for previews.
TILE_PX = 1024             # bake is sliced into tiles this size. Must be <= the
                           # smallest GPU texture limit you target (2048 is safe
                           # on all mobile; 4096 on most).
RING_COUNT = 8             # waves per map; the playable area grows one ring per
                           # wave, so tiles carry the earliest ring that needs them

# terrain code -> LEVEL. This is the authored input; the material at each
# location then follows from the LEVELS table, so a code never contradicts the
# stratigraphy. Codes that mean "normal ground" simply map to STANDARD_LEVEL.
CODE2LEVEL = {
    0:  2,   # grass      -> standard
    1:  1,   # dirt       -> one below standard (exposed soil)
    2:  1,   # soil       -> one below standard
    3:  3,   # cliff      -> cliff top (see CLIFF_* above)
    4:  2,   # dense trees-> standard (grove floor)
    5: -1,   # deep water -> water table
    6:  2,   # brush      -> standard
    7:  2,   # scrub      -> standard
    8:  0,   # rocks      -> bedrock exposed
    9: -1,   # shore water-> water table
}
# legacy name kept so older scripts still import cleanly
CODE2MAT = {c: LEVELS[l] for c, l in CODE2LEVEL.items()}


# =============================================================== validation
def check():
    """Fail loudly on settings that silently produce bad art."""
    errs = []
    if DIGI < 2:
        errs.append(f"DIGI {DIGI:.2f}px is sub-pixel — raise CELL to at least "
                    f"{int(2*VPC*DIGI_PER_VOXEL)}")
    need = 1 + 2*JITTER_X
    if CANOPY_W_MULT < need:
        errs.append(f"CANOPY_W_MULT {CANOPY_W_MULT} < {need:.2f} — x-jitter will "
                    f"open slits between adjacent canopy caps")
    if JITTER_Y > JITTER_X:
        errs.append(f"JITTER_Y {JITTER_Y} > JITTER_X {JITTER_X} — y-jitter feeds "
                    f"the depth sort; keep it smaller")
    if TOP_LIT >= FACE_DARK:
        errs.append(f"TOP_LIT {TOP_LIT} >= FACE_DARK {FACE_DARK} — the near edge "
                    f"will compete with the far-side seam")
    for n, m in MATERIALS.items():
        if len(m["weights"]) != m["n"]:
            errs.append(f"{n}: {len(m['weights'])} weights for {m['n']} tones")
        if m["patch"] and m["patch"]["tone"] >= m["n"]:
            errs.append(f"{n}: patch tone {m['patch']['tone']} out of range")
    for n in MATS:
        if n not in HEIGHT_UNITS: errs.append(f"{n}: no HEIGHT_UNITS entry")
        if n not in MATERIALS:    errs.append(f"{n}: no MATERIALS entry")
    if errs:
        raise ValueError("config problems:\n  " + "\n  ".join(errs))
    return True


def summary():
    lines = [f"CELL {CELL}px | unit voxel {VOXEL:.0f}px | digicam block {DIGI:.0f}px "
             f"({DIGI_PER_VOXEL}x finer than units)",
             f"micro-unit U = {U}px    height ladder (px): "
             + ", ".join(f"{n} {HEIGHT_UNITS[n]*U:+d}" for n in MATS)]
    steps = []
    for a in MATS:
        for b in MATS:
            if a < b:
                steps.append(f"{a}->{b} {abs(HEIGHT_UNITS[a]-HEIGHT_UNITS[b])*U}px")
    lines.append("steps: " + "  ".join(steps))
    return "\n".join(lines)


if __name__ == "__main__":
    check()
    print(summary())
    print("\nconfig OK")
