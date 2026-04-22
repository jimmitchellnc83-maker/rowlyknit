import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import YarnLabelCapture from './YarnLabelCapture';

// Both scanning libs are dynamic-imported inside the component; mock them so
// we don't need the real wasm/camera stack in unit tests.
vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromVideoDevice: vi.fn().mockResolvedValue({ stop: vi.fn() }),
  })),
}));
vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn().mockResolvedValue({ data: { text: 'Dye lot: 1234AB' } }),
  },
}));

describe('YarnLabelCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with two tabs', () => {
    render(<YarnLabelCapture onClose={vi.fn()} onExtracted={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /scan yarn label/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /scan barcode/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /photo \+ ocr/i })).toBeInTheDocument();
  });

  it('defaults to the Barcode tab', () => {
    render(<YarnLabelCapture onClose={vi.fn()} onExtracted={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /scan barcode/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches to the OCR tab on click', () => {
    render(<YarnLabelCapture onClose={vi.fn()} onExtracted={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: /photo \+ ocr/i }));
    expect(screen.getByRole('tab', { name: /photo \+ ocr/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The OCR tab has a distinctive file-input tip.
    expect(screen.getByText(/tapping the file picker/i)).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<YarnLabelCapture onClose={onClose} onExtracted={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables "Use this barcode" until a barcode is captured', () => {
    render(<YarnLabelCapture onClose={vi.fn()} onExtracted={vi.fn()} />);
    expect(screen.getByRole('button', { name: /use this barcode/i })).toBeDisabled();
  });

  it('disables "Use extracted fields" until OCR yields data', () => {
    render(<YarnLabelCapture onClose={vi.fn()} onExtracted={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: /photo \+ ocr/i }));
    expect(screen.getByRole('button', { name: /use extracted fields/i })).toBeDisabled();
  });
});
