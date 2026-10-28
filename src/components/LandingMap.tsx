import { useCallback, useEffect, useRef, useState } from 'react';

import {
	calculateLanding,
	calculateMissDistance,
	calculateProjectile,
	calculateRelativeCoordinates,
	clampA,
	createFan,
	solveTarget,
	type Origin,
	type Point,
	type Shot,
} from '../calc';

type View = { cx: number; cz: number; scale: number };

type DragKind = 'pan' | 'landing' | 'target' | 'path' | 'fan';

type DragState = {
	kind: DragKind;
	pointerId: number;
	lastX: number;
	lastY: number;
	point: Point;
};

type Overlay = {
	x: number;
	z: number;
	screenX: number;
	screenY: number;
	distance: number;
	miss: number;
	label: string;
};

type LandingMapProps = {
	origin: Origin;
	shot: Shot;
	target: Point;
	a: number;
	b: number;
	onAim: (point: Point) => void;
	onSteer: (a: number) => void;
};

const MIN_SCALE = 0.004;
const MAX_SCALE = 8;
const HANDLE = 16;

const MEASURED_SHOTS: Point[] = [
	{ x: 117.64, z: -261.45 },
	{ x: 227.27, z: -261.45 },
	{ x: -53.15, z: -1608.23 },
	{ x: -3235.24, z: -5908.87 },
	{ x: -834.88, z: -2690.13 },
	{ x: -19384.78, z: -26580.01 },
	{ x: 642.71, z: -786.85 },
	{ x: 4548.53, z: -5908.87 },
	{ x: 4692.67, z: -5908.87 },
	{ x: -21136.37, z: -40044.22 },
	{ x: -36967.69, z: -60078.72 },
	{ x: -4532.53, z: -5908.87 },
	{ x: -70.7, z: -12824.42 },
	{ x: 2147.62, z: -2690.13 },
];

