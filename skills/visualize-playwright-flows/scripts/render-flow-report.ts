import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import process from 'node:process';

type CLIOptions = {
	readonly force: boolean;
	readonly manifest: string;
	readonly output: string;
};

type JSONObject = Record<string, unknown>;

type FlowViewport = {
	readonly width: number;
	readonly height: number;
};

type FlowStep = {
	readonly number: number;
	readonly action: string;
	readonly expectation: string;
	readonly screenshot: string;
	readonly alt: string;
};

type FlowDevice = {
	readonly name: string;
	readonly viewport: FlowViewport | undefined;
	readonly steps: readonly FlowStep[];
};

type FlowScenario = {
	readonly id: string;
	readonly title: string;
	readonly devices: readonly FlowDevice[];
};

type FlowManifest = {
	readonly name: string;
	readonly title: string;
	readonly description: string | undefined;
	readonly source: string | undefined;
	readonly generatedAt: string;
	readonly scenarios: readonly FlowScenario[];
};

type RenderedScenario = {
	readonly id: string;
	readonly title: string;
	readonly html: string;
};

type ReportAsset = {
	readonly source: string;
	readonly destination: string;
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CONTENT_HASH_LENGTH = 12;

const fail = (message: string): never => {
	throw new Error(message);
};

const parseArguments = (arguments_: readonly string[]): CLIOptions => {
	let force = false;
	let manifest: string | undefined;
	let output: string | undefined;

	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];

		if (argument === '--force') {
			force = true;
			continue;
		}

		if (argument === '--manifest' || argument === '--output') {
			const value = arguments_[index + 1];
			if (!value || value.startsWith('--'))
				fail(`Missing value for ${argument}`);
			if (argument === '--manifest') manifest = value;
			else output = value;
			index += 1;
			continue;
		}

		fail(`Unknown argument: ${argument}`);
	}

	if (!manifest || !output) {
		throw new Error(
			'Usage: render-flow-report.ts --manifest <manifest.json> --output <directory> [--force]',
		);
	}

	return { force, manifest, output };
};

const isObject = (value: unknown): value is JSONObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requireObject = (value: unknown, path: string): JSONObject => {
	if (!isObject(value)) throw new Error(`${path} must be an object`);
	return value;
};

const requireArray = (value: unknown, path: string): readonly unknown[] => {
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error(`${path} must be a non-empty array`);
	}
	return value;
};

const requireString = (value: unknown, path: string): string => {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new Error(`${path} must be a non-empty string`);
	}
	return value.trim();
};

const requireID = (value: unknown, path: string): string => {
	const id = requireString(value, path);
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
		fail(`${path} must use lowercase kebab-case`);
	}
	return id;
};

const requirePositiveInteger = (value: unknown, path: string): number => {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
		throw new Error(`${path} must be a positive integer`);
	}
	return value;
};

