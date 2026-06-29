"""Registry helpers for Vue UI extension targets."""

from __future__ import annotations

import json
from pathlib import Path

APP_NAME = "vue_ui_extensions"


def get_app_root() -> Path:
	return Path(__file__).resolve().parent


def get_registry_dir() -> Path:
	return get_app_root() / "registry"


def list_registry_files() -> list[Path]:
	return sorted(get_registry_dir().glob("*.json"))


def load_registry(target_name: str) -> dict:
	path = get_registry_dir() / f"{target_name}.json"
	if not path.exists():
		raise FileNotFoundError(f"Registry not found for target: {target_name}")
	return json.loads(path.read_text(encoding="utf-8"))


def load_all_registries() -> list[dict]:
	registries = []
	for path in list_registry_files():
		registries.append(json.loads(path.read_text(encoding="utf-8")))
	return registries


def get_overrides_dir(target_name: str) -> Path:
	return get_app_root() / "extensions" / target_name / "overrides"


def has_overrides(target_name: str) -> bool:
	overrides_dir = get_overrides_dir(target_name)
	if not overrides_dir.exists():
		return False
	return any(overrides_dir.rglob("*"))


def discover_build_targets(bench_path: str | Path | None = None) -> list[dict]:
	"""Return registry entries that are installed and have override files."""
	bench_path = Path(bench_path) if bench_path else _guess_bench_path()
	apps_path = bench_path / "apps"
	targets = []

	for registry in load_all_registries():
		app_name = registry["app_name"]
		if not (apps_path / app_name).exists():
			continue
		if not has_overrides(app_name):
			continue
		frontend = apps_path / app_name / registry["frontend_dir"]
		if not (frontend / registry["vite_config"]).exists():
			continue
		targets.append(registry)

	return targets


def _guess_bench_path() -> Path:
	# apps/vue_ui_extensions/vue_ui_extensions/registry.py -> bench root
	return get_app_root().parent.parent.parent


def get_website_route_rules() -> list[dict]:
	rules = []
	for registry in discover_build_targets():
		to_route = registry["route"]["to_route"]
		for from_route in registry["route"]["from_routes"]:
			rules.append({"from_route": from_route, "to_route": to_route})
	return rules
