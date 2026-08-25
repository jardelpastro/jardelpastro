"""Modelo de dados do projeto: critérios, nós (PVs), trechos e rede."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field, asdict

from .materials import Material, default_catalog

NODE_TYPES = ["PV", "TIL", "TL", "CP", "TQ", "EEE", "Lançamento"]


@dataclass
class PlanCriteria:
    """Critérios de um horizonte de plano (início ou fim)."""
    population: float = 0.0          # hab
    per_capita: float = 150.0        # L/hab.dia
    return_coef: float = 0.8         # coeficiente de retorno C
    k1: float = 1.2                  # coef. do dia de maior consumo
    k2: float = 1.5                  # coef. da hora de maior consumo
    k3: float = 0.5                  # coef. da hora de menor consumo

    def qmed_lps(self) -> float:
        """Vazão média de esgoto (L/s)."""
        return self.return_coef * self.population * self.per_capita / 86400.0


@dataclass
class ProjectCriteria:
    """Aba 1 — critérios de projeto (início e fim de plano)."""
    start: PlanCriteria = field(default_factory=PlanCriteria)
    end: PlanCriteria = field(default_factory=PlanCriteria)
    infiltration_rate: float = 0.1   # L/s.km
    auto_linear_rate: bool = True    # calcula taxa linear pela população
    linear_rate_start: float = 0.0   # L/s.km (manual, se auto=False)
    linear_rate_end: float = 0.0     # L/s.km (manual, se auto=False)

    def rate_start(self, total_length_km: float) -> float:
        """Taxa de contribuição linear inicial (L/s.km), Qmax = K2.Qmed."""
        if not self.auto_linear_rate:
            return self.linear_rate_start
        if total_length_km <= 0:
            return 0.0
        return self.start.k2 * self.start.qmed_lps() / total_length_km

    def rate_end(self, total_length_km: float) -> float:
        """Taxa de contribuição linear final (L/s.km), Qmax = K1.K2.Qmed."""
        if not self.auto_linear_rate:
            return self.linear_rate_end
        if total_length_km <= 0:
            return 0.0
        return (self.end.k1 * self.end.k2 * self.end.qmed_lps()
                / total_length_km)


@dataclass
class DesignCriteria:
    """Aba 2 — critérios de dimensionamento da tubulação."""
    min_flow_lps: float = 1.5        # vazão mínima de dimensionamento
    min_diameter_mm: int = 150       # DN mínimo
    min_cover_m: float = 0.90        # recobrimento mínimo (leito de rua)
    min_cover_sidewalk_m: float = 0.65   # recobrimento mínimo (passeio)
    max_depth_m: float = 5.0         # profundidade máxima de vala
    min_tractive_pa: float = 1.0     # tensão trativa mínima (Pa)
    min_velocity_ms: float = 0.0     # velocidade mínima (informativa)
    max_velocity_ms: float = 5.0     # velocidade final máxima
    max_yd: float = 0.75             # lâmina máxima (y/D)
    min_slope_mm: float = 0.0        # declividade mínima imposta (0 = norma)
    max_slope_mm: float = 0.0        # declividade máxima imposta (0 = norma)
    min_drop_m: float = 0.0          # degrau mínimo em PV
    trench_extra_width_m: float = 0.60   # folga de vala além do DN
    trench_min_width_m: float = 0.85     # largura mínima de vala


@dataclass
class CalcOptions:
    """Aba 3 — método de cálculo e opções gerais."""
    method: str = "manning"          # reservado p/ futuros métodos
    mode: str = "pessimista"         # "otimista" | "pessimista"
    use_material_n: bool = True      # n do material; senão n_fixed
    n_fixed: float = 0.013
    rename_nodes: bool = False       # renomeia PVs em ordem de cálculo
    rename_prefix: str = "PV-"
    elevation_source: str = "manual"  # "manual" | "interpolar" (futuro)
    default_material: str = "pvc_ocre"


@dataclass
class Node:
    name: str
    node_type: str = "PV"            # PV, TIL, TL, CP, TQ, EEE, Lançamento
    coord_n: float = 0.0             # Norte (m)
    coord_e: float = 0.0             # Leste (m)
    ground_elev: float = 0.0         # cota do terreno (m)
    q_point_start: float = 0.0       # vazão pontual início (L/s)
    q_point_end: float = 0.0         # vazão pontual fim (L/s)
    network: str = ""                # nome da rede/coletor (opcional)


@dataclass
class Pipe:
    name: str
    upstream: str                    # nó de montante
    downstream: str                  # nó de jusante
    length: float = 0.0              # extensão (m); 0 = calcular por coords
    material: str = ""               # chave do material ("" = padrão)
    diameter_mm: int = 0             # 0 = dimensionar automaticamente
    slope: float = 0.0               # m/m; 0 = calcular
    status: str = "Rede Projetada"   # ou "Rede Existente"
    network: str = ""


@dataclass
class Project:
    title: str = "Projeto sem título"
    criteria: ProjectCriteria = field(default_factory=ProjectCriteria)
    design: DesignCriteria = field(default_factory=DesignCriteria)
    options: CalcOptions = field(default_factory=CalcOptions)
    nodes: list[Node] = field(default_factory=list)
    pipes: list[Pipe] = field(default_factory=list)
    catalog: list[Material] = field(default_factory=default_catalog)

    # ------------------------------------------------------------------
    def node_by_name(self, name: str) -> Node | None:
        for n in self.nodes:
            if n.name == name:
                return n
        return None

    def pipe_length(self, pipe: Pipe) -> float:
        """Extensão informada ou calculada pelas coordenadas dos nós."""
        if pipe.length > 0:
            return pipe.length
        up = self.node_by_name(pipe.upstream)
        down = self.node_by_name(pipe.downstream)
        if up and down:
            return math.hypot(up.coord_n - down.coord_n,
                              up.coord_e - down.coord_e)
        return 0.0

    def total_length_km(self) -> float:
        return sum(self.pipe_length(p) for p in self.pipes) / 1000.0

    # ------------------------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "criteria": asdict(self.criteria),
            "design": asdict(self.design),
            "options": asdict(self.options),
            "nodes": [asdict(n) for n in self.nodes],
            "pipes": [asdict(p) for p in self.pipes],
            "catalog": [m.to_dict() for m in self.catalog],
        }

    @staticmethod
    def from_dict(d: dict) -> "Project":
        crit = d.get("criteria", {})
        proj = Project(
            title=d.get("title", "Projeto sem título"),
            criteria=ProjectCriteria(
                start=PlanCriteria(**crit.get("start", {})),
                end=PlanCriteria(**crit.get("end", {})),
                **{k: v for k, v in crit.items()
                   if k not in ("start", "end")},
            ),
            design=DesignCriteria(**d.get("design", {})),
            options=CalcOptions(**d.get("options", {})),
            nodes=[Node(**n) for n in d.get("nodes", [])],
            pipes=[Pipe(**p) for p in d.get("pipes", [])],
        )
        if d.get("catalog"):
            proj.catalog = [Material.from_dict(m) for m in d["catalog"]]
        return proj

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_dict(), fh, ensure_ascii=False, indent=2)

    @staticmethod
    def load(path: str) -> "Project":
        with open(path, encoding="utf-8") as fh:
            return Project.from_dict(json.load(fh))
