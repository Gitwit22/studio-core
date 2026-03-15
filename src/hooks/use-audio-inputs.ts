import { useState, useEffect, useCallback } from "react"

export interface AudioInputDevice {
  deviceId: string
  label: string
}

/**
 * Enumerates available audio input (microphone) devices.
 * Requests a temporary mic permission on first call so labels are populated.
 * Re-enumerates when devices change (plug/unplug).
 */
export function useAudioInputDevices() {
  const [devices, setDevices] = useState<AudioInputDevice[]>([])
  const [error, setError] = useState<string | null>(null)

  const enumerate = useCallback(async () => {
    try {
      // A brief getUserMedia call is needed so the browser reveals device labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Release the stream immediately — we only needed permission
      stream.getTracks().forEach((t) => t.stop())

      const all = await navigator.mediaDevices.enumerateDevices()
      const inputs = all
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        }))
      setDevices(inputs)
      setError(null)
    } catch {
      setError("Microphone access denied")
      setDevices([])
    }
  }, [])

  useEffect(() => {
    enumerate()
    // Re-enumerate when a device is plugged/unplugged
    navigator.mediaDevices.addEventListener("devicechange", enumerate)
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerate)
    }
  }, [enumerate])

  return { devices, error, refresh: enumerate }
}