const formatCoord = (value: number) =>
	value.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const formatWorld = (value: number) => {
	const abs = Math.abs(value);
	if (abs >= 10000) return `${(value / 1000).toFixed(0)}k`;
	if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`;
	return String(+value.toFixed(1));
};

const niceTicks = (start: number, end: number, count: number) => {
	const span = (end - start) / count;
	const power = Math.pow(10, Math.floor(Math.log10(Math.max(span, 1e-6))));
	const unit = [1, 2, 5, 10].map((k) => k * power).find((k) => k >= span) ?? power;
	const ticks: number[] = [];
	for (let value = Math.ceil(start / unit) * unit; value <= end + 1e-9; value += unit) {
		ticks.push(+value.toFixed(6));
	}
	return ticks;
};

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

const worldToScreen = (point: Point, view: View, size: number): Point => ({
	x: (point.x - view.cx) * view.scale + size / 2,
	z: (point.z - view.cz) * view.scale + size / 2,
});

const screenToWorld = (x: number, z: number, view: View, size: number): Point => ({
	x: (x - size / 2) / view.scale + view.cx,
	z: (z - size / 2) / view.scale + view.cz,
});

const distanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
	const dx = bx - ax;
	const dy = by - ay;
	const length = dx * dx + dy * dy;
	const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const projectOntoRay = (origin: Point, landing: Point, point: Point): Point => {
	const dx = landing.x - origin.x;
	const dz = landing.z - origin.z;
	const length = Math.hypot(dx, dz) || 1;
	const along = Math.max(0, ((point.x - origin.x) * dx + (point.z - origin.z) * dz) / length);
	return { x: origin.x + (dx / length) * along, z: origin.z + (dz / length) * along };
};

const fanWorldPoints = (origin: Origin, b: number) =>
	createFan(b).map((point) => calculateLanding(point.z, point.x, origin, origin.direction));

const fitView = (points: Point[], size: number): View => {
	const xs = points.map((point) => point.x);
	const zs = points.map((point) => point.z);
	const x0 = Math.min(...xs);
	const x1 = Math.max(...xs);
	const z0 = Math.min(...zs);
	const z1 = Math.max(...zs);
	const span = Math.max(x1 - x0, z1 - z0, 80) * 1.28;
	return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale: clampScale(size / span) };
};

const hitKind = (
	x: number,
	y: number,
	view: View,
	size: number,
	origin: Point,
	landing: Point,
	target: Point,
	fan: Point[],
): DragKind => {
	const landingScreen = worldToScreen(landing, view, size);
	if (Math.hypot(x - landingScreen.x, y - landingScreen.z) <= HANDLE) return 'landing';

	const targetScreen = worldToScreen(target, view, size);
	if (Math.hypot(x - targetScreen.x, y - targetScreen.z) <= HANDLE) return 'target';

	for (let i = 1; i < fan.length; i += 1) {
		const a = worldToScreen(fan[i - 1], view, size);
		const b = worldToScreen(fan[i], view, size);
		if (distanceToSegment(x, y, a.x, a.z, b.x, b.z) <= 10) return 'fan';
	}

	const originScreen = worldToScreen(origin, view, size);
	if (distanceToSegment(x, y, originScreen.x, originScreen.z, landingScreen.x, landingScreen.z) <= 10) {
		return 'path';
	}

	return 'pan';
};

const cursorFor = (kind: DragKind, dragging: boolean) => {
	if (dragging && kind === 'pan') return 'grabbing';
	if (kind === 'pan') return 'grab';
	if (dragging) return 'grabbing';
	return 'pointer';
};

export function LandingMap({ origin, shot, target, a, b, onAim, onSteer }: LandingMapProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const wrapRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<View>({ cx: origin.x, cz: origin.z, scale: 0.04 });
	const dragRef = useRef<DragState | null>(null);
	const fittedRef = useRef(false);
	const propsRef = useRef({ origin, shot, target, a, b, onAim, onSteer });
	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [cursor, setCursor] = useState('grab');
	const [hint, setHint] = useState('Drag the orange landing or the target. Hold Ctrl and scroll to zoom.');

	propsRef.current = { origin, shot, target, a, b, onAim, onSteer };

	const makeOverlay = (point: Point, screenX: number, screenY: number, label: string): Overlay => ({
		x: point.x,
		z: point.z,
		screenX,
		screenY,
		distance: Math.hypot(point.x - origin.x, point.z - origin.z),
		miss: calculateMissDistance(shot.landing, point),
		label,
	});

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;

		const size = canvas.clientWidth;
		if (size < 8) return;

		const { origin, shot, target, b } = propsRef.current;
		const fan = fanWorldPoints(origin, b);
		if (!fittedRef.current) {
			viewRef.current = fitView([origin, shot.landing, target, ...fan], size);
			fittedRef.current = true;
		}

		const view = viewRef.current;
		const pixelRatio = window.devicePixelRatio || 1;
		canvas.width = size * pixelRatio;
		canvas.height = size * pixelRatio;
		const context = canvas.getContext('2d');
		if (!context) return;

		context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		const styles = getComputedStyle(wrap);
		const color = (name: string) => styles.getPropertyValue(name).trim();
		const toScreen = (point: Point) => worldToScreen(point, view, size);

		context.fillStyle = color('--map-bg');
		context.fillRect(0, 0, size, size);

		const left = view.cx - size / 2 / view.scale;
		const right = view.cx + size / 2 / view.scale;
		const top = view.cz - size / 2 / view.scale;
		const bottom = view.cz + size / 2 / view.scale;

		context.lineWidth = 1;
		context.font = '11px Inter, ui-sans-serif, system-ui, sans-serif';
		niceTicks(left, right, 6).forEach((value) => {
			const x = toScreen({ x: value, z: 0 }).x;
			context.strokeStyle = color('--map-grid');
			context.beginPath();
			context.moveTo(x, 0);
			context.lineTo(x, size);
			context.stroke();
			context.fillStyle = color('--map-muted');
			context.fillText(formatWorld(value), x + 4, size - 8);
		});
		niceTicks(top, bottom, 6).forEach((value) => {
			const y = toScreen({ x: 0, z: value }).z;
			context.strokeStyle = color('--map-grid');
			context.beginPath();
			context.moveTo(0, y);
			context.lineTo(size, y);
			context.stroke();
			context.fillStyle = color('--map-muted');
			context.fillText(formatWorld(value), 6, y - 5);
		});

		context.strokeStyle = color('--map-muted');
		context.lineWidth = 1.5;
		MEASURED_SHOTS.forEach((shotPoint) => {
			const screen = toScreen(shotPoint);
			context.beginPath();
			context.arc(screen.x, screen.z, 3.5, 0, Math.PI * 2);
			context.stroke();
		});

		const originScreen = toScreen(origin);
		const landingScreen = toScreen(shot.landing);
		const targetScreen = toScreen(target);
		const fanScreen = fan.map(toScreen);

		context.strokeStyle = color('--map-blue');
		context.lineWidth = 2.5;
		context.globalAlpha = 0.85;
		context.beginPath();
		fanScreen.forEach((point, index) => {
			if (index === 0) context.moveTo(point.x, point.z);
			else context.lineTo(point.x, point.z);
		});
		context.stroke();
		context.globalAlpha = 0.55;
		context.setLineDash([5, 4]);
		context.lineWidth = 1.25;
		[fanScreen[0], fanScreen[fanScreen.length - 1]].forEach((point) => {
			if (!point) return;
			context.beginPath();
			context.moveTo(originScreen.x, originScreen.z);
			context.lineTo(point.x, point.z);
			context.stroke();
		});
		context.setLineDash([]);
		context.globalAlpha = 1;

		context.strokeStyle = color('--map-orange');
		context.lineWidth = 3;
		context.beginPath();
		context.moveTo(originScreen.x, originScreen.z);
		context.lineTo(landingScreen.x, landingScreen.z);
		context.stroke();

		context.fillStyle = color('--map-fg');
		context.fillRect(originScreen.x - 5, originScreen.z - 5, 10, 10);

		context.strokeStyle = color('--map-fg');
		context.lineWidth = 2;
		context.beginPath();
		context.moveTo(targetScreen.x - 8, targetScreen.z - 8);
		context.lineTo(targetScreen.x + 8, targetScreen.z + 8);
		context.moveTo(targetScreen.x + 8, targetScreen.z - 8);
		context.lineTo(targetScreen.x - 8, targetScreen.z + 8);
		context.stroke();
		context.beginPath();
		context.arc(targetScreen.x, targetScreen.z, 11, 0, Math.PI * 2);
		context.stroke();

		context.fillStyle = color('--map-orange');
		context.beginPath();
		context.arc(landingScreen.x, landingScreen.z, 8, 0, Math.PI * 2);
		context.fill();
		context.strokeStyle = color('--map-bg');
		context.lineWidth = 2;
		context.stroke();

		context.fillStyle = color('--map-fg');
		context.font = '700 13px Inter, ui-sans-serif, system-ui, sans-serif';
		context.fillText('N ↑', size - 38, 22);
	}, []);

	useEffect(() => {
		draw();
	}, [a, b, draw, origin, shot, target]);

	useEffect(() => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		const observer = new ResizeObserver(() => draw());
		observer.observe(wrap);
		return () => observer.disconnect();
	}, [draw]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const onNativeWheel = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) return;
			event.preventDefault();
			const rect = canvas.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;
			const size = rect.width;
			const before = screenToWorld(x, y, viewRef.current, size);
			const nextScale = clampScale(viewRef.current.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
			viewRef.current = {
				scale: nextScale,
				cx: before.x - (x - size / 2) / nextScale,
				cz: before.z - (y - size / 2) / nextScale,
			};
			draw();
		};
		canvas.addEventListener('wheel', onNativeWheel, { passive: false });
		return () => canvas.removeEventListener('wheel', onNativeWheel);
	}, [draw]);

	const pointerLocation = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top, size: rect.width };
	};

	const applyDrag = (kind: DragKind, point: Point, screenX: number, screenY: number) => {
		const { origin, shot, b, onAim, onSteer } = propsRef.current;
		if (kind === 'fan') {
			const projectile = calculateProjectile(0, b);
			const relative = calculateRelativeCoordinates(point, origin, origin.direction);
			onSteer(clampA(projectile.itemCount / 2 + relative.x / projectile.sidewaysPerA));
			setOverlay(makeOverlay(point, screenX, screenY, 'Fan aim'));
			return;
		}
		const aimed = kind === 'path' ? projectOntoRay(origin, shot.landing, point) : point;
		onAim(aimed);
		setOverlay(
			makeOverlay(
				aimed,
				screenX,
				screenY,
				kind === 'path' ? 'Predicted path' : kind === 'landing' ? 'Landing' : 'Target',
			),
		);
	};

	const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const { x, y, size } = pointerLocation(event);
		const { origin, shot, target, b } = propsRef.current;
		const fan = fanWorldPoints(origin, b);
		const kind = hitKind(x, y, viewRef.current, size, origin, shot.landing, target, fan);
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = {
			kind,
			pointerId: event.pointerId,
			lastX: x,
			lastY: y,
			point: screenToWorld(x, y, viewRef.current, size),
		};
		setCursor(cursorFor(kind, true));
		if (kind !== 'pan') {
			event.preventDefault();
			applyDrag(kind, screenToWorld(x, y, viewRef.current, size), x, y);
		}
	};

	const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const { x, y, size } = pointerLocation(event);
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) {
			const { origin, shot, target, b } = propsRef.current;
			const kind = hitKind(x, y, viewRef.current, size, origin, shot.landing, target, fanWorldPoints(origin, b));
			setCursor(cursorFor(kind, false));
			setHint(
				kind === 'landing'
					? 'Drag landing to pick a new destination. A and B update as you move.'
					: kind === 'target'
						? 'Drag the target ring to aim. Coordinates and distance stay on screen.'
						: kind === 'path'
							? 'Drag the orange path to change range while keeping this heading.'
							: kind === 'fan'
								? 'Drag the blue fan to steer with A, without changing B.'
								: 'Drag the map to pan. Hold Ctrl and scroll to zoom.',
			);
			return;
		}

		event.preventDefault();
		if (drag.kind === 'pan') {
			viewRef.current = {
				...viewRef.current,
				cx: viewRef.current.cx - (x - drag.lastX) / viewRef.current.scale,
				cz: viewRef.current.cz - (y - drag.lastY) / viewRef.current.scale,
			};
			drag.lastX = x;
			drag.lastY = y;
			draw();
			return;
		}

		applyDrag(drag.kind, screenToWorld(x, y, viewRef.current, size), x, y);
	};

	const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
		if (dragRef.current?.pointerId !== event.pointerId) return;
		dragRef.current = null;
		setOverlay(null);
		const { x, y, size } = pointerLocation(event);
		const { origin, shot, target, b } = propsRef.current;
		setCursor(
			cursorFor(hitKind(x, y, viewRef.current, size, origin, shot.landing, target, fanWorldPoints(origin, b)), false),
		);
	};

	const zoomBy = (factor: number) => {
		const view = viewRef.current;
		viewRef.current = { ...view, scale: clampScale(view.scale * factor) };
		draw();
	};

	const resetView = () => {
		const size = canvasRef.current?.clientWidth ?? 0;
		const { origin, shot, target, b } = propsRef.current;
		viewRef.current = fitView([origin, shot.landing, target, ...fanWorldPoints(origin, b)], size);
		draw();
	};

	const overlayLeft = overlay ? Math.min(overlay.screenX + 18, (wrapRef.current?.clientWidth ?? 320) - 196) : 0;
	const overlayTop = overlay ? Math.max(12, overlay.screenY - 86) : 0;

	return (
		<div className="grid gap-3 lg:flex lg:h-full lg:flex-col">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">
						Shot map
					</p>
					<p className="text-sm text-slate-500 dark:text-slate-400">{hint}</p>
				</div>
				<div className="map-controls flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
					<button
						aria-label="Zoom out"
						className="map-control-button"
						title="Zoom out"
						type="button"
						onClick={() => zoomBy(1 / 1.2)}
					>
						−
					</button>
					<button
						aria-label="Zoom in"
						className="map-control-button"
						title="Zoom in"
						type="button"
						onClick={() => zoomBy(1.2)}
					>
						+
					</button>
					<button
						aria-label="Fit map view"
						className="map-control-button map-fit-button"
						title="Fit map view"
						type="button"
						onClick={resetView}
					>
						Fit view
					</button>
				</div>
			</div>
			<div
				ref={wrapRef}
				className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white lg:min-h-0 lg:flex-1 [--map-bg:#ffffff] [--map-blue:#0284c7] [--map-fg:#0f172a] [--map-grid:#e2e8f0] [--map-muted:#64748b] [--map-orange:#ea580c] dark:border-slate-700 dark:bg-slate-900 dark:[--map-bg:#0f172a] dark:[--map-blue:#38bdf8] dark:[--map-fg:#f8fafc] dark:[--map-grid:#1e293b] dark:[--map-muted:#94a3b8] dark:[--map-orange:#fb923c]"
			>
				<canvas
					ref={canvasRef}
					aria-label="Interactive landing map. Drag to pan, hold Control and scroll to zoom, drag landing or target to aim."
					className="block aspect-square w-full touch-none"
					role="application"
					style={{ cursor }}
					tabIndex={0}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={endDrag}
					onPointerCancel={endDrag}
				/>
				{overlay && (
					<div
						className="pointer-events-none absolute z-10 min-w-44 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/95"
						style={{ left: overlayLeft, top: overlayTop }}
					>
						<p className="text-[11px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
							{overlay.label}
						</p>
						<p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
							X {formatCoord(overlay.x)}
							<span className="mx-1 text-slate-400">·</span>
							Z {formatCoord(overlay.z)}
						</p>
						<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
							{overlay.distance.toFixed(0)} blocks from cannon
						</p>
						<p className="text-xs text-slate-500 dark:text-slate-400">
							Miss {overlay.miss.toFixed(0)} blocks
						</p>
					</div>
				)}
			</div>
			<div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 sm:text-[11px]">
				<span>Orange path · shot</span>
				<span>Blue fan · reachable A</span>
				<span>Rings · measured</span>
			</div>
		</div>
	);
}
