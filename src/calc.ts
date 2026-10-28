/** Launch velocity multiplier used by the cannon model. */
export const LAUNCH_SCALE = 1.0416;
/** Converts the A-control imbalance into sideways launch velocity. */
export const SIDEWAYS_SCALE = 0.7906;
/** Vertical launch velocity added per B item. */
export const UPWARD_SCALE = 0.043;
/** Horizontal velocity retained on each game tick. */
export const HORIZONTAL_DRAG = 0.99;
/** Downward acceleration applied on each game tick. */
export const VERTICAL_ACCELERATION = 0.03;
/** Vertical distance the projectile falls before landing. */
export const FALL_DISTANCE = 113;
/** Maximum number of items that can be held by the nine-slot dropper. */
export const MAX_ITEMS = 9 * 64;

/** A position in the Minecraft X/Z plane. */
export type Point = { x: number; z: number };
/** Cannon position and its facing direction in degrees. */
export type Origin = Point & { direction: number };

/** Flight duration and horizontal drag accumulated during flight. */
export type Flight = { ticks: number; distanceFactor: number };

/** Projectile displacement and derived launch values for A and B. */
export type Projectile = Flight & {
	itemCount: number;
	effectiveA: number;
	forward: number;
	sideways: number;
	sidewaysPerA: number;
	angle: number;
};

/** Separate acceleration/loading and landing-wait durations in seconds. */
export type Timing = {
	waitAcceleratingSeconds: number;
	waitLandingSeconds: number;
};

/** Complete calculated result for one cannon shot. */
export type Shot = Projectile & {
	landing: Point;
	distance: number;
	bearing: number;
	timing: Timing;
};

/** A target solution, including any direction or fan-limit conditions. */
export type TargetSolution = {
	a: number;
	b: number;
	landing: Point;
	forwardDistance: number;
	sidewaysDistance: number;
	clampedToFan: boolean;
	behindCannon: boolean;
};

/** Rejects values that cannot participate safely in numeric calculations. */
const assertFinite = (name: string, value: number): void => {
	if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
};

/** Rejects negative values where a physical quantity must be non-negative. */
const assertNonNegative = (name: string, value: number): void => {
	assertFinite(name, value);
	if (value < 0) throw new RangeError(`${name} must be non-negative`);
};

/** Rounds A and constrains it to the available item range. */
export function clampA(value: number): number {
	assertFinite('A', value);
	return Math.max(0, Math.min(MAX_ITEMS, Math.round(value)));
}

/** Rounds B and constrains it to the valid range from one to MAX_ITEMS. */
export function clampB(value: number): number {
	assertFinite('B', value);
	return Math.max(1, Math.min(MAX_ITEMS, Math.round(value)));
}

/** Solves the projectile's flight ticks and horizontal drag factor for B. */
export function calculateFlight(b: number): Flight {
	const itemCount = clampB(b) + 1;
	const verticalVelocity = UPWARD_SCALE * itemCount;
	let lower = 0;
	let upper = 6000;

	for (let iteration = 0; iteration < 60; iteration += 1) {
		const ticks = (lower + upper) / 2;
		const distanceFactor = 1 - Math.pow(HORIZONTAL_DRAG, ticks);
		const remainingHeight =
			100 * (verticalVelocity + VERTICAL_ACCELERATION / (1 - HORIZONTAL_DRAG)) * distanceFactor -
			(VERTICAL_ACCELERATION / (1 - HORIZONTAL_DRAG)) * ticks +
			FALL_DISTANCE;
		if (remainingHeight > 0) lower = ticks;
		else upper = ticks;
	}

	return { ticks: lower, distanceFactor: 1 - Math.pow(HORIZONTAL_DRAG, lower) };
}

/** Calculates forward, sideways, and angular displacement for A and B. */
export function calculateProjectile(a: number, b: number): Projectile {
	const clampedB = clampB(b);
	const itemCount = clampedB + 1;
	const effectiveA = Math.min(clampA(a), itemCount);
	const flight = calculateFlight(clampedB);
	const sidewaysPerA = 200 * LAUNCH_SCALE * flight.distanceFactor * SIDEWAYS_SCALE;
	const angle = Math.atan2(
		SIDEWAYS_SCALE * (2 * effectiveA - itemCount),
		itemCount,
	);

	return {
		...flight,
		itemCount,
		effectiveA,
		forward: 100 * LAUNCH_SCALE * itemCount * flight.distanceFactor,
		sideways: sidewaysPerA * (effectiveA - itemCount / 2),
		sidewaysPerA,
		angle,
	};
}

/** Converts local forward/sideways displacement into world X/Z coordinates. */
export function calculateLanding(
	forward: number,
	sideways: number,
	origin: Point,
	direction: number,
): Point {
	assertNonNegative('forward', forward);
	assertFinite('sideways', sideways);
	assertFinite('origin.x', origin.x);
	assertFinite('origin.z', origin.z);
	assertFinite('direction', direction);
	const radians = (direction * Math.PI) / 180;
	return {
		x: origin.x + forward * Math.sin(radians) + sideways * Math.cos(radians),
		z: origin.z - forward * Math.cos(radians) + sideways * Math.sin(radians),
	};
}

/** Calculates straight-line distance from forward and sideways displacement. */
export function calculateDistance(forward: number, sideways: number): number {
	assertNonNegative('forward', forward);
	assertFinite('sideways', sideways);
	return Math.hypot(forward, sideways);
}

