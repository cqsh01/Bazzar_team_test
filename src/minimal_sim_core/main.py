from __future__ import annotations

import json

from .simulation_core import run_simulation


def main() -> None:
    metrics = run_simulation()
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