const escapeHTML = (value: string): string =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const safeFilePart = (value: string): string =>
	value
		.normalize('NFKD')
		.replace(/[^a-zA-Z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'flow';

const contentHash = (contents: string | Buffer): string =>
	createHash('sha256')
		.update(contents)
		.digest('hex')
		.slice(0, CONTENT_HASH_LENGTH);

const assertPNG = async (path: string): Promise<string> => {
	if (extname(path).toLowerCase() !== '.png') {
		fail(`Screenshot must be a PNG: ${path}`);
	}

	const contents = await readFile(path);
	if (contents.length <= PNG_SIGNATURE.length)
		fail(`Screenshot is empty: ${path}`);
	if (!contents.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
		fail(`Screenshot has an invalid PNG signature: ${path}`);
	}
	if (
		contents.length < 24 ||
		contents.toString('ascii', 12, 16) !== 'IHDR' ||
		contents.readUInt32BE(16) === 0 ||
		contents.readUInt32BE(20) === 0
	) {
		fail(`Screenshot has invalid PNG dimensions: ${path}`);
	}

	return contentHash(contents);
};

const fileExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const validateManifest = (input: unknown): FlowManifest => {
	const manifest = requireObject(input, 'manifest');
	const name = requireID(manifest.name, 'manifest.name');
	const title = requireString(manifest.title, 'manifest.title');
	const scenarios: FlowScenario[] = requireArray(
		manifest.scenarios,
		'manifest.scenarios',
	).map((scenarioInput, scenarioIndex) => {
		const path = `manifest.scenarios[${scenarioIndex}]`;
		const scenario = requireObject(scenarioInput, path);

		return {
			id: requireID(scenario.id, `${path}.id`),
			title: requireString(scenario.title, `${path}.title`),
			devices: requireArray(
				scenario.devices,
				`${path}.devices`,
			).map<FlowDevice>((deviceInput, deviceIndex) => {
				const devicePath = `${path}.devices[${deviceIndex}]`;
				const device = requireObject(deviceInput, devicePath);
				const viewportInput = device.viewport;
				let viewport: FlowViewport | undefined;

				if (viewportInput !== undefined) {
					const viewportObject = requireObject(
						viewportInput,
						`${devicePath}.viewport`,
					);
					viewport = {
						width: requirePositiveInteger(
							viewportObject.width,
							`${devicePath}.viewport.width`,
						),
						height: requirePositiveInteger(
							viewportObject.height,
							`${devicePath}.viewport.height`,
						),
					};
				}

				return {
					name: requireString(device.name, `${devicePath}.name`),
					viewport,
					steps: requireArray(
						device.steps,
						`${devicePath}.steps`,
					).map<FlowStep>((stepInput, stepIndex) => {
						const stepPath = `${devicePath}.steps[${stepIndex}]`;
						const step = requireObject(stepInput, stepPath);

						const number = requirePositiveInteger(
							step.number,
							`${stepPath}.number`,
						);
						if (number !== stepIndex + 1) {
							fail(`${stepPath}.number must preserve sequential order`);
						}

						return {
							number,
							action: requireString(step.action, `${stepPath}.action`),
							expectation: requireString(
								step.expectation,
								`${stepPath}.expectation`,
							),
							screenshot: requireString(
								step.screenshot,
								`${stepPath}.screenshot`,
							),
							alt: requireString(step.alt, `${stepPath}.alt`),
						};
					}),
				};
			}),
		};
	});
	const scenarioIDs = new Set(scenarios.map(({ id }) => id));
	if (scenarioIDs.size !== scenarios.length) {
		fail('manifest scenario IDs must be unique');
	}

	return {
		name,
		title,
		description:
			manifest.description === undefined
				? undefined
				: requireString(manifest.description, 'manifest.description'),
		source:
			manifest.source === undefined
				? undefined
				: requireString(manifest.source, 'manifest.source'),
		generatedAt:
			manifest.generatedAt === undefined
				? new Date().toISOString()
				: requireString(manifest.generatedAt, 'manifest.generatedAt'),
		scenarios,
	};
};

const renderReport = (
	manifest: FlowManifest,
	renderedScenarios: readonly RenderedScenario[],
): string => `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(manifest.title)}</title>
<style>
:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #111218; color: #f7f7fa; }
* { box-sizing: border-box; }
body { margin: 0; background: #111218; color: #f7f7fa; }
a { color: inherit; }
.layout { display: grid; grid-template-columns: minmax(15rem, 20rem) minmax(0, 1fr); min-height: 100vh; }
.sidebar { position: sticky; top: 0; align-self: start; height: 100vh; overflow: auto; padding: 2rem 1.25rem; border-right: 1px solid #343640; background: #17181f; }
.sidebar h1 { margin: 0 0 .75rem; font-size: 1.35rem; line-height: 1.2; }
.meta { color: #afb2bd; font-size: .875rem; line-height: 1.5; overflow-wrap: anywhere; }
.nav { display: grid; gap: .4rem; margin-top: 1.5rem; }
.nav a { padding: .65rem .75rem; border-radius: .6rem; color: #d8dae2; text-decoration: none; }
.nav a:hover, .nav a:focus-visible { background: #292b35; outline: 2px solid #7c9cff; outline-offset: 1px; }
main { width: min(100%, 92rem); padding: 2.5rem clamp(1rem, 4vw, 4rem) 5rem; }
.scenario { scroll-margin-top: 1rem; }
.scenario + .scenario { margin-top: 4rem; padding-top: 3rem; border-top: 1px solid #343640; }
.scenario h2 { margin: 0 0 1.25rem; font-size: clamp(1.6rem, 3vw, 2.4rem); }
.device { margin-top: 1.5rem; }
.device summary { cursor: pointer; font-size: 1.1rem; font-weight: 700; padding: 1rem; border: 1px solid #3b3e49; border-radius: .75rem; background: #1a1c24; }
.steps { display: grid; gap: 2rem; margin-top: 1.25rem; }
.step { padding: clamp(1rem, 3vw, 1.75rem); border: 1px solid #343640; border-radius: 1rem; background: #17181f; }
.step h3 { margin: 0; font-size: 1.2rem; }
.expectation { margin: .65rem 0 1.25rem; color: #c9ccd5; }
figure { margin: 0; }
img { display: block; max-width: 100%; height: auto; margin-inline: auto; border: 1px solid #464956; border-radius: .65rem; background: #fff; }
figcaption { margin-top: .65rem; color: #9fa3af; font-size: .85rem; }
@media (max-width: 760px) {
  .layout { display: block; }
  .sidebar { position: static; width: auto; height: auto; border-right: 0; border-bottom: 1px solid #343640; }
  main { padding: 1.5rem 1rem 3rem; }
}
</style>
</head>
<body>
<div class="layout">
<aside class="sidebar">
<h1>${escapeHTML(manifest.title)}</h1>
${manifest.description ? `<p class="meta">${escapeHTML(manifest.description)}</p>` : ''}
${manifest.source ? `<p class="meta"><strong>Источник:</strong><br>${escapeHTML(manifest.source)}</p>` : ''}
<p class="meta"><strong>Сформирован:</strong><br>${escapeHTML(manifest.generatedAt)}</p>
<nav class="nav" aria-label="Сценарии">
${renderedScenarios.map(({ id, title }) => `<a href="#${escapeHTML(id)}">${escapeHTML(title)}</a>`).join('\n')}
</nav>
</aside>
<main>
${renderedScenarios.map(({ html }) => html).join('\n')}
</main>
</div>
</body>
</html>
`;

const main = async (): Promise<void> => {
	const options = parseArguments(process.argv.slice(2));
	const manifestPath = resolve(options.manifest);
	const outputDirectory = resolve(options.output);

	const manifestInput: unknown = JSON.parse(
		await readFile(manifestPath, 'utf8'),
	);
	const manifest = validateManifest(manifestInput);
	const assetsDirectory = join(outputDirectory, 'assets');

	const renderedScenarios: RenderedScenario[] = [];
	const reportAssets: ReportAsset[] = [];
	for (const [scenarioIndex, scenario] of manifest.scenarios.entries()) {
		const scenarioAnchor = `scenario-${safeFilePart(scenario.id)}`;
		const renderedDevices: string[] = [];

		for (const [deviceIndex, device] of scenario.devices.entries()) {
			const renderedSteps: string[] = [];

			for (const step of device.steps) {
				const sourcePath = resolve(dirname(manifestPath), step.screenshot);
				const screenshotHash = await assertPNG(sourcePath);

				const assetName =
					[
						String(scenarioIndex + 1).padStart(2, '0'),
						String(deviceIndex + 1).padStart(2, '0'),
						String(step.number).padStart(2, '0'),
						safeFilePart(basename(sourcePath, extname(sourcePath))),
						screenshotHash,
					].join('-') + '.png';
				reportAssets.push({
					source: sourcePath,
					destination: join(assetsDirectory, assetName),
				});

				renderedSteps.push(`<article class="step">
<h3>${step.number}. ${escapeHTML(step.action)}</h3>
<p class="expectation"><strong>Проверяется:</strong> ${escapeHTML(step.expectation)}</p>
<figure>
<img src="assets/${escapeHTML(assetName)}" alt="${escapeHTML(step.alt)}" loading="lazy">
<figcaption>${escapeHTML(device.name)}${device.viewport ? ` · ${device.viewport.width}×${device.viewport.height}` : ''}</figcaption>
</figure>
</article>`);
			}

			renderedDevices.push(`<details class="device" open>
<summary>${escapeHTML(device.name)}${device.viewport ? ` — ${device.viewport.width}×${device.viewport.height}` : ''}</summary>
<div class="steps">${renderedSteps.join('\n')}</div>
</details>`);
		}

		renderedScenarios.push({
			id: scenarioAnchor,
			title: scenario.title,
			html: `<section class="scenario" id="${escapeHTML(scenarioAnchor)}">
<h2>${escapeHTML(scenario.title)}</h2>
${renderedDevices.join('\n')}
</section>`,
		});
	}

	const report = renderReport(manifest, renderedScenarios);
	const reportPath = join(
		outputDirectory,
		`${manifest.name}.${contentHash(report)}.html`,
	);

	if (!options.force && (await fileExists(reportPath))) {
		fail(`Report already exists: ${reportPath}. Pass --force to replace it.`);
	}

	await mkdir(assetsDirectory, { recursive: true });
	await Promise.all(
		reportAssets.map(({ source, destination }) =>
			copyFile(source, destination),
		),
	);
	await writeFile(reportPath, report, 'utf8');
	process.stdout.write(`${reportPath}\n`);
};

main().catch((error: unknown) => {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exitCode = 1;
});
