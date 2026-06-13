"""CLI del pipeline — corre la rebanada vertical desde un CSV.

    python -m worker.pipeline.cli run worker/tests/fixtures/companies_sample.csv \
        --area it --use-fixtures

Con `--use-fixtures` no se llama a Apify ni a Supabase: la búsqueda lee los
fixtures locales. Genera un .xlsx de 3 hojas e imprime un resumen JSON.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from .area_profiles import load_area_profile
from .models import Company, JobStatus
from .pipeline import run_pipeline

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "tests" / "fixtures"

_CSV_FIELDS = ("raw_input", "razon_social", "cif", "domain", "linkedin_url")


def load_companies_csv(path: str | Path) -> list[Company]:
    """Lee un CSV heterogéneo (cabeceras: raw_input,razon_social,cif,domain,linkedin_url)."""
    companies: list[Company] = []
    with open(path, encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            row = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            raw = row.get("raw_input") or row.get("razon_social") or row.get("linkedin_url") or ""
            if not raw and not any(row.get(f) for f in _CSV_FIELDS):
                continue
            companies.append(
                Company(
                    raw_input=raw,
                    razon_social=row.get("razon_social") or None,
                    cif=row.get("cif") or None,
                    domain=row.get("domain") or None,
                    linkedin_url=row.get("linkedin_url") or None,
                )
            )
    return companies


def _print_event(status: JobStatus, message: str, payload: dict) -> None:
    extra = f"  {json.dumps(payload, ensure_ascii=False)}" if payload else ""
    print(f"[{status.value:<9}] {message}{extra}", file=sys.stderr)


def cmd_run(args: argparse.Namespace) -> int:
    companies = load_companies_csv(args.csv)
    if not companies:
        print("No se encontraron empresas en el CSV.", file=sys.stderr)
        return 2

    area = load_area_profile(args.area, use_fixtures=args.use_fixtures)
    backup = (
        load_area_profile(args.backup, use_fixtures=args.use_fixtures) if args.backup else None
    )

    result = run_pipeline(
        companies,
        area,
        backup_area=backup,
        use_fixtures=args.use_fixtures,
        fixtures_dir=FIXTURES_DIR if args.use_fixtures else None,
        on_event=_print_event,
    )

    from .export_excel import export_excel

    out = export_excel(result.companies, result.contacts, args.out, area_name=area.name)
    summary = {**result.summary, "output_path": str(out), "area": area.key}
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="worker.pipeline.cli", description="GAS pipeline CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="Procesa un CSV de empresas y genera el Excel")
    run.add_argument("csv", help="Ruta al CSV de empresas")
    run.add_argument("--area", required=True, help="Clave del área (p.ej. it, maximos)")
    run.add_argument("--backup", default=None, help="Clave del área de respaldo (fallback)")
    run.add_argument("--use-fixtures", action="store_true", help="Usa fixtures locales (gratis)")
    run.add_argument(
        "--out", default="Decisores_GAS.xlsx", help="Ruta del .xlsx de salida"
    )
    run.set_defaults(func=cmd_run)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
