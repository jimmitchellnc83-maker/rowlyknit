import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OnboardingGoalCard from './OnboardingGoalCard';

describe('OnboardingGoalCard', () => {
  it('renders the question and all five goal options', () => {
    render(<OnboardingGoalCard onSelect={() => undefined} onSkip={() => undefined} />);
    expect(screen.getByRole('heading', { name: /What do you want to do first/i })).toBeInTheDocument();
    expect(screen.getByText(/Track an active project/i)).toBeInTheDocument();
    expect(screen.getByText(/Organize my stash/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow a pattern without losing my place/i)).toBeInTheDocument();
    expect(screen.getByText(/Design something new/i)).toBeInTheDocument();
    expect(screen.getByText(/Explore with example data/i)).toBeInTheDocument();
  });

  it('calls onSelect with the chosen goal id', () => {
    const onSelect = vi.fn();
    render(<OnboardingGoalCard onSelect={onSelect} onSkip={() => undefined} />);
    fireEvent.click(screen.getByText(/Organize my stash/i).closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('organize_stash');
  });

  it('calls onSkip when the skip link is clicked', () => {
    const onSkip = vi.fn();
    render(<OnboardingGoalCard onSelect={() => undefined} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables every button when saving is true', () => {
    render(<OnboardingGoalCard onSelect={() => undefined} onSkip={() => undefined} saving />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });
});
