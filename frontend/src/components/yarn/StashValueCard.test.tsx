import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import StashValueCard from './StashValueCard';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StashValueCard />
    </QueryClientProvider>,
  );
}

function mockStats(overrides: Partial<Record<string, number | string>> = {}) {
  return {
    data: {
      success: true,
      data: {
        stats: {
          total_count: 10,
          total_skeins: 40,
          total_yards: 8000,
          total_value_current: 320.55,
          total_value_all_time: 410.0,
          priced_count: 8,
          unpriced_count: 2,
          ...overrides,
        },
      },
    },
  };
}

describe('StashValueCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders current stash value as currency', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(mockStats());
    renderCard();
    await waitFor(() => expect(screen.getByText(/\$320\.55/)).toBeInTheDocument());
    expect(screen.getByText(/\$410\.00/)).toBeInTheDocument();
  });

  it('surfaces unpriced coverage warning', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(mockStats());
    renderCard();
    await waitFor(() => screen.getByText(/2 yarns without a price/i));
    expect(screen.getByText(/lower bound/i)).toBeInTheDocument();
  });

  it('shows the "every yarn has a price" message when unpriced_count is 0', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(mockStats({ unpriced_count: 0, priced_count: 10 }));
    renderCard();
    await waitFor(() => screen.getByText(/every yarn has a price/i));
  });

  it('computes average per skein as current value / total skeins', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(
      mockStats({ total_value_current: 100, total_skeins: 10 }),
    );
    renderCard();
    await waitFor(() => expect(screen.getByText(/\$10\.00/)).toBeInTheDocument());
  });

  it('renders em-dash for average when total_skeins is 0', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(
      mockStats({ total_skeins: 0, total_value_current: 0 }),
    );
    renderCard();
    await waitFor(() => screen.getByText(/avg \/ skein/i));
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('handles numeric strings from pg (numeric columns return strings)', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(
      mockStats({
        total_value_current: '320.55',
        total_value_all_time: '410.00',
        total_skeins: '40',
        priced_count: '8',
        unpriced_count: '2',
      }),
    );
    renderCard();
    await waitFor(() => expect(screen.getByText(/\$320\.55/)).toBeInTheDocument());
  });
});
