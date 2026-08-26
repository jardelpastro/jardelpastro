"""Modelo de dados do projeto: critérios, nós (PVs), trechos e rede."""

from __future__ import annotations

import json
import math
import uuid
from dataclasses import dataclass, field, asdict

from .materials import Material, default_catalog

NODE_TYPES = ["PV", "TIL", "TL", "CP", "TQ", "EEE", "Lançamento"]

# Versão do esquema do arquivo de projeto (.json). Incrementar a cada
# mudança incompatível e tratar a migração em Project.from_dict.
SCHEMA_VERSION = 7


def new_id() -> str:
    return uuid.uuid4().hex[:8]


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
class ContributionZone:
    """Zona de contribuição (adensamento / área de influência).

    Permite que trechos de uma mesma rede atravessem regiões com ocupação
    diferente (ex.: região nobre com consumo alto, região verticalizada
    com alta densidade). Cada zona tem população e per capita próprios,
    rateados apenas pela extensão dos trechos atribuídos a ela — ou taxas
    lineares manuais. K1 e K2 são os globais do projeto.
    """
    key: str = "Z1"                  # identificador curto usado nos trechos
    name: str = ""                   # descrição (ex.: "Região de prédios")
    population_start: float = 0.0    # hab (início de plano)
    population_end: float = 0.0      # hab (fim de plano)
    per_capita_start: float = 150.0  # L/hab.dia
    per_capita_end: float = 150.0
    return_coef: float = 0.8
    auto: bool = True                # False = usar taxas manuais abaixo
    rate_start_manual: float = 0.0   # L/s.km
    rate_end_manual: float = 0.0

    def rate_start(self, zone_length_km: float, k2: float) -> float:
        if not self.auto:
            return self.rate_start_manual
        if zone_length_km <= 0:
            return 0.0
        qmed = (self.return_coef * self.population_start
                * self.per_capita_start / 86400.0)
        return k2 * qmed / zone_length_km

    def rate_end(self, zone_length_km: float, k1: float, k2: float) -> float:
        if not self.auto:
            return self.rate_end_manual
        if zone_length_km <= 0:
            return 0.0
        qmed = (self.return_coef * self.population_end
                * self.per_capita_end / 86400.0)
        return k1 * k2 * qmed / zone_length_km


@dataclass
class ProjectCriteria:
    """Aba 1 — critérios de projeto (início e fim de plano).

    Os critérios de início/fim de plano formam a "zona global", aplicada
    aos trechos sem zona; zonas adicionais em `zones` sobrepõem taxa de
    contribuição nos trechos atribuídos a elas.
    """
    start: PlanCriteria = field(default_factory=PlanCriteria)
    end: PlanCriteria = field(default_factory=PlanCriteria)
    infiltration_rate: float = 0.1   # L/s.km
    auto_linear_rate: bool = True    # calcula taxa linear pela população
    linear_rate_start: float = 0.0   # L/s.km (manual, se auto=False)
    linear_rate_end: float = 0.0     # L/s.km (manual, se auto=False)
    zones: list[ContributionZone] = field(default_factory=list)
    # True (padrão): a população das zonas JÁ faz parte da população
    # global — o rateio global desconta a soma das populações das zonas e
    # distribui o restante nos trechos sem zona. False: as populações das
    # zonas são adicionais à global.
    zones_included_in_global: bool = True

    def zone_by_key(self, key: str) -> ContributionZone | None:
        for z in self.zones:
            if z.key == key:
                return z
        return None

    def zone_population_start(self) -> float:
        return sum(z.population_start for z in self.zones)

    def zone_population_end(self) -> float:
        return sum(z.population_end for z in self.zones)

    def rate_start(self, total_length_km: float,
                   pop_deduction: float = 0.0) -> float:
        """Taxa de contribuição linear inicial (L/s.km), Qmax = K2.Qmed.

        pop_deduction: população já contabilizada nas zonas (descontada do
        rateio global quando zones_included_in_global=True).
        """
        if not self.auto_linear_rate:
            return self.linear_rate_start
        if total_length_km <= 0:
            return 0.0
        pop = max(0.0, self.start.population - pop_deduction)
        qmed = self.start.return_coef * pop * self.start.per_capita / 86400.0
        return self.start.k2 * qmed / total_length_km

    def rate_end(self, total_length_km: float,
                 pop_deduction: float = 0.0) -> float:
        """Taxa de contribuição linear final (L/s.km), Qmax = K1.K2.Qmed."""
        if not self.auto_linear_rate:
            return self.linear_rate_end
        if total_length_km <= 0:
            return 0.0
        pop = max(0.0, self.end.population - pop_deduction)
        qmed = self.end.return_coef * pop * self.end.per_capita / 86400.0
        return self.end.k1 * self.end.k2 * qmed / total_length_km


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
    color: str = ""                  # cor individual na planta ("" = padrão)
    # Identificador interno estável: o nome é livre (o usuário pode
    # renomear), mas o id nunca muda — é o que o editor gráfico e futuras
    # referências cruzadas usarão.
    id: str = field(default_factory=new_id)


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
    zone: str = ""                   # zona de contribuição ("" = global)
    color: str = ""                  # cor individual na planta ("" = padrão)
    id: str = field(default_factory=new_id)


