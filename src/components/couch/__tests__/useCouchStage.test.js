import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { coverBox } from '../../camera/cameraMath';
import useCouchStage from '../useCouchStage';

function Harness() {
  const { containerRef, box } = useCouchStage(2, [0.5, 0.5], 0);
  const [shown, setShown] = useState(true);
  return (
    <div>
      <button onClick={() => setShown((v) => !v)}>toggle</button>
      {shown && <div ref={containerRef} data-testid="box" />}
      <output data-testid="out">{box ? `${box.width}x${box.height}` : 'none'}</output>
    </div>
  );
}

test('the stage re-measures when its container unmounts and mounts again', () => {
  const dims = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get');
  const dimsH = jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get');
  dims.mockReturnValue(1000);
  dimsH.mockReturnValue(500);
  render(<Harness />);
  expect(screen.getByTestId('out').textContent).toBe('1000x500');
  fireEvent.click(screen.getByText('toggle'));
  expect(screen.getByTestId('out').textContent).toBe('none');
  dims.mockReturnValue(800);
  dimsH.mockReturnValue(800);
  act(() => {
    fireEvent.click(screen.getByText('toggle'));
  });
  expect(screen.getByTestId('out').textContent).not.toBe('none');
  expect(screen.getByTestId('out').textContent).not.toBe('1000x500');
  dims.mockRestore();
  dimsH.mockRestore();
});

test('the first render already has a box, sized from the window under the bar, and the measure keeps it', () => {
  const boxes = [];
  function First() {
    const { containerRef, box } = useCouchStage(2, [50, 50], 57);
    boxes.push(box);
    return <div ref={containerRef} />;
  }
  const dims = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(window.innerWidth);
  const dimsH = jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(window.innerHeight - 57);
  try {
    render(<First />);
    const seeded = coverBox({ width: window.innerWidth, height: window.innerHeight - 57 }, 2, [50, 50]);
    expect(boxes[0]).toEqual(seeded);
    // Never a render without a box while the container measures.
    boxes.forEach((b) => expect(b).toEqual(seeded));
  } finally {
    dims.mockRestore();
    dimsH.mockRestore();
  }
});
