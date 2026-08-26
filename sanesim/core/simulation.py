"""Motor de simulação: marcha de cálculo da rede coletora (NBR 9649).

Fluxo geral:
 1. Ordenação topológica dos trechos (de montante para jusante).
 2. Acúmulo de vazões (taxa linear + infiltração + vazões pontuais).
 3. Para cada trecho: declividade adotada, escolha do DN, cotas do coletor
    (geratriz inferior), lâminas, velocidades e tensão trativa.
 4. Verificações normativas com lista de violações por trecho.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from . import hydraulics as hyd
from .materials import find_material
from .models import Project, Pipe


@dataclass
class PipeResult:
    pipe: str
    network: str = ""
    zone: str = ""               # zona de contribuição ("" = global)
    upstream: str = ""
    downstream: str = ""
    length: float = 0.0
    rate_start: float = 0.0      # taxa linear ini (L/s.km), incl. infiltração
    rate_end: float = 0.0        # taxa linear fim (L/s.km)
    q_reach_start: float = 0.0   # contribuição do trecho ini (L/s)
    q_reach_end: float = 0.0     # contribuição do trecho fim (L/s)
    q_point: float = 0.0         # vazão pontual no nó de montante (L/s)
    q_up_start: float = 0.0      # vazão de montante ini (L/s)
    q_up_end: float = 0.0
    q_down_start: float = 0.0    # vazão de jusante ini (L/s)
    q_down_end: float = 0.0
    diameter_mm: int = 0
    material: str = ""
    n_manning: float = 0.013
    slope: float = 0.0           # m/m
    ground_up: float = 0.0       # cota terreno montante (m)
    ground_down: float = 0.0
    invert_up: float = 0.0       # cota geratriz inferior montante (m)
    invert_down: float = 0.0
    cover_up: float = 0.0        # recobrimento (m)
    cover_down: float = 0.0
    depth_up: float = 0.0        # profundidade da vala (m)
    depth_down: float = 0.0
    yd_start: float = 0.0        # lâmina y/D com vazão inicial
    yd_end: float = 0.0          # lâmina y/D com vazão final
    v_start: float = 0.0         # velocidade (m/s) vazão inicial
    v_end: float = 0.0
    tractive_pa: float = 0.0     # tensão trativa com vazão inicial (Pa)
    v_critical: float = 0.0      # velocidade crítica (m/s)
    trench_width: float = 0.0    # largura da vala (m)
    drop_up: float = 0.0         # degrau no PV de montante (m)
    violations: list[str] = field(default_factory=list)


@dataclass
class SimulationResult:
    ok: bool = True
    messages: list[str] = field(default_factory=list)
    pipes: list[PipeResult] = field(default_factory=list)
    rate_start: float = 0.0      # taxa linear global ini (L/s.km)
    rate_end: float = 0.0
    total_length_m: float = 0.0
    renamed: dict[str, str] = field(default_factory=dict)
    # taxas por zona de contribuição: key -> (ini, fim), c/ infiltração
    zone_rates: dict[str, tuple[float, float]] = field(default_factory=dict)

    @property
    def has_violations(self) -> bool:
        return any(r.violations for r in self.pipes)


class SimulationError(Exception):
    pass


def _topological_order(project: Project) -> list[Pipe]:
    """Ordena os trechos de montante para jusante (Kahn)."""
    indeg: dict[str, int] = {}
    out_pipes: dict[str, list[Pipe]] = {}
    for p in project.pipes:
        indeg.setdefault(p.upstream, 0)
        indeg.setdefault(p.downstream, 0)
        indeg[p.downstream] += 1
        out_pipes.setdefault(p.upstream, []).append(p)

    queue = sorted([n for n, d in indeg.items() if d == 0])
    order: list[Pipe] = []
    seen_nodes: set[str] = set()
    while queue:
        node = queue.pop(0)
        seen_nodes.add(node)
        for pipe in out_pipes.get(node, []):
            order.append(pipe)
            indeg[pipe.downstream] -= 1
            if indeg[pipe.downstream] == 0:
                queue.append(pipe.downstream)
        queue.sort()
    if len(order) != len(project.pipes):
        raise SimulationError(
            "A rede contém circuito fechado (laço) ou trecho desconectado "
            "com sentido de fluxo inconsistente. Verifique montante/jusante."
        )
    return order


def _pick_diameter(diameters: list[int], min_dn: int, q_m3s: float,
                   slope: float, n: float, max_yd: float) -> int | None:
    """Menor DN comercial que atende a lâmina máxima na vazão final."""
    for dn in sorted(diameters):
        if dn < min_dn:
            continue
        yd = hyd.solve_yd(q_m3s, dn / 1000.0, slope, n)
        if yd is not None and yd <= max_yd:
            return dn
    return None


def _slope_for_tractive(q_m3s: float, d_m: float, n: float, s_start: float,
                        sigma_min: float, s_cap: float) -> float:
    """Menor declividade >= s_start com tensão trativa >= sigma_min.

    A tensão trativa cresce monotonicamente com a declividade (a lâmina cai,
    mas o produto Rh*S aumenta); busca por expansão + bisseção, limitada a
    s_cap (declividade máxima por velocidade).
    """
    def sigma(s: float) -> float:
        yd = hyd.solve_yd(q_m3s, d_m, s, n)
        if yd is None or yd <= 0:
            return float("inf")   # tubo afogado: não limita a busca aqui
        return hyd.tractive_stress(d_m, s, yd)

    if sigma(s_start) >= sigma_min:
        return s_start
    lo, hi = s_start, s_start
    for _ in range(60):
        hi = min(hi * 1.5, s_cap)
        if sigma(hi) >= sigma_min or hi >= s_cap:
            break
    if sigma(hi) < sigma_min:
        return hi   # nem a declividade máxima atende; o chamador sinaliza
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if sigma(mid) >= sigma_min:
            hi = mid
        else:
            lo = mid
    return hi


def simulate(project: Project) -> SimulationResult:
    res = SimulationResult()
    if not project.pipes:
        raise SimulationError("Nenhum trecho cadastrado.")
    for p in project.pipes:
        if project.node_by_name(p.upstream) is None:
            raise SimulationError(
                f"Trecho {p.name}: nó de montante '{p.upstream}' não existe.")
        if project.node_by_name(p.downstream) is None:
            raise SimulationError(
                f"Trecho {p.name}: nó de jusante '{p.downstream}' não existe.")

    # Cada unidade (PV/TIL/EEE...) tem obrigatoriamente UMA única saída:
    # duas saídas do mesmo nó tornariam a marcha de vazões inválida.
    outlets: dict[str, list[str]] = {}
    for p in project.pipes:
        outlets.setdefault(p.upstream, []).append(p.name)
    multiple = {node: names for node, names in outlets.items()
                if len(names) > 1}
    if multiple:
        detail = "; ".join(f"{node} → {', '.join(names)}"
                           for node, names in multiple.items())
        raise SimulationError(
            f"Unidade com mais de uma saída (não permitido): {detail}. "
            "Cada PV deve ter uma única tubulação de saída.")

    order = _topological_order(project)

    design = project.design
    opts = project.options
    crit = project.criteria

    # Cota do terreno por nó: manual, ou interpolada das curvas de nível
    # quando a opção "interpolar" está ativa e há terreno carregado.
    ground: dict[str, float] = {}
    if opts.elevation_source == "interpolar":
        if project.terrain_lines:
            from .terrain import TerrainError, TerrainModel, lines_to_points
            try:
                terrain = TerrainModel(lines_to_points(project.terrain_lines))
                for node in project.nodes:
                    ground[node.name] = terrain.elevation_at(node.coord_e,
                                                             node.coord_n)
                res.messages.append(
                    "Cotas de terreno interpoladas das curvas de nível "
                    f"({sum(len(ln) for ln in project.terrain_lines)} "
                    "pontos).")
            except TerrainError as exc:
                res.messages.append(
                    f"Terreno: {exc} Usadas as cotas manuais.")
        else:
            res.messages.append(
                "Opção 'interpolar curvas de nível' ativa, mas nenhum "
                "terreno carregado (aba Planta > Terreno). Usadas as "
                "cotas manuais.")
    for node in project.nodes:
        ground.setdefault(node.name, node.ground_elev)

    total_km = project.total_length_km()
    res.total_length_m = total_km * 1000.0

    # Extensão por zona de contribuição; os trechos sem zona formam a
    # "zona global", que rateia a população dos critérios de projeto.
    zone_length_km: dict[str, float] = {}
    global_length_km = 0.0
    for p in project.pipes:
        lk = project.pipe_length(p) / 1000.0
        if p.zone and crit.zone_by_key(p.zone):
            zone_length_km[p.zone] = zone_length_km.get(p.zone, 0.0) + lk
        else:
            global_length_km += lk

    # Quando as populações das zonas já fazem parte da população global
    # (padrão), o rateio global desconta essa parcela e distribui apenas
    # o restante nos trechos sem zona.
    pop_ded_start = pop_ded_end = 0.0
    if crit.zones_included_in_global and crit.zones:
        pop_ded_start = crit.zone_population_start()
        pop_ded_end = crit.zone_population_end()
        if pop_ded_start > crit.start.population + 1e-9:
            res.messages.append(
                f"Soma das populações iniciais das zonas "
                f"({pop_ded_start:.0f} hab) excede a população global "
                f"({crit.start.population:.0f} hab).")
        if pop_ded_end > crit.end.population + 1e-9:
            res.messages.append(
                f"Soma das populações finais das zonas "
                f"({pop_ded_end:.0f} hab) excede a população global "
                f"({crit.end.population:.0f} hab).")

    global_rate_start = crit.rate_start(global_length_km, pop_ded_start)
    global_rate_end = crit.rate_end(global_length_km, pop_ded_end)
    res.rate_start = global_rate_start + crit.infiltration_rate
    res.rate_end = global_rate_end + crit.infiltration_rate

    k1 = crit.end.k1
    k2_start, k2_end = crit.start.k2, crit.end.k2
    zone_rates = res.zone_rates
    for z in crit.zones:
        lk = zone_length_km.get(z.key, 0.0)
        zone_rates[z.key] = (
            z.rate_start(lk, k2_start) + crit.infiltration_rate,
            z.rate_end(lk, k1, k2_end) + crit.infiltration_rate,
        )
        if z.auto and (z.population_start or z.population_end) and lk <= 0:
            res.messages.append(
                f"Zona '{z.key}' tem população definida mas nenhum trecho "
                "atribuído a ela.")

    pessimistic = opts.mode == "pessimista"

    # Renomeação opcional dos nós em ordem de cálculo
    if opts.rename_nodes:
        counter = 0
        for pipe in order:
            for node_name in (pipe.upstream, pipe.downstream):
                if node_name not in res.renamed:
                    counter += 1
                    res.renamed[node_name] = f"{opts.rename_prefix}{counter:02d}"

    def display(name: str) -> str:
        return res.renamed.get(name, name)

    # Estado acumulado por nó
    q_in_start: dict[str, float] = {}   # soma das vazões de jusante afluentes
    q_in_end: dict[str, float] = {}
    invert_at_node: dict[str, float] = {}   # menor geratriz inferior chegando
    dn_at_node: dict[str, int] = {}         # maior DN afluente

    for pipe in order:
        up = project.node_by_name(pipe.upstream)
        down = project.node_by_name(pipe.downstream)
        length = project.pipe_length(pipe)
        r = PipeResult(
            pipe=pipe.name,
            network=pipe.network or up.network or "",
            upstream=display(pipe.upstream),
            downstream=display(pipe.downstream),
            length=length,
            ground_up=ground[pipe.upstream],
            ground_down=ground[pipe.downstream],
        )
        if length <= 0:
            r.violations.append("Extensão nula: informe extensão ou coordenadas.")
            res.pipes.append(r)
            continue

        # ------------------------------------------------ vazões
        if pipe.zone and pipe.zone in zone_rates:
            r.zone = pipe.zone
            r.rate_start, r.rate_end = zone_rates[pipe.zone]
        else:
            if pipe.zone and pipe.zone not in zone_rates:
                r.violations.append(
                    f"Zona '{pipe.zone}' não cadastrada nos critérios; "
                    "usada a taxa global.")
            r.rate_start = res.rate_start
            r.rate_end = res.rate_end
        r.q_reach_start = r.rate_start * length / 1000.0
        r.q_reach_end = r.rate_end * length / 1000.0
        r.q_point = up.q_point_start
        r.q_up_start = q_in_start.get(pipe.upstream, 0.0) + up.q_point_start
        r.q_up_end = q_in_end.get(pipe.upstream, 0.0) + up.q_point_end
        r.q_down_start = r.q_up_start + r.q_reach_start
        r.q_down_end = r.q_up_end + r.q_reach_end
        q_in_start[pipe.downstream] = (
            q_in_start.get(pipe.downstream, 0.0) + r.q_down_start)
        q_in_end[pipe.downstream] = (
            q_in_end.get(pipe.downstream, 0.0) + r.q_down_end)

        # Vazões de dimensionamento (piso da vazão mínima)
        if pessimistic:
            qi_dim = max(r.q_down_start, design.min_flow_lps)
            qf_dim = max(r.q_down_end, design.min_flow_lps)
        else:
            # otimista: piso apenas na verificação de declividade mínima
            qi_dim = max(r.q_down_start, design.min_flow_lps)
            qf_dim = max(r.q_down_end, 1e-3)

        # ------------------------------------------------ material / n
        mat_key = pipe.material or opts.default_material
        mat = find_material(project.catalog, mat_key)
        if mat is None:
            raise SimulationError(
                f"Trecho {pipe.name}: material '{mat_key}' não encontrado "
                "no catálogo.")
        r.material = mat.name
        if not mat.enabled:
            r.violations.append(
                f"Material '{mat.name}' está desabilitado no catálogo.")
        n = mat.n_default if opts.use_material_n else opts.n_fixed
        r.n_manning = n

        # ------------------------------------------------ declividade
        s_ground = (r.ground_up - r.ground_down) / length
        s_min = hyd.min_slope_nbr9649(qi_dim)
        if design.min_slope_mm > 0:
            s_min = max(s_min, design.min_slope_mm)
        s_max = hyd.max_slope_nbr9649(qf_dim)
        if design.max_slope_mm > 0:
            s_max = min(s_max, design.max_slope_mm)

        if pipe.slope > 0:
            slope = pipe.slope
        else:
            slope = max(s_ground, s_min)
            slope = min(slope, s_max) if s_max > s_min else slope
            slope = max(slope, s_min)
        r.slope = slope

        # ------------------------------------------------ diâmetro
        min_dn = max(design.min_diameter_mm, dn_at_node.get(pipe.upstream, 0))
        available = [d for d in mat.diameters_mm] or [design.min_diameter_mm]
        if pipe.diameter_mm > 0:
            dn = pipe.diameter_mm
        else:
            dn = _pick_diameter(available, min_dn, qf_dim / 1000.0,
                                slope, n, design.max_yd)
            if dn is None:
                dn = max(available)
                r.violations.append(
                    f"Nenhum DN do material atende a lâmina máxima "
                    f"({design.max_yd:.2f}); adotado DN {dn}.")
        if dn < dn_at_node.get(pipe.upstream, 0):
            r.violations.append(
                f"DN {dn} menor que o DN de montante "
                f"({dn_at_node.get(pipe.upstream)}) — não recomendado.")
        r.diameter_mm = dn

        # refina a declividade para garantir a tensão trativa mínima
        if pipe.slope <= 0 and design.min_tractive_pa > 0:
            slope = _slope_for_tractive(
                qi_dim / 1000.0, dn / 1000.0, n, slope,
                design.min_tractive_pa, max(s_max, slope))
            r.slope = slope
        dn_at_node[pipe.downstream] = max(dn_at_node.get(pipe.downstream, 0),
                                          dn)
        d_m = dn / 1000.0

        # ------------------------------------------------ cotas do coletor
        depth_min = design.min_cover_m + d_m   # terreno -> geratriz inferior
        inv_start_default = r.ground_up - depth_min
        inv_upstream = invert_at_node.get(pipe.upstream)
        if inv_upstream is None:
            inv_up = inv_start_default
        else:
            # nunca acima da chegada de montante (sem contra-degrau)
            inv_up = min(inv_start_default, inv_upstream - design.min_drop_m)
            r.drop_up = max(0.0, inv_upstream - inv_up)
        inv_down = inv_up - slope * length

        # garante recobrimento na extremidade de jusante
        max_inv_down = r.ground_down - depth_min
        if inv_down > max_inv_down:
            shift = inv_down - max_inv_down
            inv_up -= shift
            inv_down -= shift
            if inv_upstream is not None:
                r.drop_up = max(0.0, inv_upstream - inv_up)

        r.invert_up = inv_up
        r.invert_down = inv_down
        r.cover_up = r.ground_up - inv_up - d_m
        r.cover_down = r.ground_down - inv_down - d_m
        r.depth_up = r.ground_up - inv_up
        r.depth_down = r.ground_down - inv_down
        prev_inv = invert_at_node.get(pipe.downstream)
        invert_at_node[pipe.downstream] = (
            inv_down if prev_inv is None else min(prev_inv, inv_down))

        # ------------------------------------------------ hidráulica
        yd_i = hyd.solve_yd(qi_dim / 1000.0, d_m, slope, n)
        yd_f = hyd.solve_yd(qf_dim / 1000.0, d_m, slope, n)
        if yd_f is None:
            r.violations.append("Capacidade insuficiente na vazão final.")
            yd_f = hyd.YD_MONOTONIC_MAX
        if yd_i is None:
            yd_i = yd_f
        r.yd_start = yd_i
        r.yd_end = yd_f
        r.v_start = hyd.velocity(qi_dim / 1000.0, d_m, yd_i)
        r.v_end = hyd.velocity(qf_dim / 1000.0, d_m, yd_f)
        r.tractive_pa = hyd.tractive_stress(d_m, slope, yd_i)
        r.v_critical = hyd.critical_velocity(d_m, yd_f)
        r.trench_width = max(design.trench_min_width_m,
                             d_m + design.trench_extra_width_m)

        # ------------------------------------------------ verificações
        max_yd = design.max_yd
        if r.v_end > r.v_critical:
            max_yd = min(max_yd, 0.5)
            r.violations.append(
                f"V final ({r.v_end:.2f} m/s) > V crítica "
                f"({r.v_critical:.2f} m/s): lâmina limitada a 50%.")
        if yd_f > max_yd + 1e-9:
            r.violations.append(
                f"Lâmina final y/D = {yd_f:.2f} > máx {max_yd:.2f}.")
        if r.tractive_pa < design.min_tractive_pa - 1e-9:
            r.violations.append(
                f"Tensão trativa {r.tractive_pa:.2f} Pa < mínima "
                f"{design.min_tractive_pa:.2f} Pa.")
        if r.v_end > design.max_velocity_ms + 1e-9:
            r.violations.append(
                f"Velocidade final {r.v_end:.2f} m/s > máxima "
                f"{design.max_velocity_ms:.2f} m/s.")
        if design.min_velocity_ms > 0 and r.v_start < design.min_velocity_ms:
            r.violations.append(
                f"Velocidade inicial {r.v_start:.2f} m/s < mínima "
                f"{design.min_velocity_ms:.2f} m/s.")
        if r.cover_up < design.min_cover_m - 1e-6:
            r.violations.append(
                f"Recobrimento de montante {r.cover_up:.2f} m < mínimo "
                f"{design.min_cover_m:.2f} m.")
        if r.cover_down < design.min_cover_m - 1e-6:
            r.violations.append(
                f"Recobrimento de jusante {r.cover_down:.2f} m < mínimo "
                f"{design.min_cover_m:.2f} m.")
        if max(r.depth_up, r.depth_down) > design.max_depth_m + 1e-6:
            r.violations.append(
                f"Profundidade {max(r.depth_up, r.depth_down):.2f} m > "
                f"máxima {design.max_depth_m:.2f} m (avaliar EEE ou "
                f"aprofundamento especial).")

        res.pipes.append(r)

    # Chegadas por PV: usual até 3 entradas; acima disso, alerta — e
    # verificação de conflito físico quando várias chegam na mesma cota.
    arrivals: dict[str, list[PipeResult]] = {}
    for r in res.pipes:
        arrivals.setdefault(r.downstream, []).append(r)
    for node_name, incoming in arrivals.items():
        if len(incoming) <= 3:
            continue
        inverts = sorted(r.invert_down for r in incoming)
        clustered = 1
        max_cluster = 1
        for a, b in zip(inverts, inverts[1:]):
            clustered = clustered + 1 if (b - a) <= 0.40 else 1
            max_cluster = max(max_cluster, clustered)
        note = (f"{node_name} recebe {len(incoming)} chegadas (usual: "
                "até 3) — verifique o conflito físico das tubulações.")
        if max_cluster > 3:
            note += (f" {max_cluster} chegadas em cotas praticamente "
                     "iguais (diferença <= 0,40 m): conflito provável.")
        res.messages.append(note)
        for r in incoming:
            r.violations.append(
                f"PV {node_name} com {len(incoming)} chegadas (> 3): "
                "verifique conflito físico conforme as cotas de entrada.")

    if res.has_violations:
        n_viol = sum(1 for p in res.pipes if p.violations)
        res.messages.append(
            f"{n_viol} trecho(s) com violação de critério. Revise os "
            "resultados destacados.")
    res.ok = True
    return res
