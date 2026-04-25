import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OnboardingGoalCard from './OnboardingGoalCard';

describe('OnboardingGoalCard', () => {
  it('renders the question and all five goal options', () => {
    render(<OnboardingGoalCard onSelect={() => undefined} onSkip={() => undefined} />);
    expect(screen.getByRole('heading', { name: /What do you want to do first/i })).toBeInTheDocument();
    expect(screen.getByText(/Track my current project/i)).toBeInTheDocument();
    expect(screen.getByText(/Organize yarn, tools, and supplies/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow a pattern step by step/i)).toBeInTheDocument();
    expect(screen.getByText(/Design a pattern or garment/i)).toBeInTheDocument();
    expect(screen.getByText(/Show me how Rowly works/i)).toBeInTheDocument();
  });

  it('calls onSelect with the chosen goal id', () => {
    const onSelect = vi.fn();
    render(<OnboardingGoalCard onSelect={onSelect} onSkip={() => undefined} />);
    fireEvent.click(screen.getByText(/Organize yarn, tools, and supplies/i).closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('organize_stash');
  });

  it('renders Follow a pattern as the first option', () => {
    render(<OnboardingGoalCard onSelect={() => undefined} onSkip={() => undefined} />);
    const buttons = screen.getAllByRole('button').filter((btn) => btn.textContent?.includes('step by step') || btn.textContent?.includes('current project') || btn.textContent?.includes('pattern or garment') || btn.textContent?.includes('yarn, tools') || btn.textContent?.includes('how Rowly works'));
    expect(buttons[0].textContent).toMatch(/Follow a pattern step by step/);
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
