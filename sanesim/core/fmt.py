"""Formatação numérica pt-BR: ponto de milhar e vírgula decimal.

Todo o núcleo de cálculo trabalha em float (SI); a formatação acontece
apenas na apresentação (interface e relatórios). No Excel usa-se o
number_format nativo ('#,##0.00'), que o próprio Excel exibe conforme o
idioma do usuário — aqui ficam os helpers para a interface Qt.
"""

from __future__ import annotations

import re

_THOUSANDS_DOTS = re.compile(r"^-?\d{1,3}(\.\d{3})+$")
_THOUSANDS_COMMAS = re.compile(r"^-?\d{1,3}(,\d{3}){2,}$")


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
    Convenção pt-BR para separador único: grupos de exatamente 3 dígitos
    com ponto são MILHAR ('672.110' -> 672110, como a própria interface
    formata); decimal escreve-se com vírgula. Um ponto que não forma
    grupos de 3 continua decimal ('812.5' -> 812.5).
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
        if _THOUSANDS_COMMAS.match(text):
            text = text.replace(",", "")     # '1,234,567': milhar en-US
        else:
            text = text.replace(",", ".")    # vírgula única: decimal pt-BR
    elif has_dot:
        if _THOUSANDS_DOTS.match(text):
            text = text.replace(".", "")     # '672.110': milhar pt-BR
    try:
        return float(text)
    except ValueError:
        return default
