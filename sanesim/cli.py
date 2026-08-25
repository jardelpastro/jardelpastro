"""Uso em linha de comando: roda a simulação e exporta o memorial.

    python -m sanesim.cli projeto.json -o memorial.xlsx
"""

from __future__ import annotations

import argparse
import sys

from .core.memorial import export_memorial
from .core.models import Project
from .core.simulation import SimulationError, simulate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sanesim", description="Simulador de redes de esgoto sanitário")
    parser.add_argument("project", help="arquivo de projeto (.json)")
    parser.add_argument("-o", "--output", default="memorial.xlsx",
                        help="memorial de cálculo de saída (.xlsx)")
    args = parser.parse_args(argv)

    project = Project.load(args.project)
    try:
        result = simulate(project)
    except SimulationError as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1

    print(f"Rede: {len(project.nodes)} nós, {len(project.pipes)} trechos, "
          f"{result.total_length_m:.1f} m")
    print(f"Taxa linear (c/ infiltração): {result.rate_start:.3f} / "
          f"{result.rate_end:.3f} l/s.km (ini/fim)")
    for msg in result.messages:
        print(f"AVISO: {msg}")
    for r in result.pipes:
        flag = " *" if r.violations else ""
        print(f"  {r.pipe:>6} {r.upstream}->{r.downstream}  DN{r.diameter_mm} "
              f"S={r.slope:.4f}  Qf={r.q_down_end:.2f} l/s  "
              f"y/D={r.yd_end:.2f}  V={r.v_end:.2f} m/s  "
              f"σ={r.tractive_pa:.2f} Pa{flag}")
        for v in r.violations:
            print(f"          ! {v}")

    export_memorial(project, result, args.output)
    print(f"Memorial gravado em: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
