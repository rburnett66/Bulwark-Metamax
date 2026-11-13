#!/usr/bin/env python3
"""patch_farm_params.py — upsert rows of the Farm_Params sheet in the map-data workbook [MM-story_mwef343d_b].

    python tools/economy/patch_farm_params.py      # rewrites the ROWS below on Farm_Params
    python tools/extract_mapdata.py                # → MAPDATA.farmParams.<Param>

Owner 2026-11-12: "farm plot prepping should take 2 seconds, planting should take 2 seconds". Prep_Sec 120 → 2
(planting is the avatar's work time, src/farm/view/avatarQueue.js). The same header-name, byte-identical-elsewhere,
idempotent patch as patch_outpost_params.py (LibreOffice is not on this machine, so write_farm_sheets.py cannot
recalculate; its rows carry the same values).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import patch_outpost_params as P  # noqa: E402

P.SHEET = "Farm_Params"
P.ROWS = {
    "Plot_Gold": (100, "gold", "placing a plot, the farm's one gold charge; owner 2026-11-13: 'Charge for dropping the plot, do not charge for prep' [MM-story_mwf605xu_2]"),
    "Prep_Gold": (0, "gold", "prepping is free (was 100); owner 2026-11-13: 'Charge for dropping the plot, do not charge for prep' [MM-story_mwf605xu_2]"),
    "Prep_Sec": (2, "s", "prep time of a Traditional plot (§5.1); owner 2026-11-12: 'farm plot prepping should take 2 seconds'"),
    "Pods_Per_Plot": (16, "count", "one pod per plant, 16 plants a full plot; owner 2026-11-12: '1 pod = 1 plant' "
                      "[MM-story_mwelnbfc_1] (was one pod per row of a 4-row plot, D36)"),
}

if __name__ == "__main__":
    P.main(sys.argv[1] if len(sys.argv) > 1 else P.XLSX)
