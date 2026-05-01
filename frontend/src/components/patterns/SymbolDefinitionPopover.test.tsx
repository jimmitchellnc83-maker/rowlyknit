import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SymbolDefinitionPopover from './SymbolDefinitionPopover';

const SYMBOL = {
  id: 'k2tog',
  symbol: '/',
  name: 'Knit 2 Together',
  abbreviation: 'k2tog',
  description: 'Right-leaning decrease.',
  instructions: 'Knit two stitches as one.',
  category: 'decrease',
  color: '#ef4444',
  rsInstruction: 'k2tog',
  wsInstruction: 'p2tog tbl',
  difficulty: 'easy',
} as any;

const SYMBOL_NO_ABBR = {
  id: 'unknown',
  symbol: '?',
  name: 'Unknown',
  abbreviation: '',
  description: '',
  instructions: '',
  category: 'basic',
  color: '#6b7280',
  difficulty: 'basic',
} as any;

describe('SymbolDefinitionPopover glossary deep-link', () => {
  it('renders a "View in glossary" link when an abbreviation is set', () => {
    render(
      <SymbolDefinitionPopover
        symbol={SYMBOL}
        position={{ x: 0, y: 0 }}
        instanceCount={1}
        onClose={vi.fn()}
      />
    );
    const link = screen.getByRole('link', { name: /View "k2tog" in glossary/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      '/help/glossary?term=k2tog&craft=knit'
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('uses the supplied craft prop in the deep-link query string', () => {
    render(
      <SymbolDefinitionPopover
        symbol={SYMBOL}
        position={{ x: 0, y: 0 }}
        instanceCount={1}
        onClose={vi.fn()}
        craft="crochet"
      />
    );
    const link = screen.getByRole('link', { name: /View "k2tog" in glossary/i });
    expect(link).toHaveAttribute(
      'href',
      '/help/glossary?term=k2tog&craft=crochet'
    );
  });

  it('URL-encodes special characters in the abbreviation', () => {
    render(
      <SymbolDefinitionPopover
        symbol={{ ...SYMBOL, abbreviation: '[ ]' }}
        position={{ x: 0, y: 0 }}
        instanceCount={1}
        onClose={vi.fn()}
      />
    );
    const link = screen.getByRole('link', { name: /View "\[ \]" in glossary/i });
    expect(link).toHaveAttribute(
      'href',
      '/help/glossary?term=%5B%20%5D&craft=knit'
    );
  });

  it('does NOT render the glossary link when the symbol has no abbreviation', () => {
    render(
      <SymbolDefinitionPopover
        symbol={SYMBOL_NO_ABBR}
        position={{ x: 0, y: 0 }}
        instanceCount={1}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.queryByRole('link', { name: /in glossary/i })
    ).not.toBeInTheDocument();
  });
});