@dataclass
class ProjectInfo:
    """Informações gerais do projeto (usadas como padrão nas OSEs)."""
    city: str = ""
    system: str = ""          # nome do sistema (ex.: SES Campo Largo)
    designer: str = ""        # responsável técnico
    registration: str = ""    # CREA/registro
    client: str = ""          # contratante/concessionária


@dataclass
class OseSheet:
    """Uma Ordem de Serviço para Execução (OSE).

    Agrupa um conjunto de trechos (por id estável) e carrega os dados
    NÃO hidráulicos, editáveis pelo usuário: ruas, número, observações,
    responsáveis e o gabarito da régua (ajustável por OSE — redes muito
    profundas podem exigir régua maior). É a MESMA entidade que a futura
    planta e o perfil usarão: alterar aqui altera lá, e vice-versa.
    """
    number: str = ""              # número da O.S.E.
    street: str = ""              # rua
    side: str = ""                # lado (esquerdo/direito/eixo)
    between_street: str = ""      # entre rua...
    and_street: str = ""          # ...e rua
    city: str = ""                # cidade ("" = usa a do projeto)
    location: str = ""            # locação
    cadastre_sheet: str = ""      # número da folha de cadastro
    gauge_height: float = 3.0     # gabarito da régua/cruzeta (m)
    observations: str = ""        # observações gerais da OSE
    resp_proposal: str = ""       # proposição
    resp_approval: str = ""       # aprovação
    resp_release: str = ""        # liberação para execução
    resp_execution: str = ""      # execução/cadastramento
    status: str = "ativa"         # "ativa" | "cancelada"
    pipe_ids: list[str] = field(default_factory=list)  # trechos (ids)
    id: str = field(default_factory=new_id)


@dataclass
class BackgroundImage:
    """Imagem raster de fundo da planta, referenciada por caminho.

    A imagem NÃO é embutida no projeto (arquivos grandes); o caminho é
    salvo e a imagem recarregada na abertura. origin_e/origin_n são as
    coordenadas do canto superior esquerdo; m_per_px é a resolução.
    """
    path: str = ""
    origin_e: float = 0.0
    origin_n: float = 0.0
    m_per_px: float = 1.0
    opacity: float = 1.0


