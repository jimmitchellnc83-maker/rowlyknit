import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Glossary from './Glossary';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

const SAMPLE_ROWS = [
  {
    id: 'a1',
    abbreviation: 'k',
    expansion: 'knit',
    description: null,
    craft: 'knit',
    category: 'stitch',
  },
  {
    id: 'a2',
    abbreviation: 'k2tog',
    expansion: 'knit 2 stitches together',
    description: 'Right-leaning decrease — 1 stitch decreased.',
    craft: 'knit',
    category: 'decrease',
  },
  {
    id: 'a3',
    abbreviation: 'sc',
    expansion: 'single crochet',
    description: null,
    craft: 'crochet',
    category: 'stitch',
  },
];

const SAMPLE_CATEGORIES = [
  { category: 'stitch', count: 12 },
  { category: 'decrease', count: 4 },
];

function setupAxios(rows = SAMPLE_ROWS, cats = SAMPLE_CATEGORIES) {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === '/shared/glossary/categories') {
      return Promise.resolve({ data: { data: cats } });
    }
    if (url === '/shared/glossary') {
      return Promise.resolve({ data: { data: rows } });
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}

function renderAt(initialUrl = '/help/glossary') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/help/glossary" element={<Glossary />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Glossary page', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    setupAxios();
  });

  it('renders the page heading and source attribution', async () => {
    renderAt();
    expect(
      screen.getByRole('heading', { name: /Knitting & Crochet Abbreviations/i })
    ).toBeInTheDocument();
    await waitFor(() => {
      // The footer attribution is the only place "Source:" appears.
      expect(screen.getByText(/Source:/)).toBeInTheDocument();
    });
    expect(
      screen.getByRole('link', { name: /www\.YarnStandards\.com/ })
    ).toBeInTheDocument();
  });

  it('fetches abbreviations and renders rows grouped by craft', async () => {
    renderAt();
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith('/shared/glossary', expect.anything())
    );

    expect(await screen.findByText('k2tog')).toBeInTheDocument();
    expect(screen.getByText('knit 2 stitches together')).toBeInTheDocument();
    expect(screen.getByText('single crochet')).toBeInTheDocument();
    // Craft headers from the two distinct crafts in SAMPLE_ROWS
    expect(screen.getByRole('heading', { name: 'Knit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Crochet' })).toBeInTheDocument();
  });

  it('passes the craft filter through to the API when a craft button is clicked', async () => {
    renderAt();
    await screen.findByText('k2tog');

    fireEvent.click(screen.getByRole('button', { name: 'Crochet' }));

    await waitFor(() => {
      const lastCall = mockedAxios.get.mock.calls
        .filter((c) => c[0] === '/shared/glossary')
        .pop();
      expect(lastCall?.[1]).toMatchObject({ params: { craft: 'crochet' } });
    });
  });

  it('honors a deep-link search param on first render', async () => {
    renderAt('/help/glossary?craft=knit&search=cable');
    await waitFor(() => {
      const matched = mockedAxios.get.mock.calls.find(
        (c) =>
          c[0] === '/shared/glossary' &&
          c[1]?.params?.craft === 'knit' &&
          c[1]?.params?.search === 'cable'
      );
      expect(matched).toBeTruthy();
    });
  });

  it('clears all filters when "Clear all filters" is clicked', async () => {
    renderAt('/help/glossary?craft=knit');
    await screen.findByText('k2tog');

    const clearBtn = await screen.findByRole('button', { name: /clear all filters/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      const lastCall = mockedAxios.get.mock.calls
        .filter((c) => c[0] === '/shared/glossary')
        .pop();
      expect(lastCall?.[1]?.params?.craft).toBeUndefined();
    });
  });

  it('shows a friendly empty-state when no rows match', async () => {
    setupAxios([], []);
    renderAt();
    await screen.findByText(/No abbreviations match those filters/);
  });

  it('shows a 429-specific error when rate-limited', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === '/shared/glossary/categories') {
        return Promise.resolve({ data: { data: [] } });
      }
      const err: any = new Error('429');
      err.response = { status: 429 };
      return Promise.reject(err);
    });
    renderAt();
    await screen.findByText(/refreshing this a lot/);
  });
});
