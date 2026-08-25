import pytest

from sanesim.core import fmt


def test_fmt_thousands_ptbr():
    assert fmt.fmt(1234567.891, 2) == "1.234.567,89"
    assert fmt.fmt(812.5, 3) == "812,500"
    assert fmt.fmt(0.0035, 4) == "0,0035"


def test_fmt_edit_trims_zeros():
    assert fmt.fmt_edit(7185000.0) == "7.185.000"
    assert fmt.fmt_edit(1234.5) == "1.234,5"
    assert fmt.fmt_edit(0.0) == "0"


def test_parse_ptbr():
    assert fmt.parse("1.234,56") == pytest.approx(1234.56)
    assert fmt.parse("7.185.000") == pytest.approx(7185000.0)
    assert fmt.parse("1,5") == pytest.approx(1.5)


def test_parse_enus_and_plain():
    assert fmt.parse("1,234.56") == pytest.approx(1234.56)
    assert fmt.parse("812.5") == pytest.approx(812.5)
    assert fmt.parse("150") == pytest.approx(150.0)


def test_parse_invalid_returns_default():
    assert fmt.parse("abc", 9.9) == 9.9
    assert fmt.parse("", 1.0) == 1.0
    assert fmt.parse(None, 2.0) == 2.0


def test_parse_single_thousands_group_ptbr():
    # convenção pt-BR: grupos de 3 com ponto são milhar (como a própria
    # interface formata coordenadas); decimal escreve-se com vírgula
    assert fmt.parse("672.110") == pytest.approx(672110.0)
    assert fmt.parse("812.500") == pytest.approx(812500.0)
    assert fmt.parse("672,11") == pytest.approx(672.11)


def test_fmt_edit_parse_roundtrip_coordinates():
    # regressão: coordenadas formatadas com milhar devem reidratar iguais
    for value in (672110.0, 672020.0, 7184840.0, 812.5, 0.5, 90.0):
        assert fmt.parse(fmt.fmt_edit(value)) == pytest.approx(value)


def test_roundtrip():
    for value in (0.0035, 1.5, 812.5, 7185000.0, 1234567.891):
        assert fmt.parse(fmt.fmt(value, 4)) == pytest.approx(value, rel=1e-6)
