"""Extrai uma única vez as metas mensais da aba 'Metas de Vendas' 2.3.7.

Saída: SQL auditável. O ERP não lê o XLSX em tempo de execução.
Preserva qualquer célula já homologada no banco.
"""

from collections import defaultdict
from decimal import Decimal
from pathlib import Path
import sys

from openpyxl import load_workbook


FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    "/workspace/scratch/9eab8bf85279/referencia/Gestão Zacarini - Painel 2.3.7.xlsx"
)
STORE_CODES = {
    "Anastácio": "AN",
    "Bandeirantes": "BDS",
    "Campo Grande": "CG",
    "Coxim": "CX",
    "Pedro Gomes": "PG",
    "Rio Verde": "RIO",
    "Cassilândia": "CASS",  # meta futura de dezembro; ainda não é filial ativa do ERP
}
LINE_CODES = {"Nutrição": 1, "Saúde": 2, "Outros": 3, "Pastagem": 4}
LINE_BUYERS = {"Nutrição": "Thiago e Filipe", "Saúde": "Margotti", "Outros": "Thiago e Filipe", "Pastagem": "Claudiney"}
STORE_MANAGERS = {"AN": "Elias", "BDS": "Carlos", "CG": "Ramos", "CX": "Edson", "PG": "Vagner", "RIO": "Lennon", "CASS": "Meta futura; loja sem operação conectada"}


def sql_text(value):
    return "'" + str(value).replace("'", "''") + "'"


def main():
    book = load_workbook(FILE, data_only=True, read_only=True)
    sheet = book["Metas de Vendas"]
    values = []
    for month in range(1, 13):
        column = month + 3  # D = janeiro ... O = dezembro
        reference_month = f"2026-{month:02d}-01"
        line_sums = defaultdict(Decimal)
        store_sums = defaultdict(Decimal)
        column_total = Decimal("0")
        first_cells = {}
        for row in range(26, 54):
            shop = sheet.cell(row, 1).value
            line = sheet.cell(row, 2).value
            if shop not in STORE_CODES:
                raise ValueError(f"Loja inesperada na linha {row}: {shop}")
            if line not in LINE_CODES:
                raise ValueError(f"Linha desconhecida na linha {row}: {line}")
            value = sheet.cell(row, column).value
            if value is None or not isinstance(value, (int, float)) or value < 0:
                raise ValueError(f"Meta inválida em {sheet.cell(row,column).coordinate}: {value}")
            amount = Decimal(str(value))
            column_total += amount
            line_sums[line] += amount
            store_sums[shop] += amount
            first_cells.setdefault(("store", shop), f"{sheet.cell(row,column).column_letter}{row}")
            first_cells.setdefault(("line", line), f"{sheet.cell(row,column).column_letter}{row}")

        excel_total = Decimal(str(sheet.cell(54, column).value))
        if abs(column_total - excel_total) > Decimal("0.02"):
            raise ValueError(f"{reference_month}: soma das linhas difere da aba: {column_total} != {excel_total}")
        if abs(sum(line_sums.values()) - sum(store_sums.values())) > Decimal("0.02"):
            raise ValueError(f"{reference_month}: linhas e lojas não reconciliam")

        for line, code in LINE_CODES.items():
            reference = first_cells[("line", line)]
            values.append((f"meta_linha_{code}", "metas_linha", line, reference_month,
                f"Meta de {line} ({month:02d}/2026)", line_sums[line], reference, LINE_BUYERS[line]))
        for shop, code in STORE_CODES.items():
            reference = first_cells[("store", shop)]
            values.append((f"meta_loja_{code}", "metas_loja", code, reference_month,
                f"Meta de {shop} ({month:02d}/2026)", store_sums[shop], reference, STORE_MANAGERS[code]))

    print("-- Zacarini 2.3.7: Metas de Vendas!A25:O54 (metas REAL VENDIDO).")
    print("-- 132 valores mensais: quatro linhas e sete lojas (Cassilândia apenas como meta futura).")
    print("-- Não alterar metas homologadas; só seis filiais têm dados operacionais.")
    print("INSERT INTO public.compras_dashboard_config_237")
    print(" (codigo,grupo,dimensao,competencia,rotulo,valor,texto,unidade,origem_aba,origem_celula,versao,situacao)")
    print(" VALUES")
    records = []
    for code, group, dimension, date, label, amount, cell, assigned in values:
        records.append(" (" + ",".join([
            sql_text(code), sql_text(group), sql_text(dimension), sql_text(date),
            sql_text(label), format(amount, "f"), sql_text(assigned), sql_text("R$"),
            sql_text("Metas de Vendas"), sql_text(cell), sql_text("2.3.7"), sql_text("referencia")
        ]) + ")")
    print(",\n".join(records))
    print("ON CONFLICT (codigo,competencia) DO UPDATE SET")
    print(" grupo=excluded.grupo, dimensao=excluded.dimensao, rotulo=excluded.rotulo, texto=excluded.texto,")
    print(" valor=excluded.valor, unidade=excluded.unidade, origem_aba=excluded.origem_aba,")
    print(" origem_celula=excluded.origem_celula, versao=excluded.versao")
    print(" WHERE public.compras_dashboard_config_237.situacao='referencia';")


if __name__ == "__main__":
    main()
