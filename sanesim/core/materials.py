"""Catálogo de materiais e tubos usuais em redes de esgoto sanitário.

Cada material traz o coeficiente de rugosidade de Manning (mínimo, padrão e
máximo encontrados em norma/literatura) e a lista de diâmetros nominais
comerciais. O valor "padrão" é o adotado no dimensionamento, mas o usuário
pode alterá-lo dentro da faixa min–max.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict


@dataclass
class Material:
    key: str                 # identificador estável (usado no projeto salvo)
    name: str                # nome de exibição
    n_min: float             # rugosidade de Manning mínima
    n_default: float         # rugosidade adotada (editável)
    n_max: float             # rugosidade de Manning máxima
    diameters_mm: list[int] = field(default_factory=list)
    wall_mm: float = 0.0     # espessura de parede típica (mm) p/ recobrimento
    notes: str = ""
    enabled: bool = True     # disponível para o dimensionamento automático

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "Material":
        return Material(**d)


def default_catalog() -> list[Material]:
    """Materiais usuais para transporte de esgoto, com DNs comerciais."""
    return [
        Material(
            key="pvc_ocre",
            name="PVC Ocre (NBR 7362 - JEI)",
            n_min=0.009, n_default=0.010, n_max=0.013,
            diameters_mm=[100, 150, 200, 250, 300, 350, 400],
            wall_mm=4.7,
            notes="Ponta e bolsa com junta elástica integrada; o mais usual "
                  "em coletores até DN 400.",
        ),
        Material(
            key="pead_corrugado",
            name="PEAD Corrugado (dupla parede)",
            n_min=0.009, n_default=0.011, n_max=0.013,
            diameters_mm=[100, 150, 200, 250, 300, 400, 500, 600, 800,
                          1000, 1200],
            wall_mm=8.0,
            notes="Parede interna lisa; usado de coletores a emissários.",
        ),
        Material(
            key="concreto",
            name="Concreto Armado (NBR 8890)",
            n_min=0.013, n_default=0.013, n_max=0.015,
            diameters_mm=[300, 400, 500, 600, 700, 800, 900, 1000, 1200,
                          1500, 2000],
            wall_mm=60.0,
            notes="Coletores-tronco, interceptores e emissários; exige "
                  "verificação de agressividade (H2S).",
        ),
        Material(
            key="ceramico",
            name="Cerâmico Vidrado (manilha)",
            n_min=0.011, n_default=0.013, n_max=0.015,
            diameters_mm=[100, 150, 200, 250, 300, 375, 450, 600],
            wall_mm=20.0,
            notes="Alta resistência química; comum em redes antigas e "
                  "reabilitação.",
        ),
        Material(
            key="prfv",
            name="PRFV (fibra de vidro)",
            n_min=0.009, n_default=0.010, n_max=0.012,
            diameters_mm=[300, 400, 500, 600, 700, 800, 900, 1000, 1200,
                          1400, 1600, 2000],
            wall_mm=12.0,
            notes="Grandes diâmetros, alta resistência à corrosão.",
        ),
        Material(
            key="ffd",
            name="Ferro Fundido Dúctil (rev. interno)",
            n_min=0.010, n_default=0.012, n_max=0.013,
            diameters_mm=[150, 200, 250, 300, 400, 500, 600, 800],
            wall_mm=8.0,
            notes="Travessias, trechos com alta carga externa ou pressão.",
        ),
    ]


def find_material(catalog: list[Material], key: str) -> Material | None:
    for m in catalog:
        if m.key == key:
            return m
    return None
