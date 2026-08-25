"""Abas 1 a 3: critérios de projeto, dimensionamento e método de cálculo."""

from __future__ import annotations

from PySide6.QtWidgets import (QCheckBox, QComboBox, QDoubleSpinBox,
                               QFormLayout, QGroupBox, QHBoxLayout, QLabel,
                               QLineEdit, QPushButton, QRadioButton,
                               QSpinBox, QTableWidget, QTableWidgetItem,
                               QVBoxLayout, QWidget)

from ..core import fmt
from ..core.models import ContributionZone, Project


def _dspin(minimum=0.0, maximum=1e9, decimals=3, step=0.1) -> QDoubleSpinBox:
    s = QDoubleSpinBox()
    s.setRange(minimum, maximum)
    s.setDecimals(decimals)
    s.setSingleStep(step)
    return s


class CriteriaTab(QWidget):
    """Aba 1 — critérios de início e fim de plano."""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)

        title_row = QHBoxLayout()
        title_row.addWidget(QLabel("Título do projeto:"))
        self.title_edit = QLineEdit()
        title_row.addWidget(self.title_edit)
        layout.addLayout(title_row)

        plans = QHBoxLayout()
        self.start_box = self._plan_group("Início de Plano", has_k1=False)
        self.end_box = self._plan_group("Fim de Plano", has_k1=True)
        plans.addWidget(self.start_box["group"])
        plans.addWidget(self.end_box["group"])
        layout.addLayout(plans)

        infil = QGroupBox("Infiltração e taxas de contribuição")
        form = QFormLayout(infil)
        self.infiltration = _dspin(0, 10, 3, 0.05)
        self.infiltration.setSuffix(" l/s.km")
        form.addRow("Taxa de infiltração:", self.infiltration)
        self.auto_rate = QCheckBox(
            "Calcular taxas lineares automaticamente (população / extensão "
            "total da rede)")
        self.auto_rate.setChecked(True)
        form.addRow(self.auto_rate)
        self.rate_start = _dspin(0, 1000, 3, 0.1)
        self.rate_start.setSuffix(" l/s.km")
        self.rate_end = _dspin(0, 1000, 3, 0.1)
        self.rate_end.setSuffix(" l/s.km")
        form.addRow("Taxa linear inicial (manual):", self.rate_start)
        form.addRow("Taxa linear final (manual):", self.rate_end)
        self.auto_rate.toggled.connect(self._toggle_rates)
        self._toggle_rates(True)
        layout.addWidget(infil)

        zones = QGroupBox("Zonas de contribuição (adensamento / áreas de "
                          "influência)")
        zlayout = QVBoxLayout(zones)
        zhint = QLabel(
            "Cadastre regiões com ocupação diferente — ex.: região nobre "
            "com consumo maior, região verticalizada com alta densidade — "
            "e atribua a chave da zona aos trechos na aba Trechos. A "
            "população de cada zona é rateada apenas pela extensão dos "
            "trechos dela (K1/K2 globais).")
        zhint.setWordWrap(True)
        zlayout.addWidget(zhint)
        self.zones_included = QCheckBox(
            "As populações das zonas já fazem parte da população global "
            "(descontar do rateio dos trechos sem zona)")
        self.zones_included.setChecked(True)
        self.zones_included.setToolTip(
            "Marcado (padrão): você informa a população TOTAL do projeto "
            "acima e as zonas indicam onde parte dela está concentrada — "
            "o rateio global distribui apenas o restante nos trechos sem "
            "zona.\nDesmarcado: as populações das zonas são somadas à "
            "população global (contribuição adicional).")
        zlayout.addWidget(self.zones_included)
        self.zones_table = QTableWidget(0, 10)
        self.zones_table.setHorizontalHeaderLabels(
            ["Zona", "Descrição", "Pop. Ini\n(hab)", "Pop. Fim\n(hab)",
             "q Ini\n(l/hab.dia)", "q Fim\n(l/hab.dia)", "C", "Modo",
             "Taxa Ini\n(l/s/km)", "Taxa Fim\n(l/s/km)"])
        self.zones_table.horizontalHeader().setStretchLastSection(True)
        self.zones_table.setAlternatingRowColors(True)
        zlayout.addWidget(self.zones_table)
        zbuttons = QHBoxLayout()
        zadd = QPushButton("Adicionar zona")
        zadd.clicked.connect(self._add_zone_row)
        zrem = QPushButton("Remover selecionada(s)")
        zrem.clicked.connect(self._remove_zone_rows)
        zbuttons.addWidget(zadd)
        zbuttons.addWidget(zrem)
        zbuttons.addStretch(1)
        zlayout.addLayout(zbuttons)
        layout.addWidget(zones, stretch=1)

    def _plan_group(self, title: str, has_k1: bool) -> dict:
        group = QGroupBox(title)
        form = QFormLayout(group)
        w = {"group": group}
        w["population"] = _dspin(0, 1e8, 0, 100)
        form.addRow("População (hab):", w["population"])
        w["per_capita"] = _dspin(0, 1000, 1, 5)
        w["per_capita"].setSuffix(" l/hab.dia")
        form.addRow("Consumo per capita:", w["per_capita"])
        w["return_coef"] = _dspin(0, 1, 2, 0.05)
        form.addRow("Coeficiente de retorno (C):", w["return_coef"])
        w["k1"] = _dspin(0, 5, 2, 0.05)
        form.addRow("K1 (dia de maior consumo):", w["k1"])
        if not has_k1:
            w["k1"].setEnabled(False)
            w["k1"].setToolTip(
                "No início de plano a vazão máxima usa apenas K2 (NBR 9649).")
        w["k2"] = _dspin(0, 5, 2, 0.05)
        form.addRow("K2 (hora de maior consumo):", w["k2"])
        w["k3"] = _dspin(0, 1, 2, 0.05)
        form.addRow("K3 (hora de menor consumo):", w["k3"])
        return w

    def _toggle_rates(self, auto: bool):
        self.rate_start.setEnabled(not auto)
        self.rate_end.setEnabled(not auto)

    # ------------------------------------------------ zonas
    def _mode_combo(self, auto: bool = True) -> QComboBox:
        combo = QComboBox()
        combo.addItem("Automático (população)", True)
        combo.addItem("Manual (taxas)", False)
        combo.setCurrentIndex(0 if auto else 1)
        return combo

    def _add_zone_row(self, zone: ContributionZone | None = None):
        if zone is None or isinstance(zone, bool):
            zone = ContributionZone(
                key=f"Z{self.zones_table.rowCount() + 1}")
        row = self.zones_table.rowCount()
        self.zones_table.insertRow(row)
        values = [zone.key, zone.name,
                  fmt.fmt_edit(zone.population_start, 0),
                  fmt.fmt_edit(zone.population_end, 0),
                  fmt.fmt_edit(zone.per_capita_start, 1),
                  fmt.fmt_edit(zone.per_capita_end, 1),
                  fmt.fmt_edit(zone.return_coef, 2)]
        for col, value in enumerate(values):
            self.zones_table.setItem(row, col, QTableWidgetItem(str(value)))
        self.zones_table.setCellWidget(row, 7, self._mode_combo(zone.auto))
        self.zones_table.setItem(
            row, 8, QTableWidgetItem(fmt.fmt_edit(zone.rate_start_manual)))
        self.zones_table.setItem(
            row, 9, QTableWidgetItem(fmt.fmt_edit(zone.rate_end_manual)))

    def _remove_zone_rows(self):
        rows = sorted({i.row() for i in self.zones_table.selectedIndexes()},
                      reverse=True)
        for row in rows:
            self.zones_table.removeRow(row)

    def _zones_from_table(self) -> list[ContributionZone]:
        zones = []
        for row in range(self.zones_table.rowCount()):
            def cell(col):
                item = self.zones_table.item(row, col)
                return item.text().strip() if item else ""
            key = cell(0)
            if not key:
                continue
            combo = self.zones_table.cellWidget(row, 7)
            auto = combo.currentData() if combo else True
            zones.append(ContributionZone(
                key=key,
                name=cell(1),
                population_start=fmt.parse(cell(2)),
                population_end=fmt.parse(cell(3)),
                per_capita_start=fmt.parse(cell(4), 150.0),
                per_capita_end=fmt.parse(cell(5), 150.0),
                return_coef=fmt.parse(cell(6), 0.8),
                auto=bool(auto),
                rate_start_manual=fmt.parse(cell(8)),
                rate_end_manual=fmt.parse(cell(9)),
            ))
        return zones

    # ------------------------------------------------------------------
    def load_from(self, project: Project):
        self.title_edit.setText(project.title)
        c = project.criteria
        for box, plan in ((self.start_box, c.start), (self.end_box, c.end)):
            box["population"].setValue(plan.population)
            box["per_capita"].setValue(plan.per_capita)
            box["return_coef"].setValue(plan.return_coef)
            box["k1"].setValue(plan.k1)
            box["k2"].setValue(plan.k2)
            box["k3"].setValue(plan.k3)
        self.infiltration.setValue(c.infiltration_rate)
        self.auto_rate.setChecked(c.auto_linear_rate)
        self.rate_start.setValue(c.linear_rate_start)
        self.rate_end.setValue(c.linear_rate_end)
        self.zones_included.setChecked(c.zones_included_in_global)
        self.zones_table.setRowCount(0)
        for zone in c.zones:
            self._add_zone_row(zone)

    def apply_to(self, project: Project):
        project.title = self.title_edit.text().strip() or project.title
        c = project.criteria
        for box, plan in ((self.start_box, c.start), (self.end_box, c.end)):
            plan.population = box["population"].value()
            plan.per_capita = box["per_capita"].value()
            plan.return_coef = box["return_coef"].value()
            plan.k1 = box["k1"].value()
            plan.k2 = box["k2"].value()
            plan.k3 = box["k3"].value()
        c.infiltration_rate = self.infiltration.value()
        c.auto_linear_rate = self.auto_rate.isChecked()
        c.linear_rate_start = self.rate_start.value()
        c.linear_rate_end = self.rate_end.value()
        c.zones = self._zones_from_table()
        c.zones_included_in_global = self.zones_included.isChecked()


