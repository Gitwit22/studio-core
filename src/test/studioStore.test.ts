import { describe, it, expect, beforeEach } from "vitest"
import { useStudioStore } from "@/studio/engine/studioStore"

describe("studioStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useStudioStore.setState({
      projectId: null,
      projectName: "Untitled Project",
      isPlaying: false,
      isRecording: false,
      bpm: 120,
      playhead: 0,
      zoom: 1,
      loop: { start: 0, end: 8, enabled: false },
      tracks: [],
      clips: [],
      selectedTrackId: null,
      selectedClipId: null,
      panels: { mixer: false, pianoRoll: false, browser: true, export: false },
    })
  })

  it("has correct initial state", () => {
    const state = useStudioStore.getState()
    expect(state.projectName).toBe("Untitled Project")
    expect(state.isPlaying).toBe(false)
    expect(state.isRecording).toBe(false)
    expect(state.bpm).toBe(120)
    expect(state.playhead).toBe(0)
    expect(state.zoom).toBe(1)
    expect(state.tracks).toEqual([])
    expect(state.clips).toEqual([])
    expect(state.selectedTrackId).toBeNull()
  })

  it("setPlaying updates isPlaying", () => {
    useStudioStore.getState().setPlaying(true)
    expect(useStudioStore.getState().isPlaying).toBe(true)

    useStudioStore.getState().setPlaying(false)
    expect(useStudioStore.getState().isPlaying).toBe(false)
  })

  it("setRecording updates isRecording", () => {
    useStudioStore.getState().setRecording(true)
    expect(useStudioStore.getState().isRecording).toBe(true)
  })

  it("setPlayhead updates playhead", () => {
    useStudioStore.getState().setPlayhead(5.5)
    expect(useStudioStore.getState().playhead).toBe(5.5)
  })

  it("setBpm updates bpm", () => {
    useStudioStore.getState().setBpm(140)
    expect(useStudioStore.getState().bpm).toBe(140)
  })

  it("addTrack adds a new audio track", () => {
    useStudioStore.getState().addTrack("audio")
    const state = useStudioStore.getState()
    expect(state.tracks).toHaveLength(1)
    expect(state.tracks[0].type).toBe("audio")
    expect(state.tracks[0].name).toBe("Audio Track 1")
    expect(state.tracks[0].volume).toBe(0.8)
    expect(state.tracks[0].mute).toBe(false)
    expect(state.tracks[0].solo).toBe(false)
    expect(state.tracks[0].armed).toBe(false)
    expect(state.tracks[0].id).toBeDefined()
  })

  it("addTrack adds a new midi track", () => {
    useStudioStore.getState().addTrack("midi")
    const state = useStudioStore.getState()
    expect(state.tracks).toHaveLength(1)
    expect(state.tracks[0].type).toBe("midi")
    expect(state.tracks[0].name).toBe("Midi Track 1")
  })

  it("addTrack increments track number", () => {
    useStudioStore.getState().addTrack("audio")
    useStudioStore.getState().addTrack("audio")
    const state = useStudioStore.getState()
    expect(state.tracks).toHaveLength(2)
    expect(state.tracks[0].name).toBe("Audio Track 1")
    expect(state.tracks[1].name).toBe("Audio Track 2")
  })

  it("selectTrack updates selectedTrackId", () => {
    useStudioStore.getState().addTrack("audio")
    const trackId = useStudioStore.getState().tracks[0].id
    useStudioStore.getState().selectTrack(trackId)
    expect(useStudioStore.getState().selectedTrackId).toBe(trackId)

    useStudioStore.getState().selectTrack(null)
    expect(useStudioStore.getState().selectedTrackId).toBeNull()
  })

  it("togglePanel toggles panel visibility", () => {
    expect(useStudioStore.getState().panels.mixer).toBe(false)
    useStudioStore.getState().togglePanel("mixer")
    expect(useStudioStore.getState().panels.mixer).toBe(true)
    useStudioStore.getState().togglePanel("mixer")
    expect(useStudioStore.getState().panels.mixer).toBe(false)
  })

  it("togglePanel preserves other panel states", () => {
    useStudioStore.getState().togglePanel("mixer")
    const panels = useStudioStore.getState().panels
    expect(panels.mixer).toBe(true)
    expect(panels.browser).toBe(true) // browser starts as true
    expect(panels.pianoRoll).toBe(false)
    expect(panels.export).toBe(false)
  })

  it("loop region has correct defaults", () => {
    const loop = useStudioStore.getState().loop
    expect(loop.start).toBe(0)
    expect(loop.end).toBe(8)
    expect(loop.enabled).toBe(false)
  })
})
