import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MeasurementsFields from './MeasurementsFields';
import { useAuthStore } from '../../stores/authStore';

describe('MeasurementsFields', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', email: 'a@b.c' } as any,
      accessToken: 'tok',
    });
  });

  it('renders the body group expanded by default with the 9 CYC fields', () => {
    render(<MeasurementsFields value={{}} onChange={vi.fn()} />);
    // Section heading
    expect(screen.getByText('Measurements')).toBeInTheDocument();
    // The body section is expanded by default — every CYC body field
    // should have a label.
    expect(screen.getByText('Chest / bust')).toBeInTheDocument();
    expect(screen.getByText('Waist')).toBeInTheDocument();
    expect(screen.getByText('Hip')).toBeInTheDocument();
    expect(screen.getByText('Back waist length')).toBeInTheDocument();
    expect(screen.getByText('Cross back')).toBeInTheDocument();
    expect(screen.getByText('Center back to wrist')).toBeInTheDocument();
    expect(screen.getByText('Arm length')).toBeInTheDocument();
    expect(screen.getByText('Upper arm')).toBeInTheDocument();
    expect(screen.getByText('Armhole depth')).toBeInTheDocument();
  });

  it('keeps foot / hand / head sections collapsed initially', () => {
    render(<MeasurementsFields value={{}} onChange={vi.fn()} />);
    // Group headings render in their toggle buttons
    expect(screen.getByRole('button', { name: /Foot/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hand/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Head/ })).toBeInTheDocument();
    // But their fields aren't rendered yet
    expect(screen.queryByText('Foot length')).not.toBeInTheDocument();
    expect(screen.queryByText('Hand circumference')).not.toBeInTheDocument();
  });

  it('expands a collapsed section when clicked', () => {
    render(<MeasurementsFields value={{}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Foot/ }));
    expect(screen.getByText('Foot length')).toBeInTheDocument();
    expect(screen.getByText('Sock height')).toBeInTheDocument();
  });

  it('passes inches up unchanged when the user is in inches mode', () => {
    const onChange = vi.fn();
    render(<MeasurementsFields value={{}} onChange={onChange} />);
    const chestField = screen.getByText('Chest / bust').closest('label')?.querySelector('input');
    expect(chestField).not.toBeNull();
    fireEvent.change(chestField!, { target: { value: '38' } });
    expect(onChange).toHaveBeenLastCalledWith({ chest: 38 });
  });

  it('clears a field when the user empties the input', () => {
    const onChange = vi.fn();
    render(<MeasurementsFields value={{ chest: 38 }} onChange={onChange} />);
    const chestField = screen.getByText('Chest / bust').closest('label')?.querySelector('input');
    fireEvent.change(chestField!, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('shows the count badge when a group has filled fields', () => {
    render(
      <MeasurementsFields
        value={{ chest: 38, waist: 30, hip: 40 }}
        onChange={vi.fn()}
      />
    );
    // Body section toggle should now show "3 values"
    expect(screen.getByText(/3 values/)).toBeInTheDocument();
  });

  it('rounds existing values for display rather than showing raw decimals', () => {
    render(
      <MeasurementsFields
        value={{ chest: 38.123456 }}
        onChange={vi.fn()}
      />
    );
    const chestField = screen.getByText('Chest / bust').closest('label')?.querySelector('input');
    expect((chestField as HTMLInputElement).value).toBe('38.12');
  });

  it('converts cm input to inches when user prefers cm display', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'u1',
        email: 'a@b.c',
        preferences: { measurements: { lengthDisplayUnit: 'cm' } },
      } as any,
      accessToken: 'tok',
    });
    const onChange = vi.fn();
    render(<MeasurementsFields value={{}} onChange={onChange} />);
    expect(screen.getByText(/Inputs in cm/)).toBeInTheDocument();
    const chestField = screen.getByText(/Chest \/ bust/).closest('label')?.querySelector('input');
    fireEvent.change(chestField!, { target: { value: '100' } });
    // 100cm -> ~39.37in
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.chest).toBeCloseTo(39.37, 1);
  });
});
