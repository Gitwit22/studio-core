import { describe, it, expect, beforeEach } from "vitest"
import { useStudioStore } from "@/studio/engine/studioStore"

describe("studioStore", () => {
  beforeEach(() => {
    useStudioStore.getState().reset()
  })

  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = useStudioStore.getState()
      expect(state.projectId).toBeNull()
      expect(state.projectName).toBe("Untitled Session")
      expect(state.isPlaying).toBe(false)
      expect(state.isRecording).toBe(false)
      expect(state.bpm).toBe(120)
      expect(state.playhead).toBe(0)
      expect(state.zoom).toBe(1)
      expect(state.tracks).toEqual([])
      expect(state.clips).toEqual([])
      expect(state.sources).toEqual([])
      expect(state.selectedTrackId).toBeNull()
      expect(state.selectedClipId).toBeNull()
      expect(state.loop).toEqual({ start: 0, end: 8, enabled: false })
      expect(state.panels).toEqual({
        mixer: true,
        pianoRoll: false,
        browser: false,
        export: false,
      })
      expect(state.activeModal).toBeNull()
    })
  })

  describe("transport actions", () => {
    it("setPlaying", () => {
      useStudioStore.getState().setPlaying(true)
      expect(useStudioStore.getState().isPlaying).toBe(true)
    })

    it("setRecording", () => {
      useStudioStore.getState().setRecording(true)
      expect(useStudioStore.getState().isRecording).toBe(true)
    })

    it("setPlayhead", () => {
      useStudioStore.getState().setPlayhead(16)
      expect(useStudioStore.getState().playhead).toBe(16)
    })

    it("setBpm", () => {
      useStudioStore.getState().setBpm(140)
      expect(useStudioStore.getState().bpm).toBe(140)
    })

    it("setZoom", () => {
      useStudioStore.getState().setZoom(2)
      expect(useStudioStore.getState().zoom).toBe(2)
    })

    it("setProjectName", () => {
      useStudioStore.getState().setProjectName("My Song")
      expect(useStudioStore.getState().projectName).toBe("My Song")
    })
  })

  describe("track actions", () => {
    it("addTrack with default name", () => {
      useStudioStore.getState().addTrack("audio")
      const state = useStudioStore.getState()
      const tracks = state.tracks
      expect(tracks).toHaveLength(1)
      expect(tracks[0].type).toBe("audio")
      expect(tracks[0].name).toBe("Audio 1")
      expect(tracks[0].channelId).toBeDefined()
      expect(tracks[0].armed).toBe(false)
      expect(tracks[0].fxChain).toHaveLength(6)
      // Mixer channel should also be created
      const ch = state.mixerChannels.find((c) => c.id === tracks[0].channelId)
      expect(ch).toBeDefined()
      expect(ch!.volume).toBe(0.75)
      expect(ch!.pan).toBe(0)
      expect(ch!.mute).toBe(false)
      expect(ch!.solo).toBe(false)
    })

    it("addTrack with custom name", () => {
      useStudioStore.getState().addTrack("midi", "Synth Lead")
      expect(useStudioStore.getState().tracks[0].name).toBe("Synth Lead")
    })

    it("removeTrack removes track and its clips", () => {
      useStudioStore.getState().addTrack("audio")
      const trackId = useStudioStore.getState().tracks[0].id
      const channelId = useStudioStore.getState().tracks[0].channelId
      useStudioStore.getState().addClip({
        trackId,
        sourceId: "src-1",
        start: 0,
        end: 4,
        offset: 0,
        name: "Clip 1",
      })
      expect(useStudioStore.getState().clips).toHaveLength(1)
      expect(useStudioStore.getState().mixerChannels).toHaveLength(1)

      useStudioStore.getState().removeTrack(trackId)
      expect(useStudioStore.getState().tracks).toHaveLength(0)
      expect(useStudioStore.getState().clips).toHaveLength(0)
      expect(useStudioStore.getState().mixerChannels).toHaveLength(0)
    })

    it("removeTrack clears selectedTrackId if it was the removed track", () => {
      useStudioStore.getState().addTrack("audio")
      const trackId = useStudioStore.getState().tracks[0].id
      useStudioStore.getState().setSelectedTrackId(trackId)
      useStudioStore.getState().removeTrack(trackId)
      expect(useStudioStore.getState().selectedTrackId).toBeNull()
    })

    it("updateTrack updates specific fields", () => {
      useStudioStore.getState().addTrack("audio")
      const trackId = useStudioStore.getState().tracks[0].id
      useStudioStore.getState().updateTrack(trackId, { name: "Renamed", armed: true })
      const track = useStudioStore.getState().tracks[0]
      expect(track.name).toBe("Renamed")
      expect(track.armed).toBe(true)
      expect(track.type).toBe("audio") // unchanged
    })

    it("setSelectedTrackId", () => {
      useStudioStore.getState().setSelectedTrackId("track-123")
      expect(useStudioStore.getState().selectedTrackId).toBe("track-123")
    })
  })

  describe("clip actions", () => {
    it("addClip", () => {
      useStudioStore.getState().addClip({
        trackId: "t1",
        sourceId: "s1",
        start: 0,
        end: 4,
        offset: 0,
        name: "Vocal Take 1",
      })
      const clips = useStudioStore.getState().clips
      expect(clips).toHaveLength(1)
      expect(clips[0].name).toBe("Vocal Take 1")
      expect(clips[0].start).toBe(0)
      expect(clips[0].end).toBe(4)
      expect(clips[0].id).toBeDefined()
    })

    it("removeClip", () => {
      useStudioStore.getState().addClip({
        trackId: "t1",
        sourceId: "s1",
        start: 0,
        end: 4,
        offset: 0,
        name: "Clip",
      })
      const clipId = useStudioStore.getState().clips[0].id
      useStudioStore.getState().removeClip(clipId)
      expect(useStudioStore.getState().clips).toHaveLength(0)
    })

    it("removeClip clears selectedClipId if it was the removed clip", () => {
      useStudioStore.getState().addClip({
        trackId: "t1",
        sourceId: "s1",
        start: 0,
        end: 4,
        offset: 0,
        name: "Clip",
      })
      const clipId = useStudioStore.getState().clips[0].id
      useStudioStore.getState().setSelectedClipId(clipId)
      useStudioStore.getState().removeClip(clipId)
      expect(useStudioStore.getState().selectedClipId).toBeNull()
    })

    it("updateClip", () => {
      useStudioStore.getState().addClip({
        trackId: "t1",
        sourceId: "s1",
        start: 0,
        end: 4,
        offset: 0,
        name: "Clip",
      })
      const clipId = useStudioStore.getState().clips[0].id
      useStudioStore.getState().updateClip(clipId, { start: 2, name: "Renamed" })
      const clip = useStudioStore.getState().clips[0]
      expect(clip.start).toBe(2)
      expect(clip.name).toBe("Renamed")
      expect(clip.end).toBe(4) // unchanged
    })
  })

  describe("source actions", () => {
    it("addSource returns an id", () => {
      const id = useStudioStore.getState().addSource({
        name: "kick.wav",
        url: "/audio/kick.wav",
        duration: 1.2,
      })
      expect(id).toBeDefined()
      expect(useStudioStore.getState().sources).toHaveLength(1)
      expect(useStudioStore.getState().sources[0].name).toBe("kick.wav")
    })

    it("removeSource removes source and associated clips", () => {
      const sourceId = useStudioStore.getState().addSource({
        name: "vocal.wav",
        url: "/audio/vocal.wav",
        duration: 10,
      })
      useStudioStore.getState().addClip({
        trackId: "t1",
        sourceId,
        start: 0,
        end: 4,
        offset: 0,
        name: "Vocal",
      })
      useStudioStore.getState().addClip({
        trackId: "t2",
        sourceId: "other-source",
        start: 0,
        end: 4,
        offset: 0,
        name: "Other",
      })
      expect(useStudioStore.getState().clips).toHaveLength(2)

      useStudioStore.getState().removeSource(sourceId)
      expect(useStudioStore.getState().sources).toHaveLength(0)
      expect(useStudioStore.getState().clips).toHaveLength(1)
      expect(useStudioStore.getState().clips[0].name).toBe("Other")
    })
  })

  describe("loop actions", () => {
    it("setLoop", () => {
      useStudioStore.getState().setLoop(4, 16)
      expect(useStudioStore.getState().loop.start).toBe(4)
      expect(useStudioStore.getState().loop.end).toBe(16)
    })

    it("toggleLoop", () => {
      expect(useStudioStore.getState().loop.enabled).toBe(false)
      useStudioStore.getState().toggleLoop()
      expect(useStudioStore.getState().loop.enabled).toBe(true)
      useStudioStore.getState().toggleLoop()
      expect(useStudioStore.getState().loop.enabled).toBe(false)
    })
  })

  describe("panel actions", () => {
    it("togglePanel", () => {
      expect(useStudioStore.getState().panels.mixer).toBe(true)
      useStudioStore.getState().togglePanel("mixer")
      expect(useStudioStore.getState().panels.mixer).toBe(false)
    })

    it("togglePanel pianoRoll", () => {
      expect(useStudioStore.getState().panels.pianoRoll).toBe(false)
      useStudioStore.getState().togglePanel("pianoRoll")
      expect(useStudioStore.getState().panels.pianoRoll).toBe(true)
    })
  })

  describe("modal actions", () => {
    it("setActiveModal opens a modal", () => {
      expect(useStudioStore.getState().activeModal).toBeNull()
      useStudioStore.getState().setActiveModal("settings")
      expect(useStudioStore.getState().activeModal).toBe("settings")
    })

    it("setActiveModal to null closes modal", () => {
      useStudioStore.getState().setActiveModal("about")
      expect(useStudioStore.getState().activeModal).toBe("about")
      useStudioStore.getState().setActiveModal(null)
      expect(useStudioStore.getState().activeModal).toBeNull()
    })

    it("reset clears activeModal", () => {
      useStudioStore.getState().setActiveModal("settings")
      useStudioStore.getState().reset()
      expect(useStudioStore.getState().activeModal).toBeNull()
    })
  })

  describe("reset", () => {
    it("restores initial state", () => {
      useStudioStore.getState().setPlaying(true)
      useStudioStore.getState().setBpm(140)
      useStudioStore.getState().addTrack("audio")
      useStudioStore.getState().addClip({
        trackId: "t1",
        sourceId: "s1",
        start: 0,
        end: 4,
        offset: 0,
        name: "Clip",
      })

      useStudioStore.getState().reset()

      const state = useStudioStore.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.bpm).toBe(120)
      expect(state.tracks).toEqual([])
      expect(state.clips).toEqual([])
    })
  })
})
