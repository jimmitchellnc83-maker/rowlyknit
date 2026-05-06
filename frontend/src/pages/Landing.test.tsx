import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
import { PUBLIC_TOOL_LIST } from '../lib/publicTools';

// The landing page is the only path a logged-out visitor has to discover
// the public calculators. These tests pin the discoverability contract:
// nav, hero CTA, and the 5-tool section all link out to /calculators or
// individual tool routes — and none of those links are mobile-hidden.

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

function getLinksByHref(href: string) {
  return screen
    .getAllByRole('link')
    .filter((node) => node.getAttribute('href') === href);
}

describe('Landing page — public tools discovery', () => {
  it('renders a primary nav with a Tools link to /calculators', () => {
    renderLanding();
    const primaryNav = screen.getByRole('navigation', { name: /primary/i });
    const toolsLink = within(primaryNav).getByRole('link', { name: /^tools$/i });
    expect(toolsLink).toHaveAttribute('href', '/calculators');
  });

  it('Tools nav link is visible at all viewport widths (no hidden/sm:inline gating)', () => {
    renderLanding();
    const primaryNav = screen.getByRole('navigation', { name: /primary/i });
    const toolsLink = within(primaryNav).getByRole('link', { name: /^tools$/i });
    // The PublicLayout regression we are guarding against was a `hidden`
    // class with no responsive override below `sm`. We assert the link
    // never relies on a >=sm-only display utility for visibility.
    const className = toolsLink.className;
    expect(className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(className).not.toMatch(/sm:inline\b/);
    expect(className).not.toMatch(/sm:block\b/);
  });

  it('hero has a real /calculators link, not just an in-page anchor', () => {
    renderLanding();
    const calculatorsLinks = getLinksByHref('/calculators');
    // At minimum: 1 in nav + 1 in hero CTA + 1 "See all" footer in tools section
    expect(calculatorsLinks.length).toBeGreaterThanOrEqual(2);
    // The hero CTA copy is the spec-mandated headline.
    expect(
      screen.getByRole('link', { name: /try free knitting tools/i }),
    ).toHaveAttribute('href', '/calculators');
  });

  it('renders the public tools section with all 5 wired tools as links', () => {
    renderLanding();
    const section = screen.getByRole('heading', {
      name: /try free knitting and crochet tools/i,
    }).closest('section');
    expect(section).not.toBeNull();

    PUBLIC_TOOL_LIST.forEach((tool) => {
      // The card uses a stable test id so renames in the public-tool
      // registry don't silently drop a card from the homepage.
      const card = screen.getByTestId(`landing-tool-${tool.id}`);
      expect(card).toHaveAttribute('href', tool.route);
      // Card should display the tool's title.
      expect(within(card).getByText(tool.title)).toBeInTheDocument();
    });
  });

  it('section copy reinforces "use free, save when ready" framing', () => {
    renderLanding();
    // Both the hero subhead and the section sub-copy carry the message;
    // we expect at least one occurrence so SEO + visitors see it.
    const matches = screen.getAllByText(
      /use the tools free\. save results to rowly when you're ready/i,
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('every tool card links to a path under /calculators/* (no auth gate copy)', () => {
    renderLanding();
    PUBLIC_TOOL_LIST.forEach((tool) => {
      const card = screen.getByTestId(`landing-tool-${tool.id}`);
      const href = card.getAttribute('href') ?? '';
      expect(href.startsWith('/calculators/')).toBe(true);
      // Cards should not require auth language.
      expect(within(card).queryByText(/sign\s*up|log\s*in|account/i)).toBeNull();
    });
  });

  it('"See all calculators" footer link points at the index', () => {
    renderLanding();
    const seeAll = screen.getByRole('link', { name: /see all calculators/i });
    expect(seeAll).toHaveAttribute('href', '/calculators');
  });
});
