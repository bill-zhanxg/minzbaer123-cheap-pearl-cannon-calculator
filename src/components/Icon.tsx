import type { ReactNode } from 'react';

export type IconName = 'cannon' | 'pin' | 'sliders' | 'target' | 'map' | 'clock' | 'box' | 'copy' | 'trash' | 'upload' | 'plus';

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
	const paths: Record<IconName, ReactNode> = {
		cannon: <><path d="M4 20h16" /><path d="M6 17V9l9-4 3 3-4 2v7" /><path d="m15 5 2-2 4 4-2 2" /></>,
		pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
		sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></>,
		target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
		map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
		clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
		box: <><path d="m21 8-9 5-9-5 9-5 9 5Z" /><path d="M3 8v9l9 5 9-5V8M12 13v9" /></>,
		copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
		trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M9 7V4h6v3m-9 0 1 13h10l1-13" /></>,
		upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M5 13v6h14v-6" /></>,
		plus: <><path d="M12 5v14M5 12h14" /></>,
	};

	return (
		<svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
			{paths[name]}
		</svg>
	);
}
