import sys
from pathlib import Path

# Ensure both backend/ and project root are in sys.path
_backend_dir = Path(__file__).resolve().parent
_root_dir = _backend_dir.parent

for _p in (_backend_dir, _root_dir):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))