class DesignTab(QWidget):
    """Aba 2 — critérios de dimensionamento da tubulação."""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        row = QHBoxLayout()

        hydr = QGroupBox("Hidráulica")
        form = QFormLayout(hydr)
        self.min_flow = _dspin(0, 100, 2, 0.1)
        self.min_flow.setSuffix(" l/s")
        form.addRow("Vazão mínima de dimensionamento:", self.min_flow)
        self.min_tractive = _dspin(0, 50, 2, 0.1)
        self.min_tractive.setSuffix(" Pa")
        form.addRow("Tensão trativa mínima:", self.min_tractive)
        self.min_velocity = _dspin(0, 10, 2, 0.1)
        self.min_velocity.setSuffix(" m/s")
        self.min_velocity.setToolTip(
            "0 = não verificar (a NBR 9649 controla pelo critério de "
            "tensão trativa, não de velocidade mínima).")
        form.addRow("Velocidade mínima (0 = não verificar):",
                    self.min_velocity)
        self.max_velocity = _dspin(0, 20, 2, 0.1)
        self.max_velocity.setSuffix(" m/s")
        form.addRow("Velocidade máxima (final):", self.max_velocity)
        self.max_yd = _dspin(0.1, 1.0, 2, 0.05)
        form.addRow("Lâmina máxima (y/D):", self.max_yd)
        self.min_slope = _dspin(0, 1, 5, 0.0005)
        self.min_slope.setSuffix(" m/m")
        self.min_slope.setToolTip(
            "0 = usar a mínima da NBR 9649 (0,0055·Qi^-0,47) + verificação "
            "de tensão trativa.")
        form.addRow("Declividade mínima imposta (0 = norma):", self.min_slope)
        self.max_slope = _dspin(0, 2, 5, 0.001)
        self.max_slope.setSuffix(" m/m")
        self.max_slope.setToolTip("0 = usar a máxima da NBR 9649 "
                                  "(4,65·Qf^-0,67).")
        form.addRow("Declividade máxima imposta (0 = norma):", self.max_slope)
        row.addWidget(hydr)

        geom = QGroupBox("Geometria / assentamento")
        form = QFormLayout(geom)
        self.min_dn = QSpinBox()
        self.min_dn.setRange(50, 2000)
        self.min_dn.setSuffix(" mm")
        form.addRow("DN mínimo:", self.min_dn)
        self.min_cover = _dspin(0, 10, 2, 0.05)
        self.min_cover.setSuffix(" m")
        form.addRow("Recobrimento mínimo (leito de rua):", self.min_cover)
        self.min_cover_walk = _dspin(0, 10, 2, 0.05)
        self.min_cover_walk.setSuffix(" m")
        form.addRow("Recobrimento mínimo (passeio):", self.min_cover_walk)
        self.max_depth = _dspin(0, 30, 2, 0.25)
        self.max_depth.setSuffix(" m")
        form.addRow("Profundidade máxima de vala:", self.max_depth)
        self.min_drop = _dspin(0, 5, 3, 0.01)
        self.min_drop.setSuffix(" m")
        form.addRow("Degrau mínimo em PV:", self.min_drop)
        self.trench_extra = _dspin(0, 5, 2, 0.05)
        self.trench_extra.setSuffix(" m")
        form.addRow("Folga da vala além do DN:", self.trench_extra)
        self.trench_min = _dspin(0, 5, 2, 0.05)
        self.trench_min.setSuffix(" m")
        form.addRow("Largura mínima da vala:", self.trench_min)
        row.addWidget(geom)

        layout.addLayout(row)
        layout.addStretch(1)

    def load_from(self, project: Project):
        d = project.design
        self.min_flow.setValue(d.min_flow_lps)
        self.min_tractive.setValue(d.min_tractive_pa)
        self.min_velocity.setValue(d.min_velocity_ms)
        self.max_velocity.setValue(d.max_velocity_ms)
        self.max_yd.setValue(d.max_yd)
        self.min_slope.setValue(d.min_slope_mm)
        self.max_slope.setValue(d.max_slope_mm)
        self.min_dn.setValue(d.min_diameter_mm)
        self.min_cover.setValue(d.min_cover_m)
        self.min_cover_walk.setValue(d.min_cover_sidewalk_m)
        self.max_depth.setValue(d.max_depth_m)
        self.min_drop.setValue(d.min_drop_m)
        self.trench_extra.setValue(d.trench_extra_width_m)
        self.trench_min.setValue(d.trench_min_width_m)

    def apply_to(self, project: Project):
        d = project.design
        d.min_flow_lps = self.min_flow.value()
        d.min_tractive_pa = self.min_tractive.value()
        d.min_velocity_ms = self.min_velocity.value()
        d.max_velocity_ms = self.max_velocity.value()
        d.max_yd = self.max_yd.value()
        d.min_slope_mm = self.min_slope.value()
        d.max_slope_mm = self.max_slope.value()
        d.min_diameter_mm = self.min_dn.value()
        d.min_cover_m = self.min_cover.value()
        d.min_cover_sidewalk_m = self.min_cover_walk.value()
        d.max_depth_m = self.max_depth.value()
        d.min_drop_m = self.min_drop.value()
        d.trench_extra_width_m = self.trench_extra.value()
        d.trench_min_width_m = self.trench_min.value()


