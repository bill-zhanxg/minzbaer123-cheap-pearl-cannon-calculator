import { Icon } from './Icon';

export function ReportsTab() {
	return (
		<section
			aria-labelledby="reports-heading"
			className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-12"
		>
			<div className="mx-auto mb-4 inline-flex rounded-2xl bg-orange-100 p-3 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
				<Icon name="map" size={26} />
			</div>
			<h2 id="reports-heading" className="text-2xl font-black tracking-tight">
				Data collection reports
			</h2>
			<p className="mx-auto mt-2 max-w-lg text-slate-500 dark:text-slate-400">
				Reports will appear here once data collection is available.
			</p>
		</section>
	);
}
