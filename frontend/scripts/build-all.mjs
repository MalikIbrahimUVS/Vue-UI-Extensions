import { buildTarget } from "./build-target.mjs";
import { discoverTargets } from "./utils.mjs";

function filterTargets(targets) {
	const raw = process.env.VUE_EXT_TARGETS || process.env.VUE_EXT_TARGET;
	if (!raw) {
		return targets;
	}

	const names = raw
		.split(",")
		.map((name) => name.trim())
		.filter(Boolean);

	if (names.includes("all")) {
		return targets;
	}

	const filtered = targets.filter((target) => names.includes(target.app_name));
	if (!filtered.length) {
		throw new Error(`No matching targets for: ${names.join(", ")}`);
	}
	return filtered;
}

let targets = await discoverTargets();
if (!targets.length) {
	console.log("No Vue extension targets with overrides found.");
	process.exit(0);
}

targets = filterTargets(targets);

for (const registry of targets) {
	await buildTarget(registry);
}

console.log(`Built ${targets.length} target(s).`);
