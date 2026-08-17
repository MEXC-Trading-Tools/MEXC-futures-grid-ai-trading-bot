#!/usr/bin/env bash
# Art direction: "Funding tape / AI HUD" — see render.py.
# Distinct from the sibling spot-grid 3D donut/bar canvas kit.
set -euo pipefail
cd "$(dirname "$0")"
python3 render.py
