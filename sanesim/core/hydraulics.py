"""Hidráulica de condutos livres em seção circular (Manning).

Todas as funções trabalham no SI: D em metros, Q em m³/s, S em m/m.
A lâmina é expressa pela relação y/D.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

G = 9.81          # m/s²
GAMMA = 10000.0   # peso específico do esgoto (N/m³), NBR 9649

# Acima de y/D ≈ 0,94 a vazão volta a diminuir; limitamos a busca ao trecho
# monotônico da curva de Manning.
YD_MONOTONIC_MAX = 0.94


@dataclass
class SectionGeometry:
    """Geometria molhada de uma seção circular para uma lâmina y/D."""

    yd: float       # relação lâmina/diâmetro
    area: float     # área molhada (m²)
    perimeter: float  # perímetro molhado (m)
    rh: float       # raio hidráulico (m)
    depth: float    # lâmina d'água (m)
    top_width: float  # largura da superfície livre (m)


def theta_from_yd(yd: float) -> float:
    """Ângulo central (rad) correspondente à lâmina y/D."""
    yd = min(max(yd, 0.0), 1.0)
    return 2.0 * math.acos(1.0 - 2.0 * yd)


def section_geometry(diameter: float, yd: float) -> SectionGeometry:
    theta = theta_from_yd(yd)
    area = diameter * diameter / 8.0 * (theta - math.sin(theta))
    perimeter = theta * diameter / 2.0
    rh = area / perimeter if perimeter > 0 else 0.0
    depth = yd * diameter
    top_width = diameter * math.sin(theta / 2.0)
    return SectionGeometry(yd, area, perimeter, rh, depth, top_width)


def manning_flow(diameter: float, slope: float, n: float, yd: float) -> float:
    """Vazão (m³/s) pela equação de Manning para a lâmina y/D dada."""
    if slope <= 0 or yd <= 0:
        return 0.0
    geo = section_geometry(diameter, yd)
    if geo.area <= 0:
        return 0.0
    return geo.area * geo.rh ** (2.0 / 3.0) * math.sqrt(slope) / n


def full_flow(diameter: float, slope: float, n: float) -> float:
    """Vazão a seção plena (m³/s)."""
    return manning_flow(diameter, slope, n, 1.0)


def solve_yd(flow: float, diameter: float, slope: float, n: float,
             tol: float = 1e-9) -> float | None:
    """Resolve a lâmina y/D que conduz a vazão dada.

    Retorna None quando a vazão excede a capacidade do trecho monotônico
    da curva (y/D > ~0,94), ou seja, tubo insuficiente.
    """
    if flow <= 0:
        return 0.0
    q_max = manning_flow(diameter, slope, n, YD_MONOTONIC_MAX)
    if flow > q_max:
        return None
    lo, hi = 1e-6, YD_MONOTONIC_MAX
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        q_mid = manning_flow(diameter, slope, n, mid)
        if abs(q_mid - flow) <= tol:
            return mid
        if q_mid < flow:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def velocity(flow: float, diameter: float, yd: float) -> float:
    """Velocidade média (m/s) para a vazão e lâmina dadas."""
    if yd <= 0:
        return 0.0
    geo = section_geometry(diameter, yd)
    return flow / geo.area if geo.area > 0 else 0.0


def tractive_stress(diameter: float, slope: float, yd: float) -> float:
    """Tensão trativa média (Pa): sigma = gama * Rh * S."""
    if yd <= 0:
        return 0.0
    geo = section_geometry(diameter, yd)
    return GAMMA * geo.rh * slope


def critical_velocity(diameter: float, yd: float) -> float:
    """Velocidade crítica Vc = 6 * sqrt(g * Rh) — NBR 9649.

    Quando a velocidade final supera Vc, a lâmina máxima admissível
    passa a ser 50% do diâmetro (garantia de ventilação).
    """
    geo = section_geometry(diameter, yd)
    return 6.0 * math.sqrt(G * geo.rh)


def min_slope_nbr9649(q_lps: float) -> float:
    """Declividade mínima (m/m) para tensão trativa >= 1 Pa.

    I_min = 0,0055 * Qi^-0,47, com Qi em L/s (NBR 9649).
    """
    q = max(q_lps, 1e-6)
    return 0.0055 * q ** -0.47


def max_slope_nbr9649(q_lps: float) -> float:
    """Declividade máxima (m/m) para velocidade final <= 5 m/s.

    I_max = 4,65 * Qf^-0,67, com Qf em L/s (NBR 9649).
    """
    q = max(q_lps, 1e-6)
    return 4.65 * q ** -0.67
