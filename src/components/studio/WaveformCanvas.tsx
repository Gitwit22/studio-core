import { useRef, useEffect } from "react"
import type { PeakResolution } from "@/studio/types/waveform"

interface WaveformCanvasProps {
  /** Peak resolution data to render (already selected for current zoom level). */
  peaks: PeakResolution | null
  /** Width of the canvas in CSS pixels. */
  width: number
  /** Height of the canvas in CSS pixels. */
  height: number
  /** Fill color for the waveform (supports any CSS color). */
  color: string
  /** Overall opacity for the waveform fill (0-1). */
  opacity?: number
  /** Additional CSS class names. */
  className?: string
}

/**
 * Canvas-based waveform renderer.
 * Draws min/max peak pairs as vertical lines mirrored around the center line.
 * Channels are mixed (averaged) for display.
 */
const WaveformCanvas = ({
  peaks,
  width,
  height,
  color,
  opacity = 0.5,
  className,
}: WaveformCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks || peaks.channels.length === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Mix channels by averaging min/max values
    const numChannels = peaks.channels.length
    const numPeaks = peaks.channels[0].min.length
    const mixedMin = new Float32Array(numPeaks)
    const mixedMax = new Float32Array(numPeaks)

    for (let i = 0; i < numPeaks; i++) {
      let minSum = 0
      let maxSum = 0
      for (let ch = 0; ch < numChannels; ch++) {
        minSum += peaks.channels[ch].min[i]
        maxSum += peaks.channels[ch].max[i]
      }
      mixedMin[i] = minSum / numChannels
      mixedMax[i] = maxSum / numChannels
    }

    const centerY = height / 2
    ctx.fillStyle = color
    ctx.globalAlpha = opacity

    // Draw waveform: map each peak bucket to an x position and draw a vertical bar from min to max
    for (let i = 0; i < numPeaks; i++) {
      const x = (i / numPeaks) * width
      const barWidth = Math.max(1, width / numPeaks)
      // min values are negative (below center), max are positive (above center)
      const topY = centerY - mixedMax[i] * centerY
      const bottomY = centerY - mixedMin[i] * centerY
      ctx.fillRect(x, topY, barWidth, bottomY - topY)
    }

    ctx.globalAlpha = 1
  }, [peaks, width, height, color, opacity])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width,
        height,
        display: "block",
        position: "absolute",
        inset: 0,
      }}
    />
  )
}

export default WaveformCanvas
