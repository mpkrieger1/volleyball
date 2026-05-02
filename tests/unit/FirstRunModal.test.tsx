import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { FirstRunModal } from '../../app/src/components/FirstRunModal';
import { useSettingsStore } from '../../app/src/store/useSettingsStore';

beforeEach(() => {
  // Reset Zustand store + localStorage between tests.
  window.localStorage.clear();
  useSettingsStore.setState({
    fontSize: 'md',
    diagnosticsEnabled: false,
    hasCompletedFirstRun: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FirstRunModal', () => {
  it('renders the first slide title on mount', () => {
    render(<FirstRunModal onClose={() => undefined} />);
    expect(screen.getByText(/Welcome to NCAA Volleyball Coach Dynasty/i)).toBeInTheDocument();
  });

  it('Skip closes the modal AND sets hasCompletedFirstRun (without enabling diagnostics)', () => {
    const onClose = vi.fn();
    render(<FirstRunModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().hasCompletedFirstRun).toBe(true);
    expect(useSettingsStore.getState().diagnosticsEnabled).toBe(false);
  });

  it('Next advances slides and shows the diagnostics checkbox on the last slide', async () => {
    const user = userEvent.setup();
    render(<FirstRunModal onClose={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Pick a team/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Win it all/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('Get started honors the diagnostics checkbox value', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FirstRunModal onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().hasCompletedFirstRun).toBe(true);
    expect(useSettingsStore.getState().diagnosticsEnabled).toBe(true);
  });

  it('Get started without checking keeps diagnostics off', async () => {
    const user = userEvent.setup();
    render(<FirstRunModal onClose={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    expect(useSettingsStore.getState().diagnosticsEnabled).toBe(false);
  });

  it('Esc dismisses the modal as Skip', () => {
    const onClose = vi.fn();
    render(<FirstRunModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().diagnosticsEnabled).toBe(false);
  });

  it('arrow keys navigate slides', () => {
    render(<FirstRunModal onClose={() => undefined} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Pick a team/i)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Win it all/i)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/Pick a team/i)).toBeInTheDocument();
  });

  it('passes axe-core with zero violations', async () => {
    const { container } = render(<FirstRunModal onClose={() => undefined} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
