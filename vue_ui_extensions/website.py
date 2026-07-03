"""Website routing helpers — serve extension SPA builds for configured targets."""

from __future__ import annotations

from vue_ui_extensions.registry import has_overrides

EXTENSION_TARGETS = {
	"helpdesk": "helpdesk_extended",
	"hrms": "hrms_extended",
	"crm": "crm_extended",
}


def _should_extend(target: str, path: str) -> bool:
	if not has_overrides(target):
		return False
	normalized = path.strip("/")
	return normalized == target or normalized.startswith(f"{target}/")


def resolve_extension_path(path: str) -> str:
	"""website_path_resolver hook — route SPA paths to extended www handlers."""
	for target, endpoint in EXTENSION_TARGETS.items():
		if _should_extend(target, path):
			return endpoint

	from frappe.website.path_resolver import resolve_path

	return resolve_path(path)
