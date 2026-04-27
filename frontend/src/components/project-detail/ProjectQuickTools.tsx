import { Link } from 'react-router-dom';
import { FiGrid } from 'react-icons/fi';

interface ProjectQuickToolsProps {
  projectId: string;
}

// Surface the calculators inside a project so a knitter mid-swatch
// doesn't have to navigate away to /calculators and lose context. Each
// link carries projectId + a return URL so the calculator can save
// results back to this project (via SaveCalcToProjectModal) without the
// user re-picking it from a list.
export default function ProjectQuickTools({ projectId }: ProjectQuickToolsProps) {
  const back = encodeURIComponent(`/projects/${projectId}`);
  const ctx = `?projectId=${projectId}&returnTo=${back}`;
  const links: Array<{ label: string; href: string; tooltip: string }> = [
    {
      label: 'Check gauge',
      href: `/calculators/gauge${ctx}`,
      tooltip: 'Compare your swatch to the pattern target',
    },
    {
      label: 'Find a size',
      href: `/calculators/gift-size${ctx}`,
      tooltip: 'Pick a pattern size from a chest measurement',
    },
    {
      label: 'Substitute yarn',
      href: `/calculators/yarn-sub${ctx}`,
      tooltip: 'Rank your stash against a pattern requirement',
    },
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800/60 dark:bg-purple-900/10">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
        <FiGrid className="h-3.5 w-3.5" />
        Tools
      </span>
      {links.map((link) => (
        <Link
          key={link.href}
          to={link.href}
          title={link.tooltip}
          className="rounded-md border border-purple-200 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:bg-gray-700"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
