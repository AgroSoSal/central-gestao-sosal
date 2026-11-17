"""Lê a Projeção 12M da planilha, sem alterar o arquivo, e imprime JSON.

AVISO: valores financeiros empresariais na saída; não salvar em repositório público.
"""
import json
import sys
from openpyxl import load_workbook


def main(path):
    workbook = load_workbook(path, read_only=True, data_only=True)
    projection = workbook["Projeção 12M"]
    otb = workbook["OTB"]

    def horizontal(row, start, end):
        return list(next(projection.iter_rows(min_row=row, max_row=row, min_col=start, max_col=end, values_only=True)))

    month_needs = horizontal(615, 2, 2) + horizontal(616, 2, 2) + horizontal(617, 2, 2) + horizontal(618, 2, 2)
    second_needs = [r[0] for r in projection.iter_rows(min_row=619, max_row=622, min_col=2, max_col=2, values_only=True)]
    third_needs = [r[0] for r in projection.iter_rows(min_row=623, max_row=626, min_col=2, max_col=2, values_only=True)]
    start = projection["C14"].value

    scenario = {
        "source": "Gestão Zacarini 2.2.24 — fotografia de homologação",
        "forecastStart": start.strftime("%Y-%m-01"),
        "cashBuffer": otb["B11"].value,
        "worstFreeCash": horizontal(613, 3, 14),
        "monthlyNeeds": [sum(month_needs), sum(second_needs), sum(third_needs)],
        "cumulativeDues": [horizontal(row, 3, 14) for row in (630, 631, 632)],
    }
    expected = {
        "factors": [projection[f"B{row}"].value for row in (638, 639, 640)],
        "cashCaps": horizontal(652, 2, 4),
    }
    print(json.dumps({"input": scenario, "expected": expected}, ensure_ascii=False, allow_nan=False))
    workbook.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Informe a planilha XLSX")
    main(sys.argv[1])