@dataclass
class Project:
    title: str = "Projeto sem título"
    info: ProjectInfo = field(default_factory=ProjectInfo)
    criteria: ProjectCriteria = field(default_factory=ProjectCriteria)
    design: DesignCriteria = field(default_factory=DesignCriteria)
    options: CalcOptions = field(default_factory=CalcOptions)
    nodes: list[Node] = field(default_factory=list)
    pipes: list[Pipe] = field(default_factory=list)
    catalog: list[Material] = field(default_factory=default_catalog)
    oses: list[OseSheet] = field(default_factory=list)
    # Cores dos trechos na planta por nome de rede (ex.: coletor de uma
    # cor, interceptor de outra); "" = cor padrão dos trechos sem rede.
    network_colors: dict[str, str] = field(default_factory=dict)
    # Curvas de nível / pontos cotados: lista de polylines, cada uma uma
    # lista de vértices [E, N, Z]. Alimenta a interpolação de cotas.
    terrain_lines: list[list[list[float]]] = field(default_factory=list)
    # Fundo de planta em DXF (arruamento/cadastro), já convertido em
    # geometria leve: polylines [[e, n], ...] e textos
    # [e, n, altura, rotação°, texto].
    background_lines: list[list[list[float]]] = field(default_factory=list)
    background_texts: list[list] = field(default_factory=list)
    background_image: BackgroundImage = field(
        default_factory=BackgroundImage)

    # ------------------------------------------------------------------
    def node_by_name(self, name: str) -> Node | None:
        for n in self.nodes:
            if n.name == name:
                return n
        return None

    def pipe_by_id(self, pipe_id: str) -> Pipe | None:
        for p in self.pipes:
            if p.id == pipe_id:
                return p
        return None

    def ensure_oses(self) -> int:
        """Cria OSEs para trechos ainda não cobertos (uma por rede).

        Retorna quantas OSEs foram criadas. Não altera OSEs existentes.
        """
        covered = {pid for ose in self.oses for pid in ose.pipe_ids}
        by_network: dict[str, list[str]] = {}
        for p in self.pipes:
            if p.id in covered:
                continue
            net = p.network or "Geral"
            by_network.setdefault(net, []).append(p.id)
        created = 0
        for net, pipe_ids in by_network.items():
            created += 1
            self.oses.append(OseSheet(
                number=str(len(self.oses) + 1),
                city=self.info.city,
                observations="",
                pipe_ids=pipe_ids,
            ))
        return created

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
            "schema_version": SCHEMA_VERSION,
            "title": self.title,
            "info": asdict(self.info),
            "criteria": asdict(self.criteria),
            "design": asdict(self.design),
            "options": asdict(self.options),
            "nodes": [asdict(n) for n in self.nodes],
            "pipes": [asdict(p) for p in self.pipes],
            "catalog": [m.to_dict() for m in self.catalog],
            "oses": [asdict(o) for o in self.oses],
            "network_colors": dict(self.network_colors),
            "terrain_lines": [[[round(v, 3) for v in vertex]
                               for vertex in line]
                              for line in self.terrain_lines],
            "background_lines": [[[round(v, 3) for v in vertex]
                                  for vertex in line]
                                 for line in self.background_lines],
            "background_texts": self.background_texts,
            "background_image": asdict(self.background_image),
        }

    @staticmethod
    def from_dict(d: dict) -> "Project":
        version = d.get("schema_version", 1)
        if version > SCHEMA_VERSION:
            raise ValueError(
                f"Projeto salvo em versão mais nova ({version}) do que "
                f"esta instalação suporta ({SCHEMA_VERSION}). Atualize o "
                "SaneSim.")
        crit = d.get("criteria", {})
        zones = [ContributionZone(**z) for z in crit.get("zones", [])]
        proj = Project(
            title=d.get("title", "Projeto sem título"),
            info=ProjectInfo(**d.get("info", {})),
            criteria=ProjectCriteria(
                start=PlanCriteria(**crit.get("start", {})),
                end=PlanCriteria(**crit.get("end", {})),
                zones=zones,
                **{k: v for k, v in crit.items()
                   if k not in ("start", "end", "zones")},
            ),
            design=DesignCriteria(**d.get("design", {})),
            options=CalcOptions(**d.get("options", {})),
            nodes=[Node(**n) for n in d.get("nodes", [])],
            pipes=[Pipe(**p) for p in d.get("pipes", [])],
        )
        if d.get("catalog"):
            proj.catalog = [Material.from_dict(m) for m in d["catalog"]]
        proj.oses = [OseSheet(**o) for o in d.get("oses", [])]
        proj.network_colors = dict(d.get("network_colors", {}))
        proj.terrain_lines = d.get("terrain_lines", [])
        proj.background_lines = d.get("background_lines", [])
        proj.background_texts = d.get("background_texts", [])
        proj.background_image = BackgroundImage(
            **d.get("background_image", {}))
        # migração v1 -> v2: garante ids estáveis em nós e trechos
        for n in proj.nodes:
            if not n.id:
                n.id = new_id()
        for p in proj.pipes:
            if not p.id:
                p.id = new_id()
        return proj

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_dict(), fh, ensure_ascii=False, indent=2)

    @staticmethod
    def load(path: str) -> "Project":
        with open(path, encoding="utf-8") as fh:
            return Project.from_dict(json.load(fh))
