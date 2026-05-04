/**
 * QA sprint 2026-05-04: secondary photos in the public FO share page
 * (`/p/:slug` "More photos" grid) used to render with no `loading="lazy"`,
 * forcing recipients on slow mobile connections to download every photo
 * up front. This test renders the page with a mocked /shared/project
 * response and pins `loading="lazy"` on the secondary <img> tags.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import PublicProjectPage from './PublicProjectPage';

vi.mock('axios');

const sampleProject = {
  id: 'p1',
  name: 'Sample Cardigan',
  description: null,
  projectType: 'sweater',
  status: 'completed',
  startedDate: null,
  completedDate: '2026-04-30',
  metadata: {},
  notes: null,
  viewCount: 0,
  publishedAt: '2026-05-01',
  primaryPhoto: {
    url: 'https://example.test/p1-primary.jpg',
    thumbnailUrl: 'https://example.test/p1-primary.jpg',
    caption: null,
  },
  photos: [
    {
      url: 'https://example.test/p1-primary.jpg',
      thumbnailUrl: 'https://example.test/p1-primary.jpg',
      caption: null,
    },
    {
      url: 'https://example.test/p1-secondary-1.jpg',
      thumbnailUrl: 'https://example.test/p1-secondary-1.jpg',
      caption: 'Detail shot',
    },
    {
      url: 'https://example.test/p1-secondary-2.jpg',
      thumbnailUrl: 'https://example.test/p1-secondary-2.jpg',
      caption: null,
    },
  ],
  yarn: [],
};

describe('PublicProjectPage — More photos lazy load', () => {
  beforeEach(() => {
    vi.mocked(axios).get = vi
      .fn()
      .mockResolvedValue({ data: { data: { project: sampleProject } } });
  });

  it('lazy-loads secondary photos but leaves the hero photo eager', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/p/sample-cardigan']}>
        <Routes>
          <Route path="/p/:slug" element={<PublicProjectPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for the secondary grid to render — the hero <img> arrives first.
    await waitFor(() => {
      const figures = container.querySelectorAll('figure img');
      expect(figures.length).toBeGreaterThanOrEqual(2);
    });

    const figureImgs = Array.from(container.querySelectorAll('figure img'));
    expect(figureImgs.length).toBe(2);
    for (const img of figureImgs) {
      expect(img.getAttribute('loading')).toBe('lazy');
    }

    // The above-the-fold hero image should NOT be lazy — it's the first
    // thing the recipient sees and lazy-loading it costs perceived speed.
    const heroImg = container.querySelector(
      'img[src="https://example.test/p1-primary.jpg"]:not(figure img)',
    );
    if (heroImg) {
      expect(heroImg.getAttribute('loading')).not.toBe('lazy');
    }
  });
});
