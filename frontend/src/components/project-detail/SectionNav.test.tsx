import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import SectionNav, { type SectionDefinition } from './SectionNav';

beforeAll(() => {
  if (!('IntersectionObserver' in window)) {
    class FakeIO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as any).IntersectionObserver = FakeIO;
  }
});

beforeEach(() => {
  document.body.innerHTML = '';
});

function mountSections(ids: string[]) {
  for (const id of ids) {
    const el = document.createElement('section');
    el.id = `section-${id}`;
    document.body.appendChild(el);
  }
}

describe('SectionNav', () => {
  it('renders one pill per visible section and skips hidden ones', () => {
    mountSections(['about', 'photos']);
    const sections: SectionDefinition[] = [
      { id: 'about', label: 'About' },
      { id: 'design', label: 'Design', visible: false },
      { id: 'photos', label: 'Photos' },
    ];
    render(<SectionNav sections={sections} />);
    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Photos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Design' })).toBeNull();
  });

  it('renders a colored status dot when a pill has a status', () => {
    mountSections(['yarn']);
    const sections: SectionDefinition[] = [
      { id: 'yarn', label: 'Yarn', status: 'ready', detail: '2 assigned' },
    ];
    const { container } = render(<SectionNav sections={sections} />);
    const dot = container.querySelector('button[data-section-id="yarn"] > span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain('bg-green-500');
  });

  it('omits the dot when no status is provided', () => {
    mountSections(['photos']);
    const sections: SectionDefinition[] = [{ id: 'photos', label: 'Photos' }];
    const { container } = render(<SectionNav sections={sections} />);
    const dot = container.querySelector('button[data-section-id="photos"] > span[aria-hidden="true"]');
    expect(dot).toBeNull();
  });

  it('uses the detail string as the tooltip and aria-label', () => {
    mountSections(['tools']);
    const sections: SectionDefinition[] = [
      {
        id: 'tools',
        label: 'Tools',
        status: 'conflict',
        detail: 'Missing 2 needle sizes',
      },
    ];
    render(<SectionNav sections={sections} />);
    const btn = screen.getByRole('button', { name: 'Tools: Missing 2 needle sizes' });
    expect(btn).toHaveAttribute('title', 'Missing 2 needle sizes');
  });

  it('falls back to the label as aria-label when detail is absent', () => {
    mountSections(['photos']);
    const sections: SectionDefinition[] = [{ id: 'photos', label: 'Photos' }];
    render(<SectionNav sections={sections} />);
    const btn = screen.getByRole('button', { name: 'Photos' });
    expect(btn).not.toHaveAttribute('title');
  });

  it('maps each status to its corresponding dot color', () => {
    mountSections(['a', 'b', 'c', 'd']);
    const sections: SectionDefinition[] = [
      { id: 'a', label: 'A', status: 'ready' },
      { id: 'b', label: 'B', status: 'missing' },
      { id: 'c', label: 'C', status: 'conflict' },
      { id: 'd', label: 'D', status: 'optional' },
    ];
    const { container } = render(<SectionNav sections={sections} />);
    const dot = (id: string) =>
      container.querySelector(`button[data-section-id="${id}"] > span[aria-hidden="true"]`);
    expect(dot('a')?.className).toContain('bg-green-500');
    expect(dot('b')?.className).toContain('bg-gray-300');
    expect(dot('c')?.className).toContain('bg-red-500');
    expect(dot('d')?.className).toContain('bg-gray-200');
  });

  it('jumps to the section anchor on click', () => {
    mountSections(['counters']);
    const sections: SectionDefinition[] = [{ id: 'counters', label: 'Counters' }];
    let scrolled = false;
    window.scrollTo = (() => {
      scrolled = true;
    }) as typeof window.scrollTo;
    render(<SectionNav sections={sections} />);
    fireEvent.click(screen.getByRole('button', { name: 'Counters' }));
    expect(scrolled).toBe(true);
  });

  it('returns null when no sections are visible', () => {
    const { container } = render(
      <SectionNav sections={[{ id: 'a', label: 'A', visible: false }]} />,
    );
    expect(container.querySelector('nav')).toBeNull();
  });
});
