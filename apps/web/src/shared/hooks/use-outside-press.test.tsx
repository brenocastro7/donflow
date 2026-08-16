import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOutsidePress } from './use-outside-press';

afterEach(cleanup);

describe('useOutsidePress', () => {
  it('ignores internal presses and handles external presses', () => {
    const onOutsidePress = vi.fn();

    function TestLayer() {
      const ref = useOutsidePress<HTMLDivElement>(true, onOutsidePress);
      return <div ref={ref}>Conteúdo da caixa</div>;
    }

    render(<TestLayer />);

    fireEvent.pointerDown(screen.getByText('Conteúdo da caixa'));
    expect(onOutsidePress).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(onOutsidePress).toHaveBeenCalledOnce();
  });
});
