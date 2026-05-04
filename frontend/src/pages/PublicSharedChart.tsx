import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { FiDownload, FiHeart, FiArrowRight, FiLock } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';

/**
 * Public-facing recipient page for shared knitting charts.
 *
 * The share_url returned by POST /api/charts/:id/share now points HERE
 * (`/c/:token`) — not at the backend JSON endpoint. This page:
 *
 *   1. fetches GET /shared/chart/:token (axios → withCredentials so the
 *      access cookie rides on retries);
 *   2. on 401 password_required, shows a password form;
 *   3. submits POST /shared/chart/:token/access — the backend sets a
 *      path-scoped httpOnly cookie + returns the access token;
 *   4. retries the GET; on success, renders the chart;
 *   5. download buttons hit /shared/chart/:token/download?format=… via
 *      a same-origin link, so the access cookie is sent automatically.
 *
 * The password is NEVER appended to a URL — neither for view nor for
 * download. `?password=…` on either endpoint is rejected by the backend
 * regardless of value.
 */

interface SharedChartResponse {
  chart: {
    id: string;
    name: string;
    grid: unknown;
    rows: number;
    columns: number;
    symbol_legend: Record<string, string> | null;
    description: string | null;
  };
  share_options: {
    allow_copy: boolean;
    allow_download: boolean;
    visibility: string;
  };
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'password_required' }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }
  | { kind: 'rate_limited'; retryAfterSeconds: number | null }
  | { kind: 'ok'; data: SharedChartResponse };

function pickRetryAfter(headers: Record<string, string> | undefined): number | null {
  if (!headers) return null;
  const raw = headers['retry-after'];
  if (!raw) return null;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Normalize a stored chart grid into a 2-D array of cell strings. The
 * canonical shape is `string[][]`; some legacy charts store flat arrays
 * with row/col counts. We render whatever we can and fall back to an
 * empty grid rather than crashing on a recipient.
 */
function asGrid(
  grid: unknown,
  rows: number,
  columns: number
): string[][] {
  if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
    return (grid as unknown[][]).map((row) =>
      (row as unknown[]).map((cell) => (cell == null ? '' : String(cell)))
    );
  }
  if (Array.isArray(grid) && rows > 0 && columns > 0) {
    const flat = (grid as unknown[]).map((c) => (c == null ? '' : String(c)));
    const out: string[][] = [];
    for (let r = 0; r < rows; r += 1) {
      out.push(flat.slice(r * columns, (r + 1) * columns));
    }
    return out;
  }
  return [];
}

