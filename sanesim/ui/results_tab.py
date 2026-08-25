"""Aba de resultados: planilha no padrão do memorial (2 linhas por trecho)."""

from __future__ import annotations

from PySide6.QtGui import QBrush, QColor
from PySide6.QtWidgets import (QLabel, QTableWidget, QTableWidgetItem,
                               QVBoxLayout, QWidget)

from ..core import fmt
from ..core.simulation import SimulationResult

_VIOL_BG = QColor("#ffc7ce")
_VIOL_FG = QColor("#9c0006")

HEADERS = ["Rede", "Zona", "Trecho", "PV Ini\nPV Fim", "Ext.\n(m)",
           "Cont.Lin\n(l/s/km)", "Cont.Trecho\n(l/s)", "Q Pont.\n(l/s)",
           "Q Mont.\n(l/s)", "Q Jus.\n(l/s)", "DN\n(mm)", "Decliv.\n(m/m)",
           "Cota Ter.\n(m)", "Cota GI\n(m)", "Recobr.\n(m)",
           "Prof.Vala\n(m)", "y/D", "V\n(m/s)", "σ (Pa)\nVc (m/s)",
           "n", "Larg.Vala\n(m)", "Observações"]


class ResultsTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        self.summary = QLabel("Rode a simulação para ver os resultados "
                              "(F5 ou botão ▶ na barra de ferramentas).")
        self.summary.setWordWrap(True)
        layout.addWidget(self.summary)
        self.table = QTableWidget(0, len(HEADERS))
        self.table.setHorizontalHeaderLabels(HEADERS)
        self.table.setAlternatingRowColors(True)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        layout.addWidget(self.table)

    def _add_row(self, values: list, violated: bool):
        row = self.table.rowCount()
        self.table.insertRow(row)
        for col, value in enumerate(values):
            item = QTableWidgetItem("" if value is None else str(value))
            if violated:
                item.setBackground(QBrush(_VIOL_BG))
                item.setForeground(QBrush(_VIOL_FG))
            self.table.setItem(row, col, item)

    def show_result(self, result: SimulationResult):
        self.table.setRowCount(0)
        n_viol = sum(1 for r in result.pipes if r.violations)
        txt = (f"Rede simulada: {len(result.pipes)} trechos, "
               f"{fmt.fmt(result.total_length_m, 1)} m. Taxa linear global "
               f"(c/ infiltração): {fmt.fmt(result.rate_start, 3)} / "
               f"{fmt.fmt(result.rate_end, 3)} l/s.km (ini/fim).")
        for key, (rs, re_) in result.zone_rates.items():
            txt += (f"  Zona {key}: {fmt.fmt(rs, 3)} / {fmt.fmt(re_, 3)} "
                    "l/s.km.")
        if n_viol:
            txt += (f"  ⚠ {n_viol} trecho(s) com violação de critério "
                    "(destacados em vermelho).")
        else:
            txt += "  ✔ Todos os critérios atendidos."
        self.summary.setText(txt)

        f = fmt.fmt
        for r in result.pipes:
            v = bool(r.violations)
            self._add_row([
                r.network, r.zone, r.pipe, r.upstream, f(r.length),
                f(r.rate_start), f(r.q_reach_start, 3), f(r.q_point),
                f(r.q_up_start, 3), f(r.q_down_start, 3), r.diameter_mm,
                f(r.slope, 4), f(r.ground_up, 3), f(r.invert_up, 3),
                f(r.cover_up, 3), f(r.depth_up, 3), f(r.yd_start),
                f(r.v_start), f(r.tractive_pa), f(r.n_manning, 3),
                f(r.trench_width), "; ".join(r.violations)], v)
            self._add_row([
                None, None, None, r.downstream, None,
                f(r.rate_end), f(r.q_reach_end, 3), None,
                f(r.q_up_end, 3), f(r.q_down_end, 3), None,
                None, f(r.ground_down, 3), f(r.invert_down, 3),
                f(r.cover_down, 3), f(r.depth_down, 3), f(r.yd_end),
                f(r.v_end), f(r.v_critical), None, None, None], v)
        self.table.resizeColumnsToContents()
