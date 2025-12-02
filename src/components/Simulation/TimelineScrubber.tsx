// src/components/Simulation/TimelineScrubber.tsx
import type { EvolutionTimeline } from "../../engine/starEvolutionEngine"

type TimelineScrubberProps = {
  timeline: EvolutionTimeline
  timeMyr: number        // current time from SimulationRunner
}

export function TimelineScrubber({ timeline, timeMyr }: TimelineScrubberProps) {
  const { totalLifetimeMyr, phases } = timeline

  const tFrac =
    totalLifetimeMyr > 0
      ? Math.min(Math.max(timeMyr / totalLifetimeMyr, 0), 1)
      : 0

  const currentPhase =
    phases.find(
      (p) => timeMyr >= p.tStartMyr && timeMyr < p.tEndMyr,
    ) ?? phases[phases.length - 1]

  return (
    <div className="timeline-scrubber">
      <div className="timeline-bar">
        {phases.map((phase) => {
          const widthFrac =
            totalLifetimeMyr > 0
              ? phase.durationMyr / totalLifetimeMyr
              : 0
          const widthPercent = widthFrac * 100

          const phaseSpan = phase.fracEnd - phase.fracStart || 1
          const localFill =
            tFrac <= phase.fracStart
              ? 0
              : tFrac >= phase.fracEnd
              ? 1
              : (tFrac - phase.fracStart) / phaseSpan

          const isActive = phase.id === currentPhase.id

          return (
            <div
              key={phase.id}
              className={`timeline-segment ${
                isActive ? "is-active" : ""
              }`}
              style={{ width: `${widthPercent}%` }}
            >
              <div
                className="timeline-segment-fill"
                style={{ width: `${localFill * 100}%` }}
              />
              <span className="timeline-segment-label">
                {phase.label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="timeline-caption">
        Age: {timeMyr.toFixed(1)} Myr · {tFrac.toFixed(3)} of life ·{" "}
        {currentPhase.label}
      </div>
    </div>
  )
}

