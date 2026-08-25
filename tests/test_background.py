import pytest

from sanesim.core.background import (BackgroundError, load_dxf_background,
                                     read_world_file)
from sanesim.core.models import Project


def test_load_dxf_background_entities(tmp_path):
    ezdxf = pytest.importorskip("ezdxf")
    doc = ezdxf.new()
    msp = doc.modelspace()
    msp.add_line((0, 0), (100, 0))
    msp.add_lwpolyline([(0, 10), (50, 10), (50, 60)])
    msp.add_circle((25, 25), 5)
    msp.add_text("RUA DAS FLORES",
                 dxfattribs={"insert": (10, 12), "height": 2.5,
                             "rotation": 0})
    # bloco com linha, inserido duas vezes (deve ser explodido)
    block = doc.blocks.new(name="QUADRA")
    block.add_line((0, 0), (10, 10))
    msp.add_blockref("QUADRA", (200, 200))
    msp.add_blockref("QUADRA", (300, 300))
    path = tmp_path / "fundo.dxf"
    doc.saveas(str(path))

    lines, texts = load_dxf_background(str(path))
    # line + lwpolyline + circle + 2 inserts = 5 linhas
    assert len(lines) == 5
    assert len(texts) == 1
    assert texts[0][4] == "RUA DAS FLORES"
    assert texts[0][2] == pytest.approx(2.5)
    # o círculo virou polyline fechada
    circle = max(lines, key=len)
    assert len(circle) >= 5
    # inserts explodidos nas posições certas
    flat = [pt for ln in lines for pt in ln]
    assert [200.0, 200.0] in flat and [310.0, 310.0] in flat


def test_load_dxf_background_empty(tmp_path):
    ezdxf = pytest.importorskip("ezdxf")
    doc = ezdxf.new()
    path = tmp_path / "vazio.dxf"
    doc.saveas(str(path))
    with pytest.raises(BackgroundError):
        load_dxf_background(str(path))


def test_read_world_file(tmp_path):
    img = tmp_path / "orto.png"
    img.write_bytes(b"fake")
    world = tmp_path / "orto.pgw"
    # 0,5 m/px, sem rotação, centro do 1º pixel em (672000,25; 7185000,75)
    world.write_text("0.5\n0\n0\n-0.5\n672000.25\n7184999.75\n",
                     encoding="utf-8")
    result = read_world_file(str(img))
    assert result is not None
    m_per_px, origin_e, origin_n = result
    assert m_per_px == pytest.approx(0.5)
    assert origin_e == pytest.approx(672000.0)
    assert origin_n == pytest.approx(7185000.0)


def test_read_world_file_missing(tmp_path):
    img = tmp_path / "orto.png"
    img.write_bytes(b"fake")
    assert read_world_file(str(img)) is None


def test_background_serialization_roundtrip(tmp_path):
    proj = Project.load("examples/exemplo_rede.json")
    proj.background_lines = [[[0, 0], [100, 0]], [[0, 10], [50, 10]]]
    proj.background_texts = [[10, 12, 2.5, 0, "RUA A"]]
    proj.background_image.path = "orto.png"
    proj.background_image.origin_e = 672000.0
    proj.background_image.origin_n = 7185000.0
    proj.background_image.m_per_px = 0.5
    path = tmp_path / "bg.json"
    proj.save(str(path))
    loaded = Project.load(str(path))
    assert len(loaded.background_lines) == 2
    assert loaded.background_texts[0][4] == "RUA A"
    assert loaded.background_image.m_per_px == pytest.approx(0.5)
    assert loaded.background_image.origin_n == pytest.approx(7185000.0)
