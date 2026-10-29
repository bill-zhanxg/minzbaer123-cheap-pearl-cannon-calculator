import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
	MAX_ITEMS,
	calculateMissDistance,
	calculateOverworld,
	calculateShot,
	solveTarget,
	type Origin,
	type Point,
} from '../calc';
import { Icon, type IconName } from './Icon';
import { LandingMap } from './LandingMap';

const DEFAULT_ORIGIN: Origin = { x: 8.49, z: 15.64, direction: 0 };
const STORAGE_KEY = 'ender-pearl-cannon-calculator:inputs:v1';
const PRESETS_STORAGE_KEY = 'ender-pearl-cannon-calculator:presets:v1';

type PersistedInputs = {
	originX: string;
	originZ: string;
	direction: string;
	a: string;
	b: string;
	targetX: string;
	targetZ: string;
};

type Preset = {
	id: string;
	name: string;
	inputs: PersistedInputs;
};

const DEFAULT_INPUTS: PersistedInputs = {
	originX: String(DEFAULT_ORIGIN.x),
	originZ: String(DEFAULT_ORIGIN.z),
	direction: String(DEFAULT_ORIGIN.direction),
	a: '40',
	b: '64',
	targetX: '-2000',
	targetZ: '-6000',
};

const readPersistedInputs = (): PersistedInputs => {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (!stored) return DEFAULT_INPUTS;

		const parsed: unknown = JSON.parse(stored);
		if (!parsed || typeof parsed !== 'object') return DEFAULT_INPUTS;

		const values = parsed as Record<string, unknown>;
		const keys = Object.keys(DEFAULT_INPUTS) as Array<keyof PersistedInputs>;
		if (!keys.every((key) => typeof values[key] === 'string')) return DEFAULT_INPUTS;

		return Object.fromEntries(keys.map((key) => [key, values[key]])) as PersistedInputs;
	} catch (error) {
		console.warn('Unable to load saved calculator inputs.', error);
		return DEFAULT_INPUTS;
	}
};

const isPersistedInputs = (value: unknown): value is PersistedInputs => {
	if (!value || typeof value !== 'object') return false;
	const values = value as Record<string, unknown>;
	return (Object.keys(DEFAULT_INPUTS) as Array<keyof PersistedInputs>).every((key) => typeof values[key] === 'string');
};

const readPresets = (): Preset[] => {
	try {
		const stored = window.localStorage.getItem(PRESETS_STORAGE_KEY);
		if (!stored) return [];
		const parsed: unknown = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(value): value is Preset =>
				!!value &&
				typeof value === 'object' &&
				typeof value.id === 'string' &&
				typeof value.name === 'string' &&
				isPersistedInputs(value.inputs),
		);
	} catch (error) {
		console.warn('Unable to load saved presets.', error);
		return [];
	}
};

const formatDuration = (value: number) => {
	const totalSeconds = Math.round(value);
	return {
		display: `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`,
		seconds: `${totalSeconds} seconds`,
	};
};

const formatItems = (value: number) => {
	const stacks = Math.floor(value / 64);
	const extra = value % 64;
	return {
		display: `${stacks} stack${stacks === 1 ? '' : 's'}${extra ? ` + ${extra}` : ''}`,
		raw: `${value} items`,
	};
};

function SectionHeading({ icon, title, description }: { icon: IconName; title: string; description: string }) {
	return (
		<div className="mb-5 flex items-start gap-3">
			<div className="rounded-xl bg-orange-100 p-2 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
				<Icon name={icon} />
			</div>
			<div>
				<h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
				<p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
			</div>
		</div>
	);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<label className="grid gap-1.5">
			<span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
			{children}
			{hint && <span className="text-xs text-slate-400">{hint}</span>}
		</label>
	);
}

