import { useState } from 'react';

import { Icon } from './components/Icon';
import { InteractiveCalculator } from './components/InteractiveCalculator';
import { ReportsTab } from './components/ReportsTab';

type Tab = 'interactive' | 'reports';

function App() {
	const [activeTab, setActiveTab] = useState<Tab>('interactive');

	return (
		<main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
			<div className="mx-auto max-w-[120rem]">
				<header className="mb-4 flex flex-wrap items-start justify-between gap-6">
					<div>
						<div className="mb-3 inline-flex rounded-2xl bg-orange-100 p-3 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
							<Icon name="cannon" size={26} />
						</div>
						<h1 className="text-3xl font-black tracking-tight sm:text-4xl">Ender-pearl cannon</h1>
						<p className="mt-2 max-w-xl text-slate-500 dark:text-slate-400">
							Plan a shot, tune the controls, and get a ready-to-use teleport command.
						</p>
					</div>

					<nav
						aria-label="Application sections"
						role="tablist"
						className="flex shrink-0 gap-1 self-end border-b border-slate-200 dark:border-slate-800"
					>
						<button
							type="button"
							role="tab"
							className={`rounded-b-none border border-b-0 px-3 py-2 text-xs ${
								activeTab === 'interactive'
									? 'border-slate-200 bg-white text-orange-700 dark:border-slate-800 dark:bg-slate-900 dark:text-orange-300'
									: 'secondary border-transparent'
							}`}
							aria-selected={activeTab === 'interactive'}
							onClick={() => setActiveTab('interactive')}
						>
							<Icon name="sliders" size={15} />
							Interactive
						</button>
						<button
							type="button"
							role="tab"
							className={`rounded-b-none border border-b-0 px-3 py-2 text-xs ${
								activeTab === 'reports'
									? 'border-slate-200 bg-white text-orange-700 dark:border-slate-800 dark:bg-slate-900 dark:text-orange-300'
									: 'secondary border-transparent'
							}`}
							aria-selected={activeTab === 'reports'}
							onClick={() => setActiveTab('reports')}
						>
							<Icon name="map" size={15} />
							Reports
						</button>
					</nav>
				</header>

				<div hidden={activeTab !== 'interactive'}>
					<InteractiveCalculator />
				</div>
				<div hidden={activeTab !== 'reports'}>
					<ReportsTab />
				</div>
			</div>
		</main>
	);
}

export default App;