/** Converts a world point into coordinates relative to the cannon's facing. */
export function calculateRelativeCoordinates(
	point: Point,
	origin: Point,
	direction: number,
): Point {
	assertFinite('point.x', point.x);
	assertFinite('point.z', point.z);
	assertFinite('origin.x', origin.x);
	assertFinite('origin.z', origin.z);
	assertFinite('direction', direction);
	const radians = (direction * Math.PI) / 180;
	const deltaX = point.x - origin.x;
	const deltaZ = point.z - origin.z;
	return {
		x: deltaX * Math.cos(radians) + deltaZ * Math.sin(radians),
		z: deltaX * Math.sin(radians) - deltaZ * Math.cos(radians),
	};
}

/** Calculates the straight-line distance between an actual and target point. */
export function calculateMissDistance(actual: Point, target: Point): number {
	assertFinite('actual.x', actual.x);
	assertFinite('actual.z', actual.z);
	assertFinite('target.x', target.x);
	assertFinite('target.z', target.z);
	return Math.hypot(actual.x - target.x, actual.z - target.z);
}

/** Calculates a compass bearing from north, clockwise from 0 to 360 degrees. */
export function calculateBearing(landing: Point, origin: Point, direction: number): number {
	assertFinite('landing.x', landing.x);
	assertFinite('landing.z', landing.z);
	assertFinite('origin.x', origin.x);
	assertFinite('origin.z', origin.z);
	assertFinite('direction', direction);
	const radians = Math.atan2(landing.x - origin.x, -(landing.z - origin.z));
	return ((radians * 180) / Math.PI + 360) % 360;
}

/** Estimates the separate waits for accelerating the cannon and reaching the landing. */
export function calculateTiming(forward: number, sideways: number, itemCount: number): Timing {
	assertNonNegative('itemCount', itemCount);
	const waitAcceleratingSeconds = 6.6 + 0.3 * itemCount;
	return {
		waitAcceleratingSeconds,
		waitLandingSeconds: Math.max(0, 0.5 * Math.sqrt(calculateDistance(forward, sideways)) - 15),
	};
}

/** Calculates all projectile, landing, distance, bearing, and timing outputs. */
export function calculateShot(a: number, b: number, origin: Origin): Shot {
	const projectile = calculateProjectile(a, b);
	const landing = calculateLanding(projectile.forward, projectile.sideways, origin, origin.direction);
	return {
		...projectile,
		landing,
		distance: calculateDistance(projectile.forward, projectile.sideways),
		bearing: calculateBearing(landing, origin, origin.direction),
		timing: calculateTiming(projectile.forward, projectile.sideways, projectile.itemCount),
	};
}

/** Converts Nether coordinates to Overworld coordinates using a scale factor. */
export function calculateOverworld(point: Point, scale = 8): Point {
	assertFinite('point.x', point.x);
	assertFinite('point.z', point.z);
	assertFinite('scale', scale);
	return { x: point.x * scale, z: point.z * scale };
}

/** Finds A and B values that most closely reach a target point. */
export function solveTarget(target: Point, origin: Origin): TargetSolution {
	assertFinite('target.x', target.x);
	assertFinite('target.z', target.z);
	assertFinite('origin.x', origin.x);
	assertFinite('origin.z', origin.z);
	assertFinite('origin.direction', origin.direction);

	const relativeTarget = calculateRelativeCoordinates(target, origin, origin.direction);
	const forwardDistance = relativeTarget.z;
	const sidewaysDistance = relativeTarget.x;

	if (forwardDistance <= 0) {
		return { a: 0, b: 1, landing: target, forwardDistance, sidewaysDistance, clampedToFan: false, behindCannon: true };
	}

	let lower = 1;
	let upper = MAX_ITEMS;
	for (let iteration = 0; iteration < 50; iteration += 1) {
		const b = (lower + upper) / 2;
		if (calculateProjectile(0, b).forward < forwardDistance) lower = b;
		else upper = b;
	}

	let b = clampB(Math.round(lower));
	if (calculateProjectile(0, b).forward < forwardDistance && b >= MAX_ITEMS) b = MAX_ITEMS;

	const projectile = calculateProjectile(0, b);
	const unclampedA = projectile.itemCount / 2 + sidewaysDistance / projectile.sidewaysPerA;
	const clampedToFan = unclampedA < 0 || unclampedA > projectile.itemCount;
	const a = clampA(unclampedA);

	return {
		a,
		b,
		landing: calculateShot(a, b, origin).landing,
		forwardDistance,
		sidewaysDistance,
		clampedToFan,
		behindCannon: false,
	};
}

/** Generates local fan boundary/sample points for every reachable A value. */
export function createFan(
	b: number,
	step = Math.max(1, Math.floor((clampB(b) + 1) / 80)),
): Point[] {
	const clampedB = clampB(b);
	if (!Number.isInteger(step) || step < 1) {
		throw new RangeError('step must be a positive integer');
	}
	const points: Point[] = [];
	for (let a = 0; a <= clampedB + 1; a += step) {
		const projectile = calculateProjectile(a, clampedB);
		points.push({ x: projectile.sideways, z: projectile.forward });
	}
	const endpoint = calculateProjectile(clampedB + 1, clampedB);
	const last = points[points.length - 1];
	if (!last || last.x !== endpoint.sideways || last.z !== endpoint.forward) {
		points.push({ x: endpoint.sideways, z: endpoint.forward });
	}
	return points;
}