export default function PublicSharedChart() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchChart = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!token) {
        setState({ kind: 'not_found' });
        return;
      }
      try {
        const res = await axios.get<SharedChartResponse>(
          `/shared/chart/${encodeURIComponent(token)}`,
          { signal }
        );
        setState({ kind: 'ok', data: res.data });
      } catch (err) {
        if (axios.isCancel(err)) return;
        const ax = err as AxiosError<{ password_protected?: boolean; error?: string }>;
        if (ax.response?.status === 401 && ax.response.data?.password_protected) {
          setState({ kind: 'password_required' });
          return;
        }
        if (ax.response?.status === 404) {
          setState({ kind: 'not_found' });
          return;
        }
        if (ax.response?.status === 429) {
          setState({
            kind: 'rate_limited',
            retryAfterSeconds: pickRetryAfter(
              ax.response.headers as Record<string, string>
            ),
          });
          return;
        }
        setState({
          kind: 'error',
          message: ax.message || 'Network error',
        });
      }
    },
    [token]
  );

  useEffect(() => {
    const ctl = new AbortController();
    setState({ kind: 'loading' });
    void fetchChart(ctl.signal);
    return () => ctl.abort();
  }, [fetchChart]);

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!token || !password) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        await axios.post(
          `/shared/chart/${encodeURIComponent(token)}/access`,
          { password }
        );
        // Cookie is now set; refetch the chart with the credential.
        setState({ kind: 'loading' });
        setPassword('');
        await fetchChart();
      } catch (err) {
        const ax = err as AxiosError<{ error?: string }>;
        if (ax.response?.status === 401) {
          setSubmitError('Incorrect password — please try again.');
        } else if (ax.response?.status === 429) {
          const retry = pickRetryAfter(
            ax.response.headers as Record<string, string>
          );
          setSubmitError(
            retry
              ? `Too many attempts. Please try again in ${Math.ceil(retry / 60)} minute(s).`
              : 'Too many password attempts. Please try again later.'
          );
        } else if (ax.response?.status === 404) {
          setState({ kind: 'not_found' });
        } else {
          setSubmitError(
            ax.response?.data?.error || ax.message || 'Could not verify password.'
          );
        }
      } finally {
        setSubmitting(false);
      }
    },
    [token, password, fetchChart]
  );

  const seoTitle =
    state.kind === 'ok' ? `${state.data.chart.name} — Rowly` : 'Shared chart — Rowly';
  useSeo({
    title: seoTitle,
    description:
      state.kind === 'ok'
        ? state.data.chart.description ||
          `View this knitting chart shared with you on Rowly.`
        : 'View a knitting chart shared with you on Rowly.',
    canonicalPath: token ? `/c/${token}` : undefined,
  });

  // noindex — these are personal artifacts, not landing-page content
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, follow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  const downloadHref = useMemo(() => {
    if (!token || state.kind !== 'ok' || !state.data.share_options.allow_download)
      return null;
    return `/shared/chart/${encodeURIComponent(token)}/download?format=pdf`;
  }, [token, state]);

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (state.kind === 'password_required') {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-8">
          <div className="mb-4 flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <FiLock className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-lg font-semibold">Password required</h1>
          </div>
          <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
            This chart is password-protected. Enter the password the sender
            shared with you to view it.
          </p>
          <form onSubmit={handlePasswordSubmit} noValidate>
            <label
              htmlFor="share-password"
              className="block text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              Password
            </label>
            <input
              id="share-password"
              name="password"
              type="password"
              autoComplete="off"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            {submitError ? (
              <p
                role="alert"
                className="mt-2 text-sm text-red-600 dark:text-red-400"
              >
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting || password.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Verifying…' : 'Unlock chart'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (state.kind === 'not_found') {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Chart not found
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          This chart link is no longer active, or the URL is incorrect.
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

  if (state.kind === 'rate_limited') {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Too many requests
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          Please wait{' '}
          {state.retryAfterSeconds
            ? `${Math.ceil(state.retryAfterSeconds / 60)} minute(s)`
            : 'a few minutes'}{' '}
          and try again.
        </p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Couldn&apos;t load this chart
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          {state.message}
        </p>
      </div>
    );
  }

  const { chart, share_options } = state.data;
  const grid = asGrid(chart.grid, chart.rows, chart.columns);

  return (
    <article className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:py-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
          {chart.name}
        </h1>
        {chart.description ? (
          <p className="max-w-2xl text-sm text-gray-700 dark:text-gray-300">
            {chart.description}
          </p>
        ) : null}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {chart.rows} rows × {chart.columns} columns
        </div>
      </header>

      {grid.length > 0 ? (
        <section
          aria-label="Chart grid"
          className="overflow-auto rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="inline-block">
            {grid.map((row, rIdx) => (
              <div
                key={rIdx}
                className="flex"
                role="row"
              >
                {row.map((cell, cIdx) => (
                  <div
                    key={cIdx}
                    role="gridcell"
                    className="flex h-8 w-8 select-none items-center justify-center border border-gray-200 text-xs text-gray-800 dark:border-gray-700 dark:text-gray-200"
                  >
                    {cell || ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No grid data available for this chart.
        </p>
      )}

      {chart.symbol_legend && Object.keys(chart.symbol_legend).length > 0 ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Legend
          </h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 md:grid-cols-3">
            {Object.entries(chart.symbol_legend).map(([sym, label]) => (
              <div key={sym} className="flex items-center gap-2">
                <dt className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-gray-50 font-mono text-xs dark:border-gray-600 dark:bg-gray-900">
                  {sym}
                </dt>
                <dd className="text-gray-700 dark:text-gray-300">{label}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {share_options.allow_download && downloadHref ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <a
            href={downloadHref}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <FiDownload className="h-4 w-4" aria-hidden="true" />
            Download PDF
          </a>
        </section>
      ) : null}

      <section className="rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-900/20">
        <div className="flex items-start gap-3">
          <FiHeart className="mt-1 h-6 w-6 flex-shrink-0 text-purple-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Shared with Rowly
            </h2>
            <p className="mt-1 max-w-xl text-sm text-gray-700 dark:text-gray-300">
              Rowly is a workspace for hand knitters — track projects row-by-row,
              organize your stash, store patterns, and design your own garments.
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
