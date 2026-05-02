import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HelloCoach } from '../../app/src/screens/HelloCoach';
import { useAppStore } from '../../app/src/store/useAppStore';

describe('<HelloCoach />', () => {
  it('renders an h1 greeting using the store default userName', () => {
    render(<HelloCoach />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Hello, Coach');
  });

  it('reacts to store updates', () => {
    useAppStore.setState({ userName: 'Matt' });
    render(<HelloCoach />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, Matt');
    useAppStore.setState({ userName: 'Coach' });
  });

  it('has no axe-core accessibility violations', async () => {
    const { container } = render(<HelloCoach />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
