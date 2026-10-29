import { useMemo, useState, type ReactNode } from 'react';

import { MAX_ITEMS, calculateMissDistance, calculateOverworld, calculateShot, solveTarget, type Origin, type Point } from './calc';
import { Icon, type IconName } from './components/Icon';
import { LandingMap } from './components/LandingMap';

const DEFAULT_ORIGIN: Origin = { x: 8.49, z: 15.64, direction: 0 };

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

function App() {
	const [originX, setOriginX] = useState(String(DEFAULT_ORIGIN.x));
	const [originZ, setOriginZ] = useState(String(DEFAULT_ORIGIN.z));
	const [direction, setDirection] = useState(String(DEFAULT_ORIGIN.direction));
	const [a, setA] = useState('40');
	const [b, setB] = useState('64');
	const [targetX, setTargetX] = useState('-2000');
	const [targetZ, setTargetZ] = useState('-6000');
	const [copied, setCopied] = useState(false);

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
		setTargetX(String(point.x.toFixed(1)));
		setTargetZ(String(point.z.toFixed(1)));
		const solution = solveTarget(point, origin);
		if (solution.behindCannon) return;
		setA(String(solution.a));
		setB(String(solution.b));
	};

	const solve = () => {
		aimAt(target);
	};

	const reset = () => {
		setOriginX(String(DEFAULT_ORIGIN.x));
		setOriginZ(String(DEFAULT_ORIGIN.z));
		setDirection(String(DEFAULT_ORIGIN.direction));
	};

	const copyCommand = async () => {
		await navigator.clipboard.writeText(command);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1600);
	};

	return (
		<main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
			<div className="mx-auto max-w-[120rem]">
				<header className="mb-8">
					<div className="mb-3 inline-flex rounded-2xl bg-orange-100 p-3 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
						<Icon name="cannon" size={26} />
					</div>
					<h1 className="text-3xl font-black tracking-tight sm:text-4xl">Ender-pearl cannon</h1>
					<p className="mt-2 max-w-xl text-slate-500 dark:text-slate-400">
						Plan a shot, tune the controls, and get a ready-to-use teleport command.
					</p>
				</header>

				<section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
					<div className="grid gap-8 lg:grid-cols-3">
						<div>
							<SectionHeading description="Where the cannon is located." icon="pin" title="Origin" />
							<div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
								<Field label="X">
									<input
										type="number"
										step="any"
										value={originX}
										onChange={(event) => setOriginX(event.target.value)}
									/>
								</Field>
								<Field label="Z">
									<input
										type="number"
										step="any"
										value={originZ}
										onChange={(event) => setOriginZ(event.target.value)}
									/>
								</Field>
								<Field label="Facing">
									<select value={direction} onChange={(event) => setDirection(event.target.value)}>
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
								<Field hint="0–576 items" label="A · sideways">
									<input
										type="number"
										min="0"
										max={MAX_ITEMS}
										step="1"
										value={a}
										onChange={(event) => {
											const nextA = Math.min(MAX_ITEMS, Math.max(0, Math.round(Number(event.target.value) || 0)));
											setA(String(nextA));
										}}
									/>
									{aExceedsDirectionLimit && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">A above B + 1 is ignored for sideways direction.</span>}
								</Field>
								<Field hint={`1–${MAX_ITEMS} items`} label="B · forward">
									<input
										type="number"
										min="1"
										max={MAX_ITEMS}
										step="1"
										value={b}
										onChange={(event) => {
											const nextB = Math.min(MAX_ITEMS, Math.max(1, Math.round(Number(event.target.value) || 1)));
											setB(String(nextB));
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
										onChange={(event) => setTargetX(event.target.value)}
									/>
								</Field>
								<Field label="Target Z">
									<input
										type="number"
										step="any"
										value={targetZ}
										onChange={(event) => setTargetZ(event.target.value)}
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
							onSteer={(nextA) => setA(String(nextA))}
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
											<p className="coordinate-value font-black tracking-tight text-orange-950 dark:text-orange-100">128</p>
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
			</div>
		</main>
	);
}

export default App;
