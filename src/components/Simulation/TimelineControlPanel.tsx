// src/components/Simulation/TimelineControlPanel.tsx
import type { EvolutionTimeline } from "../../engine/starEvolutionEngine"

type TimelineControlPanelProps = {
  timeline: EvolutionTimeline
  timeMyr: number

  isPlaying: boolean
  speed: number

  onTogglePlay: () => void
  onRestart: () => void
  onChangeSpeed: (s: number) => void
  onJumpToPhase: (phaseId: EvolutionTimeline["phases"][number]["id"]) => void
}

export function TimelineControlPanel({
  timeline: _timeline,
  timeMyr: _timeMyr,
  speed: _speed,
  onChangeSpeed: _onChangeSpeed,
  onJumpToPhase: _onJumpToPhase,
  // ^ keep these in the type for later, but ignore them for now
  isPlaying,
  onTogglePlay,
  onRestart,
}: TimelineControlPanelProps) {
  return (
    <div className="timeline-panel">
      <div className="timeline-panel-inner">
        {/* LEFT side of pill – empty for now, will become phase slider */}
        <div className="timeline-panel-track" />

        {/* RIGHT: just the main buttons for now */}
        <div className="timeline-panel-controls">
          <div className="timeline-main-buttons">
            <button
              type="button"
              className="pill-button primary"
              onClick={onTogglePlay}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              type="button"
              className="pill-button"
              onClick={onRestart}
            >
              Restart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}