export function InteractiveCalculator() {
	const [inputs, setInputs] = useState<PersistedInputs>(readPersistedInputs);
	const [presets, setPresets] = useState<Preset[]>(readPresets);
	const [presetName, setPresetName] = useState('');
	const [importJson, setImportJson] = useState('');
	const [showImport, setShowImport] = useState(false);
	const [presetStatus, setPresetStatus] = useState('');
	const [copied, setCopied] = useState(false);

	const { originX, originZ, direction, a, b, targetX, targetZ } = inputs;
	const updateInput = (key: keyof PersistedInputs, value: string) => {
		setInputs((current) => ({ ...current, [key]: value }));
	};

	useEffect(() => {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
		} catch (error) {
			console.warn('Unable to save calculator inputs.', error);
		}
	}, [inputs]);

	useEffect(() => {
		try {
			window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
		} catch (error) {
			console.warn('Unable to save presets.', error);
		}
	}, [presets]);

	const origin: Origin = { x: Number(originX) || 0, z: Number(originZ) || 0, direction: Number(direction) || 0 };
	const shot = useMemo(
		() =>
			calculateShot(Number(a) || 0, Number(b) || 1, {
				x: Number(originX) || 0,
				z: Number(originZ) || 0,
				direction: Number(direction) || 0,
			}),
		[a, b, originX, originZ, direction],
	);
	const overworld = calculateOverworld(shot.landing);
	const target = { x: Number(targetX) || 0, z: Number(targetZ) || 0 };
	const missDistance = calculateMissDistance(shot.landing, target);
	const acceleratingWait = formatDuration(shot.timing.waitAcceleratingSeconds);
	const landingWait = formatDuration(shot.timing.waitLandingSeconds);
	const command = `/execute in minecraft:the_nether run tp @s ${shot.landing.x.toFixed(2)} 128 ${shot.landing.z.toFixed(2)}`;
	const aValue = Math.min(MAX_ITEMS, Math.max(0, Math.round(Number(a) || 0)));
	const bValue = Math.min(MAX_ITEMS, Math.max(1, Math.round(Number(b) || 1)));
	const aExceedsDirectionLimit = aValue > bValue + 1;
	const aItems = formatItems(aValue);
	const bItems = formatItems(bValue);

	const aimAt = (point: Point) => {
		const nextTargetX = String(point.x.toFixed(1));
		const nextTargetZ = String(point.z.toFixed(1));
		const solution = solveTarget(point, origin);
		if (solution.behindCannon) return;
		setInputs((current) => ({
			...current,
			targetX: nextTargetX,
			targetZ: nextTargetZ,
			a: String(solution.a),
			b: String(solution.b),
		}));
	};

	const solve = () => {
		aimAt(target);
	};

	const reset = () => {
		setInputs((current) => ({
			...current,
			originX: String(DEFAULT_ORIGIN.x),
			originZ: String(DEFAULT_ORIGIN.z),
			direction: String(DEFAULT_ORIGIN.direction),
		}));
	};

	const copyCommand = async () => {
		await navigator.clipboard.writeText(command);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1600);
	};

	const savePreset = () => {
		const name = presetName.trim();
		if (!name) {
			setPresetStatus('Enter a preset name first.');
			return;
		}
		const preset = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, inputs };
		setPresets((current) => [...current.filter((item) => item.name.toLowerCase() !== name.toLowerCase()), preset]);
		setPresetName('');
		setPresetStatus(`Saved "${name}".`);
	};

	const loadPreset = (preset: Preset) => {
		setInputs(preset.inputs);
		setPresetStatus(`Loaded "${preset.name}".`);
	};

	const deletePreset = (preset: Preset) => {
		setPresets((current) => current.filter((item) => item.id !== preset.id));
		setPresetStatus(`Deleted "${preset.name}".`);
	};

	const copyJson = async (value: unknown, successMessage: string) => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
			setPresetStatus(successMessage);
		} catch (error) {
			console.warn('Unable to copy preset JSON.', error);
			setPresetStatus('Unable to copy preset JSON.');
		}
	};

	const importPresets = () => {
		try {
			const parsed: unknown = JSON.parse(importJson);
			const imported = Array.isArray(parsed) ? parsed : [parsed];
			const valid = imported.filter(
				(value): value is Preset =>
					!!value && typeof value === 'object' && typeof value.name === 'string' && isPersistedInputs(value.inputs),
			);
			if (valid.length === 0) {
				setPresetStatus('No valid presets found in that JSON.');
				return;
			}
			const normalized = valid.map((preset) => ({
				id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${preset.name}`,
				name: preset.name,
				inputs: preset.inputs,
			}));
			setPresets((current) => [
				...current.filter(
					(preset) => !normalized.some((item) => item.name.toLowerCase() === preset.name.toLowerCase()),
				),
				...normalized,
			]);
			setImportJson('');
			setPresetStatus(`Imported ${normalized.length} preset${normalized.length === 1 ? '' : 's'}.`);
		} catch (error) {
			console.warn('Unable to parse preset JSON.', error);
			setPresetStatus('That JSON could not be imported.');
		}
	};

	return (
		<>
			<section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
				<div className="grid gap-8 lg:grid-cols-4">
					<div className="grid gap-8 lg:col-span-3 lg:grid-cols-3">
						<div>
							<SectionHeading description="Where the cannon is located." icon="pin" title="Origin" />
							<div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
								<Field label="X">
									<input
										type="number"
										step="any"
										value={originX}
										onChange={(event) => updateInput('originX', event.target.value)}
									/>
								</Field>
								<Field label="Z">
									<input
										type="number"
										step="any"
										value={originZ}
										onChange={(event) => updateInput('originZ', event.target.value)}
									/>
								</Field>
								<Field label="Facing">
									<select value={direction} onChange={(event) => updateInput('direction', event.target.value)}>
										<option value="0">North (-Z)</option>
										<option value="90">East (+X)</option>
										<option value="180">South (+Z)</option>
										<option value="270">West (-X)</option>
									</select>
								</Field>
							</div>
						</div>
						<div>
							<SectionHeading description="Tune the direction and range." icon="sliders" title="Controls" />
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
								<Field hint="0-576 items" label="A · sideways">
									<input
										type="number"
										min="0"
										max={MAX_ITEMS}
										step="1"
										value={a}
										onChange={(event) => {
											const nextA = Math.min(MAX_ITEMS, Math.max(0, Math.round(Number(event.target.value) || 0)));
											updateInput('a', String(nextA));
										}}
									/>
									{aExceedsDirectionLimit && (
										<span className="text-xs font-medium text-amber-600 dark:text-amber-400">
											A above B + 1 is ignored for sideways direction.
										</span>
									)}
								</Field>
								<Field hint={`1-${MAX_ITEMS} items`} label="B · forward">
									<input
										type="number"
										min="1"
										max={MAX_ITEMS}
										step="1"
										value={b}
										onChange={(event) => {
											const nextB = Math.min(MAX_ITEMS, Math.max(1, Math.round(Number(event.target.value) || 1)));
											updateInput('b', String(nextB));
										}}
									/>
								</Field>
							</div>
						</div>
						<div>
							<SectionHeading description="Solve controls for a destination." icon="target" title="Target" />
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
								<Field label="Target X">
									<input
										type="number"
										step="any"
										value={targetX}
										onChange={(event) => updateInput('targetX', event.target.value)}
									/>
								</Field>
								<Field label="Target Z">
									<input
										type="number"
										step="any"
										value={targetZ}
										onChange={(event) => updateInput('targetZ', event.target.value)}
									/>
								</Field>
							</div>
							<div className="mt-5 flex flex-wrap gap-2">
								<button type="button" onClick={solve}>
									<Icon name="target" size={17} /> Solve A &amp; B
								</button>
								<button type="button" className="secondary" onClick={reset}>
									Reset origin
								</button>
							</div>
						</div>
					</div>
					<aside className="relative min-w-0 self-start border-slate-200 lg:border-l lg:pl-8 dark:border-slate-700">
						<div className="flex items-center justify-between gap-3">
							<div className="flex min-w-0 items-center gap-2">
								<Icon name="box" size={18} />
								<h2 className="truncate text-base font-bold text-slate-950 dark:text-white">Presets</h2>
							</div>
							<div className="relative flex shrink-0 gap-1">
								<button
									aria-label="Copy all presets as JSON"
									className="icon-button preset-icon"
									title="Copy all presets as JSON"
									type="button"
									onClick={() => copyJson(presets, 'All presets copied as JSON.')}
								>
									<Icon name="copy" size={15} />
								</button>
								<button
									aria-label="Import presets"
									className="icon-button preset-icon"
									title="Import presets"
									type="button"
									onClick={() => setShowImport((current) => !current)}
								>
									<Icon name="upload" size={15} />
								</button>
								{showImport && (
									<div className="absolute right-0 top-full z-10 mt-2 grid w-64 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
										<textarea
											aria-label="Import preset JSON"
											className="min-h-16 min-w-0 flex-1 resize-y rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
											placeholder="Paste preset JSON"
											value={importJson}
											onChange={(event) => setImportJson(event.target.value)}
										/>
										<button
											aria-label="Add imported presets"
											className="icon-button preset-icon self-end"
											disabled={!importJson.trim()}
											title="Add imported presets"
											type="button"
											onClick={importPresets}
										>
											<Icon name="plus" size={15} />
										</button>
										{presetStatus && (
											<p className="col-span-full truncate text-xs text-slate-500 dark:text-slate-400">
												{presetStatus}
											</p>
										)}
									</div>
								)}
							</div>
						</div>
						<div className="mt-2 border-t border-slate-200 lg:-ml-8 lg:pl-8 dark:border-slate-700">
							<div className="preset-list max-h-76 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-700">
								{presets.length === 0 ?
									<p className="py-2 text-xs text-slate-400 dark:text-slate-500">No saved presets yet.</p>
								:	<>
										{presets.map((preset) => (
											<div
												key={preset.id}
												className="group relative flex min-h-8 min-w-0 items-center justify-between gap-2"
											>
												<button
													className="absolute inset-0 z-0 justify-start truncate bg-transparent px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-orange-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-orange-400"
													type="button"
													onClick={() => loadPreset(preset)}
												>
													{preset.name}
												</button>
												<div className="relative z-10 ml-auto flex shrink-0 gap-1 opacity-60 transition-opacity group-hover:opacity-100">
													<button
														aria-label={`Copy ${preset.name} as JSON`}
														className="icon-button preset-icon"
														title="Copy JSON"
														type="button"
														onClick={() => copyJson(preset, `"${preset.name}" copied as JSON.`)}
													>
														<Icon name="copy" size={15} />
													</button>
													<button
														aria-label={`Delete ${preset.name}`}
														className="icon-button preset-icon text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
														title={`Delete ${preset.name}`}
														type="button"
														onClick={() => deletePreset(preset)}
													>
														<Icon name="trash" size={15} />
													</button>
												</div>
											</div>
										))}
									</>
								}
							</div>
							<div className="flex min-h-8 min-w-0 items-center gap-2 border-t border-slate-200 px-1 dark:border-slate-700">
								<input
									aria-label="New preset name"
									className="min-w-0 flex-1 border-0 bg-transparent p-1 text-sm shadow-none focus:border-0 focus:shadow-none"
									type="text"
									placeholder="Add a new preset…"
									value={presetName}
									onChange={(event) => setPresetName(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter') savePreset();
									}}
								/>
								<button
									aria-label="Save new preset"
									className="icon-button preset-icon preset-add-icon"
									disabled={!presetName.trim()}
									title="Save new preset"
									type="button"
									onClick={savePreset}
								>
									<Icon name="plus" size={15} />
								</button>
							</div>
						</div>
					</aside>
				</div>
			</section>

			<div className="grid items-start gap-6 lg:items-stretch lg:grid-cols-2">
				<section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
					<LandingMap
						a={aValue}
						b={bValue}
						origin={origin}
						shot={shot}
						target={target}
						onAim={aimAt}
						onSteer={(nextA) => updateInput('a', String(nextA))}
					/>
				</section>

				<section
					aria-labelledby="results-heading"
					className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7"
				>
					<div className="mb-6 flex items-center justify-between gap-4">
						<div className="min-w-0">
							<p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">
								Calculated result
							</p>
							<h2 id="results-heading" className="text-2xl font-black tracking-tight">
								Landing coordinates
							</h2>
						</div>
						<div className="shrink-0 rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
							<Icon name="map" />
						</div>
					</div>
					<div className="mb-5 rounded-2xl bg-orange-50 p-5 dark:bg-orange-950/40">
						<p className="mb-4 text-sm font-semibold text-orange-700 dark:text-orange-300">Destination coordinates</p>
						<div className="grid gap-5 sm:grid-cols-3">
							<div className="min-w-0 rounded-xl border border-orange-200 bg-white/60 p-4 dark:border-orange-900 dark:bg-orange-950/30 sm:col-span-2">
								<p className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
									Nether
								</p>
								<div className="mt-3 grid grid-cols-3 gap-2 lg:gap-1 xl:gap-3">
									<div className="coordinate-cell min-w-0">
										<p className="text-xs font-semibold text-orange-700 dark:text-orange-300">X</p>
										<p className="coordinate-value font-black tracking-tight text-orange-950 dark:text-orange-100">
											{shot.landing.x.toFixed(1)}
										</p>
									</div>
									<div className="coordinate-cell min-w-0">
										<p className="text-xs font-semibold text-orange-700 dark:text-orange-300">Y</p>
										<p className="coordinate-value font-black tracking-tight text-orange-950 dark:text-orange-100">
											128
										</p>
									</div>
									<div className="coordinate-cell min-w-0">
										<p className="text-xs font-semibold text-orange-700 dark:text-orange-300">Z</p>
										<p className="coordinate-value font-black tracking-tight text-orange-950 dark:text-orange-100">
											{shot.landing.z.toFixed(1)}
										</p>
									</div>
								</div>
							</div>
							<div className="min-w-0 rounded-xl border border-sky-200 bg-white/60 p-4 dark:border-sky-900 dark:bg-sky-950/30 sm:col-span-1">
								<p className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
									Overworld · ×8
								</p>
								<div className="mt-3 grid grid-cols-2 gap-2 lg:gap-1 xl:gap-3">
									<div className="coordinate-cell min-w-0">
										<p className="text-xs font-semibold text-sky-700 dark:text-sky-300">X</p>
										<p className="coordinate-value font-black tracking-tight text-sky-950 dark:text-sky-100">
											{overworld.x.toFixed(0)}
										</p>
									</div>
									<div className="coordinate-cell min-w-0">
										<p className="text-xs font-semibold text-sky-700 dark:text-sky-300">Z</p>
										<p className="coordinate-value font-black tracking-tight text-sky-950 dark:text-sky-100">
											{overworld.z.toFixed(0)}
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						<div className="metric">
							<Icon name="box" />
							<span>Control A items</span>
							<strong>{aItems.display}</strong>
							<small>{aItems.raw}</small>
						</div>
						<div className="metric">
							<Icon name="box" />
							<span>Control B items</span>
							<strong>{bItems.display}</strong>
							<small>{bItems.raw}</small>
						</div>
						<div className="metric">
							<Icon name="map" />
							<span>Distance</span>
							<strong>{shot.distance.toFixed(0)} blocks</strong>
						</div>
						<div className="metric">
							<Icon name="clock" />
							<span>Wait accelerating (Overworld)</span>
							<strong>{acceleratingWait.display}</strong>
							<small>{acceleratingWait.seconds}</small>
						</div>
						<div className="metric">
							<Icon name="clock" />
							<span>Wait landing (Nether)</span>
							<strong>{landingWait.display}</strong>
							<small>{landingWait.seconds}</small>
						</div>
						<div className="metric">
							<Icon name="target" />
							<span>Bearing</span>
							<strong>{shot.bearing.toFixed(1)}°</strong>
						</div>
					</div>
					<div className="mt-5 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
						<div className="mb-2 flex items-center justify-between gap-3">
							<span className="text-sm font-bold">Teleport command</span>
							<button aria-label="Copy teleport command" className="icon-button" type="button" onClick={copyCommand}>
								<Icon name="copy" size={17} />
								{copied ? 'Copied' : 'Copy'}
							</button>
						</div>
						<code className="block break-all text-xs leading-relaxed text-slate-600 dark:text-slate-300">
							{command}
						</code>
					</div>
					<p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
						<strong className="text-slate-700 dark:text-slate-200">Miss vs target:</strong> {missDistance.toFixed(0)}{' '}
						blocks · Flight: {shot.ticks.toFixed()} ticks ({(shot.ticks / 20).toFixed(1)} s)
					</p>
				</section>
			</div>
		</>
	);
}
