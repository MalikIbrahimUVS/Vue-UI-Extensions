"""Unit tests for vue_ui_extensions build and registry."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from vue_ui_extensions import registry as registry_module
from vue_ui_extensions.build import (
	after_build,
	get_bench_path,
	get_build_script,
	select_build_targets,
)


class TestRegistry(unittest.TestCase):
	def setUp(self):
		self.registry_dir = registry_module.get_registry_dir()
		self.extensions_root = registry_module.get_app_root() / "extensions"

	def test_load_hrms_registry(self):
		data = registry_module.load_registry("hrms")
		self.assertEqual(data["app_name"], "hrms")
		self.assertEqual(data["frontend_dir"], "frontend")

	def test_load_helpdesk_registry(self):
		data = registry_module.load_registry("helpdesk")
		self.assertEqual(data["app_name"], "helpdesk")
		self.assertEqual(data["frontend_dir"], "desk")

	def test_has_overrides_true_for_mvp_targets(self):
		self.assertTrue(registry_module.has_overrides("hrms"))
		self.assertTrue(registry_module.has_overrides("helpdesk"))

	def test_discover_build_targets_in_experiments_bench(self):
		bench_path = get_bench_path()
		targets = registry_module.discover_build_targets(bench_path)
		names = {t["app_name"] for t in targets}
		self.assertIn("hrms", names)
		self.assertIn("helpdesk", names)

	def test_get_website_route_rules_contains_hijack_routes(self):
		rules = registry_module.get_website_route_rules()
		to_routes = {r["to_route"] for r in rules}
		self.assertIn("hrms_extended", to_routes)
		self.assertIn("helpdesk_extended", to_routes)

	def test_resolve_extension_path_for_helpdesk(self):
		from vue_ui_extensions.website import resolve_extension_path

		self.assertEqual(resolve_extension_path("helpdesk/home"), "helpdesk_extended")


class TestBuild(unittest.TestCase):
	def test_get_build_script_exists(self):
		script = get_build_script()
		self.assertTrue(script.exists())
		self.assertEqual(script.name, "build-all.mjs")

	@patch("vue_ui_extensions.build.discover_build_targets", return_value=[])
	@patch("vue_ui_extensions.build.click.echo")
	def test_after_build_skips_without_overrides(self, mock_echo, _mock_discover):
		after_build()
		mock_echo.assert_called()

	@patch("vue_ui_extensions.build.run_build")
	@patch("vue_ui_extensions.build.select_build_targets")
	@patch("vue_ui_extensions.build.discover_build_targets")
	@patch("vue_ui_extensions.build.click.echo")
	def test_after_build_runs_when_targets_exist(
		self, mock_echo, mock_discover, mock_select, mock_run
	):
		targets = [{"app_name": "hrms"}]
		mock_discover.return_value = targets
		mock_select.return_value = targets
		after_build()
		mock_select.assert_called_once_with(targets)
		mock_run.assert_called_once_with(targets)
		mock_echo.assert_called()

	def test_select_build_targets_from_env(self):
		targets = [{"app_name": "hrms"}, {"app_name": "helpdesk"}]
		env = {"VUE_EXT_TARGET": "helpdesk", "VUE_EXT_TARGETS": "", "VUE_EXT_BUILD_ALL": ""}
		with patch.dict("os.environ", env, clear=False):
			selected = select_build_targets(targets)
		self.assertEqual([t["app_name"] for t in selected], ["helpdesk"])

	def test_select_build_targets_all_from_env(self):
		targets = [{"app_name": "hrms"}, {"app_name": "helpdesk"}]
		env = {"VUE_EXT_TARGETS": "all", "VUE_EXT_TARGET": "", "VUE_EXT_BUILD_ALL": ""}
		with patch.dict("os.environ", env, clear=False):
			selected = select_build_targets(targets)
		self.assertEqual(len(selected), 2)

	@patch("sys.stdin.isatty", return_value=False)
	def test_select_build_targets_non_tty_builds_all(self, _mock_isatty):
		targets = [{"app_name": "hrms"}, {"app_name": "helpdesk"}]
		env = {"VUE_EXT_TARGETS": "", "VUE_EXT_TARGET": "", "VUE_EXT_BUILD_ALL": ""}
		with patch.dict("os.environ", env, clear=False):
			selected = select_build_targets(targets)
		self.assertEqual(len(selected), 2)

	@patch("vue_ui_extensions.build.click.prompt", return_value="1")
	@patch("sys.stdin.isatty", return_value=True)
	def test_select_build_targets_by_number(self, _mock_isatty, _mock_prompt):
		targets = [{"app_name": "helpdesk"}, {"app_name": "hrms"}]
		env = {"VUE_EXT_TARGETS": "", "VUE_EXT_TARGET": "", "VUE_EXT_BUILD_ALL": ""}
		with patch.dict("os.environ", env, clear=False):
			selected = select_build_targets(targets)
		self.assertEqual([t["app_name"] for t in selected], ["helpdesk"])

	@patch("vue_ui_extensions.build.click.prompt", return_value="3")
	@patch("sys.stdin.isatty", return_value=True)
	def test_select_build_targets_by_number_all(self, _mock_isatty, _mock_prompt):
		targets = [{"app_name": "helpdesk"}, {"app_name": "hrms"}]
		env = {"VUE_EXT_TARGETS": "", "VUE_EXT_TARGET": "", "VUE_EXT_BUILD_ALL": ""}
		with patch.dict("os.environ", env, clear=False):
			selected = select_build_targets(targets)
		self.assertEqual(len(selected), 2)


if __name__ == "__main__":
	unittest.main()
