import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { FiHeart, FiArrowRight, FiEye } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';
import { formatDate } from '../utils/formatDate';

interface PublicProject {
  id: string;
  name: string;
  description: string | null;
  projectType: string | null;
  status: string;
  startedDate: string | null;
  completedDate: string | null;
  metadata: Record<string, unknown>;
  notes: string | null;
  viewCount: number;
  publishedAt: string | null;
  primaryPhoto: { url: string; thumbnailUrl: string; caption: string | null } | null;
  photos: Array<{ url: string; thumbnailUrl: string; caption: string | null }>;
  yarn: Array<{ name: string; brand: string | null; weight: string | null; color: string | null }>;
}

const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://rowlyknit.com';

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

export default function PublicProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [error, setError] = useState<'not-found' | 'network' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get(`/shared/project/${slug}`)
      .then((res) => {
        if (cancelled) return;
        setProject(res.data.data.project);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) setError('not-found');
        else setError('network');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const seoTitle = project
    ? `${project.name} — Knitted on Rowly`
    : 'Shared Project — Rowly';
  const seoDescription = project
    ? project.description ||
      `A ${project.projectType ?? 'knitting'} project shared on Rowly.`
    : 'View this knitter’s finished project, made with Rowly.';
  const ogImage = project?.primaryPhoto?.url
    ? project.primaryPhoto.url.startsWith('http')
      ? project.primaryPhoto.url
      : `${APP_URL}${project.primaryPhoto.url}`
    : null;

  // Set <title>, description, canonical, og:title/description/url. og:image
  // is set imperatively below because useSeo doesn't manage it (it varies
  // per project rather than per route). noindex because these are personal
  // artifacts, not landing pages — knitters share by direct link.
  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonicalPath: slug ? `/p/${slug}` : undefined,
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const tags: HTMLMetaElement[] = [];
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, follow';
    document.head.appendChild(robots);
    tags.push(robots);

    if (ogImage) {
      const og = document.createElement('meta');
      og.setAttribute('property', 'og:image');
      og.content = ogImage;
      document.head.appendChild(og);
      tags.push(og);

      const tw = document.createElement('meta');
      tw.setAttribute('name', 'twitter:image');
      tw.content = ogImage;
      document.head.appendChild(tw);
      tags.push(tw);
    }
    return () => {
      for (const t of tags) t.remove();
    };
  }, [ogImage]);

  const metadataEntries = useMemo(() => {
    if (!project) return [];
    const m = project.metadata ?? {};
    const entries: Array<{ label: string; value: string }> = [];
    const gauge = m.gauge as { stitches?: number; rows?: number; measurement?: number; unit?: string } | undefined;
    if (gauge?.stitches && gauge.rows) {
      const unit = gauge.unit ?? 'in';
      const over = gauge.measurement ?? 4;
      entries.push({
        label: 'Gauge',
        value: `${gauge.stitches} sts × ${gauge.rows} rows / ${over} ${unit}`,
      });
    }
    const needles = m.needles as string | undefined;
    if (needles) entries.push({ label: 'Needles', value: needles });
    const finishedSize = m.finishedSize as string | undefined;
    if (finishedSize) entries.push({ label: 'Finished size', value: finishedSize });
    return entries;
  }, [project]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (error === 'not-found' || !project) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Project not found
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          This project is no longer public, or the link is incorrect.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
        >
          Visit Rowly
        </Link>
      </div>
    );
  }

  if (error === 'network') {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Couldn&apos;t load this project
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          Check your connection and try again.
        </p>
      </div>
    );
  }

  const completedLabel = formatDate(project.completedDate, { year: 'numeric', month: 'long', day: 'numeric' }, '');

  return (
    <article className="space-y-8">
      {project.primaryPhoto ? (
        <div className="overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
          <img
            src={project.primaryPhoto.url}
            alt={project.primaryPhoto.caption ?? project.name}
            className="h-auto w-full object-cover"
          />
        </div>
      ) : null}

      <header>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          {project.projectType ? (
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              {project.projectType}
            </span>
          ) : null}
          {completedLabel ? <span>Completed {completedLabel}</span> : null}
          <span className="inline-flex items-center gap-1">
            <FiEye className="h-3.5 w-3.5" />
            {project.viewCount + 1} views
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
          {project.name}
        </h1>
        {project.description ? (
          <p className="mt-3 max-w-2xl text-base text-gray-700 dark:text-gray-300">
            {project.description}
          </p>
        ) : null}
      </header>

      {metadataEntries.length > 0 || project.yarn.length > 0 ? (
        <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 md:p-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Project details
          </h2>
          {metadataEntries.length > 0 ? (
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {metadataEntries.map((e) => (
                <MetadataRow key={e.label} label={e.label} value={e.value} />
              ))}
            </dl>
          ) : null}
          {project.yarn.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Yarn used
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-900 dark:text-gray-100">
                {project.yarn.map((y, idx) => (
                  <li key={idx}>
                    {[y.brand, y.name, y.color, y.weight].filter(Boolean).join(' · ')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {project.notes ? (
        <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 md:p-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Notes from the maker
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {project.notes}
          </p>
        </section>
      ) : null}

      {project.photos.length > 1 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            More photos
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {project.photos.slice(1).map((p, idx) => (
              <figure key={idx} className="overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                <img src={p.url} alt={p.caption ?? `Photo ${idx + 2}`} className="h-full w-full object-cover" />
                {p.caption ? (
                  <figcaption className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                    {p.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-900/20 md:p-8">
        <div className="flex items-start gap-3">
          <FiHeart className="mt-1 h-6 w-6 flex-shrink-0 text-purple-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Made with Rowly
            </h2>
            <p className="mt-1 max-w-xl text-sm text-gray-700 dark:text-gray-300">
              Rowly is a workspace for hand knitters — track projects row-by-row, organize
              your stash, store patterns, and design your own garments.
            </p>
            <Link
              to="/"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:underline dark:text-purple-300"
            >
              Try the workspace <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