class CalcTab(QWidget):
    """Aba 3 — método de cálculo e opções gerais."""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)

        method = QGroupBox("Método de cálculo")
        form = QFormLayout(method)
        self.method = QComboBox()
        self.method.addItem("Manning (seção circular parcialmente cheia)",
                            "manning")
        form.addRow("Equação:", self.method)
        self.use_material_n = QRadioButton(
            "Usar rugosidade (n) do material de cada trecho")
        self.fixed_n_radio = QRadioButton("Usar n fixo para toda a rede:")
        self.use_material_n.setChecked(True)
        self.n_fixed = _dspin(0.008, 0.03, 3, 0.001)
        n_row = QHBoxLayout()
        n_row.addWidget(self.fixed_n_radio)
        n_row.addWidget(self.n_fixed)
        n_row.addStretch(1)
        form.addRow(self.use_material_n)
        form.addRow(n_row)
        layout.addWidget(method)

        mode = QGroupBox("Modo de dimensionamento")
        form = QFormLayout(mode)
        self.mode = QComboBox()
        self.mode.addItem(
            "Pessimista — vazão mínima (1,5 l/s) aplicada trecho a trecho",
            "pessimista")
        self.mode.addItem(
            "Otimista — vazões reais acumuladas (piso só na declividade "
            "mínima)", "otimista")
        self.mode.setToolTip(
            "Pessimista: cada trecho é verificado com no mínimo a vazão "
            "mínima de dimensionamento (mais conservador, padrão CESG).\n"
            "Otimista: usa as vazões realmente acumuladas; o piso de "
            "1,5 l/s entra apenas no cálculo da declividade mínima.")
        form.addRow("Critério:", self.mode)
        layout.addWidget(mode)

        nodes = QGroupBox("PVs e cotas")
        form = QFormLayout(nodes)
        self.rename = QCheckBox("Renomear todos os PVs em ordem de cálculo")
        form.addRow(self.rename)
        self.rename_prefix = QLineEdit("PV-")
        self.rename_prefix.setMaximumWidth(120)
        form.addRow("Prefixo da renomeação:", self.rename_prefix)
        self.elev_manual = QRadioButton(
            "Usar cota de terreno inserida manualmente")
        self.elev_interp = QRadioButton(
            "Interpolar curvas de nível (terreno carregado na aba Planta)")
        self.elev_interp.setToolTip(
            "Interpola a cota de cada nó a partir das curvas de nível ou "
            "pontos cotados carregados em Planta > Terreno (DXF/CSV). "
            "As cotas manuais são ignoradas na simulação.")
        self.elev_manual.setChecked(True)
        form.addRow(self.elev_manual)
        form.addRow(self.elev_interp)
        layout.addWidget(nodes)

        default_mat = QGroupBox("Material padrão")
        form = QFormLayout(default_mat)
        self.default_material = QComboBox()
        form.addRow("Material para trechos sem material definido:",
                    self.default_material)
        layout.addWidget(default_mat)
        layout.addStretch(1)

    def load_from(self, project: Project):
        o = project.options
        self.use_material_n.setChecked(o.use_material_n)
        self.fixed_n_radio.setChecked(not o.use_material_n)
        self.n_fixed.setValue(o.n_fixed)
        idx = self.mode.findData(o.mode)
        self.mode.setCurrentIndex(max(0, idx))
        self.rename.setChecked(o.rename_nodes)
        self.rename_prefix.setText(o.rename_prefix)
        self.elev_manual.setChecked(o.elevation_source == "manual")
        self.elev_interp.setChecked(o.elevation_source == "interpolar")
        self.default_material.clear()
        for m in project.catalog:
            self.default_material.addItem(m.name, m.key)
        idx = self.default_material.findData(o.default_material)
        self.default_material.setCurrentIndex(max(0, idx))

    def apply_to(self, project: Project):
        o = project.options
        o.method = self.method.currentData()
        o.use_material_n = self.use_material_n.isChecked()
        o.n_fixed = self.n_fixed.value()
        o.mode = self.mode.currentData()
        o.rename_nodes = self.rename.isChecked()
        o.rename_prefix = self.rename_prefix.text() or "PV-"
        o.elevation_source = ("manual" if self.elev_manual.isChecked()
                              else "interpolar")
        if self.default_material.currentData():
            o.default_material = self.default_material.currentData()
