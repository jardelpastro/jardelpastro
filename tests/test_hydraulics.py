import math

import pytest

from sanesim.core import hydraulics as hyd


def test_full_section_geometry():
    geo = hyd.section_geometry(1.0, 1.0)
    assert geo.area == pytest.approx(math.pi / 4.0, rel=1e-9)
    assert geo.perimeter == pytest.approx(math.pi, rel=1e-9)
    assert geo.rh == pytest.approx(0.25, rel=1e-9)


def test_half_section_geometry():
    geo = hyd.section_geometry(1.0, 0.5)
    assert geo.area == pytest.approx(math.pi / 8.0, rel=1e-9)
    assert geo.rh == pytest.approx(0.25, rel=1e-9)
    assert geo.top_width == pytest.approx(1.0, rel=1e-9)


def test_full_flow_known_value():
    # DN 300, S = 0,005, n = 0,013 -> Q ~ 0,0567 m³/s (fórmula clássica)
    q = hyd.full_flow(0.3, 0.005, 0.013)
    expected = (math.pi * 0.09 / 4) * (0.075 ** (2 / 3)) * math.sqrt(0.005) / 0.013
    assert q == pytest.approx(expected, rel=1e-9)


def test_solve_yd_roundtrip():
    d, s, n = 0.2, 0.005, 0.010
    for yd in (0.1, 0.3, 0.5, 0.75, 0.9):
        q = hyd.manning_flow(d, s, n, yd)
        assert hyd.solve_yd(q, d, s, n) == pytest.approx(yd, abs=1e-4)


def test_solve_yd_over_capacity():
    q_over = 2.0 * hyd.full_flow(0.15, 0.005, 0.013)
    assert hyd.solve_yd(q_over, 0.15, 0.005, 0.013) is None


def test_tractive_stress_half_full():
    # meia seção: Rh = D/4 -> sigma = 10000 * 0,05 * 0,004 = 2 Pa (DN200)
    sigma = hyd.tractive_stress(0.2, 0.004, 0.5)
    assert sigma == pytest.approx(2.0, rel=1e-9)


def test_min_slope_nbr9649():
    # Qi = 1,5 l/s -> Imin = 0,0055 * 1,5^-0,47 ~ 0,0045 m/m
    assert hyd.min_slope_nbr9649(1.5) == pytest.approx(
        0.0055 * 1.5 ** -0.47, rel=1e-9)


def test_critical_velocity():
    geo = hyd.section_geometry(0.3, 0.5)
    assert hyd.critical_velocity(0.3, 0.5) == pytest.approx(
        6 * math.sqrt(9.81 * geo.rh), rel=1e-9)
