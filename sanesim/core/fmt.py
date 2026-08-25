"""Formatação numérica pt-BR: ponto de milhar e vírgula decimal.

Todo o núcleo de cálculo trabalha em float (SI); a formatação acontece
apenas na apresentação (interface e relatórios). No Excel usa-se o
number_format nativo ('#,##0.00'), que o próprio Excel exibe conforme o
idioma do usuário — aqui ficam os helpers para a interface Qt.
"""

from __future__ import annotations


def fmt(value: float, decimals: int = 2, thousands: bool = True) -> str:
    """1234567.891 -> '1.234.567,89' (pt-BR)."""
    if value is None:
        return ""
    text = f"{value:,.{decimals}f}"
    # troca separadores en-US -> pt-BR
    return text.replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def fmt_edit(value: float, max_decimals: int = 3) -> str:
    """Formata para células editáveis: milhar + decimais sem zeros à direita.

    1234.5 -> '1.234,5'; 7185000.0 -> '7.185.000'; 0.0035 -> '0,004'... não:
    mantém até max_decimals e apara zeros (0.0035 com 4 casas -> '0,0035').
    """
    if value is None:
        return ""
    text = fmt(value, max_decimals)
    if "," in text:
        text = text.rstrip("0").rstrip(",")
    return text or "0"


def parse(text: str, default: float = 0.0) -> float:
    """Interpreta números em pt-BR ou en-US.

    '1.234,56' -> 1234.56 | '1234.56' -> 1234.56 | '1,5' -> 1.5
    Com ponto e vírgula presentes, o último separador é o decimal.
    Apenas ponto: tratado como decimal ('812.500' -> 812.5), pois as
    células de edição gravam vírgula como decimal.
    """
    if text is None:
        return default
    text = str(text).strip().replace(" ", "")
    if not text:
        return default
    has_dot, has_comma = "." in text, "," in text
    if has_dot and has_comma:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")   # pt-BR
        else:
            text = text.replace(",", "")                     # en-US
    elif has_comma:
        if text.count(",") > 1:
            text = text.replace(",", "")     # só vírgulas: milhar en-US
        else:
            text = text.replace(",", ".")
    elif has_dot and text.count(".") > 1:
        text = text.replace(".", "")         # só pontos: milhar pt-BR
    try:
        return float(text)
    except ValueError:
        return default
