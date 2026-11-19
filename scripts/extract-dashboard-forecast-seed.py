"""Extração offline e reproduzível dos insumos 2.3.7.

Uso: python scripts/extract-dashboard-forecast-seed.py <referencia.xlsx> <saida.sql>
O aplicativo em produção NÃO lê arquivos XLSX. As células importadas são
premissas (situacao='referencia'), nunca valores aprovados ou caixa calculado.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def month(year: int, number: int) -> str:
    return f"{year+(number-1)//12:04d}-{(number-1)%12+1:02d}-01"


def parse_cells(archive: ZipFile, sheet: int) -> dict[str, float]:
    root = ET.fromstring(archive.read(f"xl/worksheets/sheet{sheet}.xml"))
    parsed: dict[str, float] = {}
    for cell in root.findall(".//x:sheetData/x:row/x:c", NS):
        value = cell.find("x:v", NS)
        if value is None or value.text is None:
            continue
        try:
            parsed[cell.attrib["r"]] = float(value.text)
        except ValueError:
            pass
    return parsed


def seed(book: Path) -> str:
    with ZipFile(book) as archive:
        weekly, twelve, premises = [parse_cells(archive, sheet) for sheet in (5, 6, 7)]

    rows: list[str] = []

    def add(code: str, value: float, origin: str, cell: str, *, competence: str | None = None,
            dimension: str | None = None, group: str = "projecao_caixa", unit: str = "R$") -> None:
        assert value >= 0 and value < 1e10, (code, value)
        def quote(s: str | None) -> str:
            return "NULL" if s is None else "'" + s.replace("'", "''") + "'"
        rows.append("(" + ", ".join([
            quote(code), quote(group), quote(dimension), quote(competence), quote(code),
            format(value, ".15g"), quote(unit), quote(origin), quote(cell),
            "'2.3.7'", "'referencia'",
        ]) + ")")

    for code, cell, unit in [
        ("folha_mensal", "B12", "R$"), ("encargos_mensais", "B15", "R$"),
        ("decimo_terceiro_2026", "B18", "R$"),
        ("despesas_pct", "B114", "fração"), ("impostos_pct", "B115", "fração"),
    ]:
        add(code, weekly[cell], "Fluxo de Caixa", cell, unit=unit)
    for line in range(1, 5):
        cell = f"G{76+line}"
        add(f"prazo_pagamento_linha_{line}", premises[cell], "Premissas 12M", cell,
            dimension=str(line), unit="dias")
    for band in range(1, 5):
        row = 205 + band
        # Fração e prazo vêm da curva REAL usada no XLSX, não da distribuição estimada.
        for prefix, col, unit in [("curva_recebimento_faixa", "G", "fração"),
                                  ("atraso_recebimento_semanas", "I", "semanas")]:
            cell = f"{col}{row}"
            add(f"{prefix}_{band}", weekly[cell], "Fluxo de Caixa", cell, unit=unit)

    scenario_rows = {
        "noventa": (81, 83), "plano": (181, 183), "historico": (281, 283),
    }
    for index, column in enumerate("CDEFGHIJKLMN"):
        competence = month(2026, 11 + index)
        for scenario, (invoicing_row, delivered_start) in scenario_rows.items():
            cell = f"{column}{invoicing_row}"
            add(f"proj_faturamento_{scenario}", twelve[cell], "Projeção 12M", cell,
                competence=competence, dimension=scenario)
            for line in range(1, 5):
                cell = f"{column}{delivered_start + line - 1}"
                add(f"proj_entrega_{scenario}_linha_{line}", twelve[cell], "Projeção 12M", cell,
                    competence=competence, dimension=f"{scenario}/{line}")
        for line in range(1, 5):
            cell = f"{column}{87+line}"
            add(f"proj_cmv_base_linha_{line}", twelve[cell], "Projeção 12M", cell,
                competence=competence, dimension=str(line))

    assert len(rows) == 5 + 4 + 8 + 12 * (3 * 5 + 4)
    return """-- Importação única da Gestão Zacarini 2.3.7, não uma ligação com Excel.
-- Só inputs e curvas (NUNCA saldos finais calculados). Situação: referência.
-- Não sobrescrever ajustes já existentes no Supabase.
insert into public.compras_dashboard_config_237
  (codigo, grupo, dimensao, competencia, rotulo, valor, unidade, origem_aba, origem_celula, versao, situacao)
values
""" + ",\n".join(rows) + "\non conflict (codigo, competencia) do nothing;\n"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    source, destination = map(Path, sys.argv[1:])
    destination.write_text(seed(source), encoding="utf-8")
    print(f"Seed gerado: {destination}")
