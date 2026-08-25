import openpyxl
import pytest

from sanesim.core.models import Project
from sanesim.core.ose import _stakes, export_ose
from sanesim.core.simulation import simulate


def test_stakes_multiple_of_step():
    assert _stakes(100.0, 20.0) == [0.0, 20.0, 40.0, 60.0, 80.0, 100.0]


def test_stakes_with_remainder():
    positions = _stakes(90.5, 20.0)
    assert positions[0] == 0.0
    assert positions[-1] == pytest.approx(90.5)
    assert positions[:-1] == [0.0, 20.0, 40.0, 60.0, 80.0]


def test_export_ose(tmp_path):
    proj = Project.load("examples/exemplo_rede.json")
    res = simulate(proj)
    out = tmp_path / "ose.xlsx"
    export_ose(proj, res, str(out))
    wb = openpyxl.load_workbook(str(out))
    ws = wb["OSE - Planilha"]
    text = [str(c.value) for row in ws.iter_rows() for c in row if c.value]
    joined = " ".join(text)
    # um bloco por trecho
    for r in res.pipes:
        assert f"Trecho {r.pipe}:" in joined

    # confere a interpolação do primeiro trecho: estaca inicial na cota do
    # terreno de montante e coluna de recobrimento coerente
    r0 = res.pipes[0]
    found = False
    for row in ws.iter_rows():
        if row[0].value == 0 and row[10].value and "montante" in str(row[10].value):
            assert row[3].value == pytest.approx(round(r0.ground_up, 3))
            assert row[5].value == pytest.approx(round(r0.invert_up, 3))
            depth = row[8].value
            cover = row[9].value
            assert depth - cover == pytest.approx(r0.diameter_mm / 1000.0,
                                                  abs=1e-6)
            found = True
            break
    assert found
