#!/usr/bin/env python3
"""
Gera o executável de arquivo único a partir dos fontes de src/.

Uso:  python3 build.py

Saída: dist/Pre-dimensionamento-Adutora.html — um único arquivo HTML
com todo o CSS e JavaScript embutidos, que abre com dois cliques em
qualquer computador, sem instalação e sem permissão de administrador.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).parent
SRC = RAIZ / "src"
DIST = RAIZ / "dist"
SAIDA = DIST / "Pre-dimensionamento-Adutora.html"


def ler(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def main() -> int:
    html = ler(SRC / "index.html")
    css = ler(SRC / "styles.css")

    js_files = sorted((SRC / "js").glob("*.js"))
    if not js_files:
        print("erro: nenhum arquivo em src/js", file=sys.stderr)
        return 1

    partes = []
    for f in js_files:
        partes.append(f"/* ===== {f.name} ===== */\n{ler(f)}")
    js = "\n".join(partes)

    # o conteúdo embutido não pode conter a sequência de fechamento de script
    for nome, txt in (("CSS", css), ("JS", js)):
        if "</script" in txt.lower():
            print(f"erro: {nome} contém '</script' — quebraria o arquivo único", file=sys.stderr)
            return 1

    html = html.replace("/*<!--INCLUDE:styles.css-->*/", css)
    html = html.replace("/*<!--INCLUDE:js-->*/", js)

    if "INCLUDE:" in html:
        print("erro: sobrou marcador INCLUDE no HTML", file=sys.stderr)
        return 1

    DIST.mkdir(exist_ok=True)
    SAIDA.write_text(html, encoding="utf-8")

    kb = len(html.encode("utf-8")) / 1024
    print(f"gerado {SAIDA.relative_to(RAIZ)}  ({kb:.0f} kB, "
          f"{len(js_files)} módulos JS)")

    faltando = [m for m in ("PDA.H", "PDA.CAT", "PDA.C", "PDA.App") if m not in html]
    if faltando:
        print("aviso: módulos ausentes no arquivo final: " + ", ".join(faltando),
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
