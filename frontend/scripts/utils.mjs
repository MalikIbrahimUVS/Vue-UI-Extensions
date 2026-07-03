import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const EXT_APP_ROOT = path.resolve(FRONTEND_ROOT, "..");
const BENCH_PATH = process.env.BENCH_PATH || path.resolve(EXT_APP_ROOT, "../..");

export function getPaths() {
	return { FRONTEND_ROOT, EXT_APP_ROOT, BENCH_PATH };
}

export async function pathExists(target) {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}

export async function loadRegistry(targetName) {
	const registryPath = path.join(
		EXT_APP_ROOT,
		"vue_ui_extensions/registry",
		`${targetName}.json`,
	);
	const raw = await fs.readFile(registryPath, "utf8");
	return JSON.parse(raw);
}

export async function listRegistries() {
	const registryDir = path.join(EXT_APP_ROOT, "vue_ui_extensions/registry");
	const files = await fs.readdir(registryDir);
	const registries = [];
	for (const file of files) {
		if (!file.endsWith(".json")) continue;
		const raw = await fs.readFile(path.join(registryDir, file), "utf8");
		registries.push(JSON.parse(raw));
	}
	return registries;
}

export async function hasOverrides(appName) {
	const overridesDir = path.join(
		EXT_APP_ROOT,
		"vue_ui_extensions/extensions",
		appName,
		"overrides",
	);
	if (!(await pathExists(overridesDir))) return false;
	return hasFilesRecursive(overridesDir);
}

async function hasFilesRecursive(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (await hasFilesRecursive(full)) return true;
		} else {
			return true;
		}
	}
	return false;
}

export async function discoverTargets() {
	const registries = await listRegistries();
	const targets = [];
	for (const registry of registries) {
		const appName = registry.app_name;
		const targetAppPath = path.join(BENCH_PATH, "apps", appName);
		if (!(await pathExists(targetAppPath))) continue;
		if (!(await hasOverrides(appName))) continue;
		const frontendPath = path.join(targetAppPath, registry.frontend_dir);
		const viteConfig = path.join(frontendPath, registry.vite_config);
		if (!(await pathExists(viteConfig))) continue;
		targets.push(registry);
	}
	return targets;
}

const SKIP_WORKSPACE_ENTRIES = new Set([
	"node_modules",
	".git",
	"dist",
	".cache",
	".tmp",
]);

export async function copyDir(src, dest) {
	await fs.mkdir(dest, { recursive: true });
	await fs.cp(src, dest, { recursive: true, force: true });
}

/** Copy a directory tree but skip heavy or redundant top-level entries. */
export async function copyDirExcluding(src, dest, skipNames = SKIP_WORKSPACE_ENTRIES) {
	await fs.mkdir(dest, { recursive: true });
	const entries = await fs.readdir(src, { withFileTypes: true });
	for (const entry of entries) {
		if (skipNames.has(entry.name)) {
			continue;
		}
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			await copyDirExcluding(srcPath, destPath, skipNames);
		} else {
			await fs.copyFile(srcPath, destPath);
		}
	}
}

export function injectHrmsBoot(html) {
	const bootScript = `
		<script>
			window.csrf_token = "{{ csrf_token }}"
			window.site_name = '{{ site_name }}'
			if (!window.frappe) window.frappe = {}
			frappe.boot = {{ boot | tojson }}
		</script>`;
	if (html.includes("{{ csrf_token }}")) return html;
	return html.replace("</body>", `${bootScript}\n\t</body>`);
}

export function injectHelpdeskBoot(html) {
	if (html.includes("{% for key in boot %}")) return html;
	const bootScript = `
    <script>
      window.site_name = "{{ site_name }}";
    </script>
    <script>
      {% for key in boot %}
      window["{{ key }}"] = {{ boot[key] | tojson }};
      {% endfor %}
    </script>`;
	return html.replace("</body>", `${bootScript}\n  </body>`);
}

export function injectCrmBoot(html) {
	if (html.includes("{% for key in boot %}")) return html;
	const bootScript = `
    <script>
      {% for key in boot %}
      window["{{ key }}"] = {{ boot[key] | tojson }};
      {% endfor %}
    </script>`;
	return html.replace("</body>", `${bootScript}\n  </body>`);
}

export async function writeWwwHtml(registry, builtIndexPath) {
	let html = await fs.readFile(builtIndexPath, "utf8");
	const base = registry.output.base_url;

	if (registry.app_name === "helpdesk") {
		html = html.replaceAll("/assets/helpdesk/desk/", base);
	}

	if (registry.app_name === "hrms") {
		html = injectHrmsBoot(html);
	} else if (registry.app_name === "helpdesk") {
		html = injectHelpdeskBoot(html);
	} else if (registry.app_name === "crm") {
		html = injectCrmBoot(html);
	}

	const wwwPath = path.join(EXT_APP_ROOT, registry.output.www_html);
	await fs.mkdir(path.dirname(wwwPath), { recursive: true });
	await fs.writeFile(wwwPath, html, "utf8");
	await fs.writeFile(builtIndexPath, html, "utf8");
}
