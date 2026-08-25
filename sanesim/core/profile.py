"""Perfil longitudinal: caminhos de desenho e geometria.

O perfil é desenhado sempre de montante (esquerda) para jusante
(direita). Um "caminho" é uma sequência de trechos consecutivos — a
partir de cada nó de cabeceira, segue-se o fluxo até o fim da rede.
A lâmina d'água calculada (fim de plano) é representada dentro do tubo.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .models import Project
from .simulation import PipeResult, SimulationResult


@dataclass
class ProfilePath:
    label: str
    pipes: list[PipeResult] = field(default_factory=list)

    @property
    def length(self) -> float:
        return sum(r.length for r in self.pipes)


def build_paths(result: SimulationResult) -> list[ProfilePath]:
    """Um caminho por cabeceira: segue o fluxo até o fim da rede.

    Em junções, continua pelo trecho de jusante do nó de chegada (se
    houver mais de um trecho saindo, segue o primeiro na ordem de
    cálculo). Montante fica sempre à esquerda.
    """
    by_upstream: dict[str, list[PipeResult]] = {}
    has_incoming: set[str] = set()
    for r in result.pipes:
        by_upstream.setdefault(r.upstream, []).append(r)
        has_incoming.add(r.downstream)

    heads = [r.upstream for r in result.pipes
             if r.upstream not in has_incoming]
    # remove duplicatas preservando a ordem de cálculo
    heads = list(dict.fromkeys(heads))

    paths: list[ProfilePath] = []
    for head in heads:
        pipes: list[PipeResult] = []
        node = head
        seen: set[str] = set()
        while node in by_upstream and node not in seen:
            seen.add(node)
            r = by_upstream[node][0]
            pipes.append(r)
            node = r.downstream
        if pipes:
            label = f"{pipes[0].upstream} → {pipes[-1].downstream}"
            if pipes[0].network:
                label = f"[{pipes[0].network}] {label}"
            paths.append(ProfilePath(label=label, pipes=pipes))
    return paths


def build_ose_paths(project: Project,
                    result: SimulationResult) -> list[ProfilePath]:
    """Caminhos por OSE — um por ramal contínuo da OSE."""
    from .ose import ose_pipe_results, split_runs
    paths = []
    for ose in project.oses:
        pipes = ose_pipe_results(project, result, ose)
        runs = split_runs(pipes)
        for i, run in enumerate(runs):
            label = f"OSE {ose.number or '?'}"
            if len(runs) > 1:
                label += f" (ramal {i + 1})"
            label += f": {run[0].upstream} → {run[-1].downstream}"
            paths.append(ProfilePath(label=label, pipes=run))
    return paths


@dataclass
class ProfileSegment:
    """Geometria de um trecho no perfil (coordenadas em m, x acumulado)."""
    pipe: PipeResult
    x0: float
    x1: float
    ground0: float
    ground1: float
    invert0: float
    invert1: float
    crown0: float        # geratriz superior
    crown1: float
    water0: float        # nível d'água (fim de plano)
    water1: float


def build_geometry(path: ProfilePath) -> list[ProfileSegment]:
    segments: list[ProfileSegment] = []
    x = 0.0
    for r in path.pipes:
        d = r.diameter_mm / 1000.0
        yd = min(max(r.yd_end, 0.0), 1.0)
        segments.append(ProfileSegment(
            pipe=r,
            x0=x, x1=x + r.length,
            ground0=r.ground_up, ground1=r.ground_down,
            invert0=r.invert_up, invert1=r.invert_down,
            crown0=r.invert_up + d, crown1=r.invert_down + d,
            water0=r.invert_up + yd * d, water1=r.invert_down + yd * d,
        ))
        x += r.length
    return segments
