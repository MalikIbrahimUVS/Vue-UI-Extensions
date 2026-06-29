import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	copyDir,
	copyDirExcluding,
	getPaths,
	loadRegistry,
	pathExists,
	writeWwwHtml,
} from "./utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function prepareFrontendWorkspace(registry) {
	const { EXT_APP_ROOT, BENCH_PATH } = getPaths();
	const appName = registry.app_name;
	const targetFrontend = path.join(BENCH_PATH, "apps", appName, registry.frontend_dir);
	const workspace = path.join(EXT_APP_ROOT, ".tmp", appName, "frontend");
	const overridesDir = path.join(
		EXT_APP_ROOT,
		"vue_ui_extensions/extensions",
		appName,
		"overrides",
	);

	console.log(`Preparing ${appName} workspace (copying sources, skipping node_modules)...`);
	const started = Date.now();

	await fs.rm(workspace, { recursive: true, force: true });
	await copyDirExcluding(targetFrontend, workspace);

	const nodeModulesSrc = path.join(targetFrontend, "node_modules");
	const nodeModulesDest = path.join(workspace, "node_modules");
	await fs.symlink(nodeModulesSrc, nodeModulesDest, "dir");

	const mergedSrc = path.join(workspace, registry.src_subdir);
	if (await pathExists(overridesDir)) {
		await copyDir(overridesDir, mergedSrc);
	}

	// Helpdesk socket.ts resolves ../../../../sites from desk/src (app root when copied)
	const sitesLink = path.join(EXT_APP_ROOT, "sites");
	if (!(await pathExists(sitesLink))) {
		await fs.symlink(path.join(BENCH_PATH, "sites"), sitesLink, "dir");
	}

	console.log(`Workspace ready in ${((Date.now() - started) / 1000).toFixed(1)}s`);

	return { workspace, targetFrontend };
}

function runViteBuild(workspace, registry) {
	const { EXT_APP_ROOT } = getPaths();
	const outDir = path.join(EXT_APP_ROOT, registry.output.public_dir);
	const base = registry.output.base_url;

	console.log(`Running vite build for ${registry.app_name}...`);

	const result = spawnSync(
		"yarn",
		["vite", "build", "--base", base, "--outDir", outDir, "--emptyOutDir"],
		{
			cwd: workspace,
			stdio: "inherit",
			env: { ...process.env, NODE_ENV: "production" },
		},
	);

	if (result.status !== 0) {
		throw new Error(`vite build failed for ${registry.app_name}`);
	}
}

export async function buildTarget(registry) {
	const { EXT_APP_ROOT } = getPaths();
	const { workspace } = await prepareFrontendWorkspace(registry);
	runViteBuild(workspace, registry);

	const outDir = path.join(EXT_APP_ROOT, registry.output.public_dir);
	let builtIndex = path.join(outDir, "index.html");

	if (registry.app_name === "helpdesk") {
		const pluginOut = path.join(path.dirname(workspace), "helpdesk/public/desk");
		if (await pathExists(pluginOut)) {
			await copyDir(pluginOut, outDir);
			builtIndex = path.join(outDir, "index.html");
		}
	}

	if (!(await pathExists(builtIndex))) {
		throw new Error(`Built index.html not found for ${registry.app_name}: ${builtIndex}`);
	}

	await writeWwwHtml(registry, builtIndex);
	console.log(`Built ${registry.app_name} -> ${outDir}`);
}

async function main() {
	const targetName = process.env.VUE_EXT_TARGET;
	if (targetName) {
		const registry = await loadRegistry(targetName);
		await buildTarget(registry);
		return;
	}
	const { discoverTargets } = await import("./utils.mjs");
	const targets = await discoverTargets();
	if (!targets.length) {
		console.log("No Vue extension targets with overrides found.");
		return;
	}
	for (const registry of targets) {
		await buildTarget(registry);
	}
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
