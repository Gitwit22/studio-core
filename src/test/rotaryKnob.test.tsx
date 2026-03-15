import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RotaryKnob from "../components/studio/RotaryKnob";

describe("RotaryKnob", () => {
  it("should display rounded value", () => {
    render(<RotaryKnob value={0} label="Vol" />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("should display value of 100", () => {
    render(<RotaryKnob value={100} label="Vol" />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("should emit integer values on drag", () => {
    const onChange = vi.fn();
    const { container } = render(<RotaryKnob value={50} onChange={onChange} label="Vol" />);
    const knob = container.querySelector(".cursor-grab")!;

    // Simulate mousedown
    fireEvent.mouseDown(knob, { clientY: 200 });

    // Simulate mousemove - move 3px up, delta = 1.5, value = Math.round(50 + 1.5) = 52
    fireEvent.mouseMove(window, { clientY: 197 });

    expect(onChange).toHaveBeenCalled();
    const emittedValue = onChange.mock.calls[0][0];
    expect(Number.isInteger(emittedValue)).toBe(true);
  });

  it("should clamp value at zero and not produce fractional near-zero values", () => {
    const onChange = vi.fn();
    const { container } = render(<RotaryKnob value={1} onChange={onChange} label="Vol" />);
    const knob = container.querySelector(".cursor-grab")!;

    // Start drag at value=1, move down enough to go below 0
    fireEvent.mouseDown(knob, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 110 }); // delta = -5, clamped to 0

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("should clamp value at 100", () => {
    const onChange = vi.fn();
    const { container } = render(<RotaryKnob value={99} onChange={onChange} label="Vol" />);
    const knob = container.querySelector(".cursor-grab")!;

    // Start drag at value=99, move up enough to exceed 100
    fireEvent.mouseDown(knob, { clientY: 200 });
    fireEvent.mouseMove(window, { clientY: 190 }); // delta = 5, clamped to 100

    expect(onChange).toHaveBeenCalledWith(100);
  });
});
