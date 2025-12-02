// src/components/Simulation/SimulationRunner.tsx
import React, { useEffect, useMemo, useState } from "react"
import type { StarParams } from "../../engine/starEngine"
import { computeEvolutionTimeline } from "../../engine/starEvolutionEngine"
import { getStarStateAtTime } from "../../engine/starEvolutionCurves"
import { StarEvolutionPreview } from "./StarEvolutionPreview"
import { HRDiagram } from "../HRDiagram"

// For the HR track
type HRPoint = { logT: number; logL: number; isCollapse?: boolean }

// ---------- shared temperature → color helpers (match App.tsx) ----------

type RGB = { r: number; g: number; b: number }

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function mixColors(c1: RGB, c2: RGB, t: number): string {
  const r = Math.round(lerp(c1.r, c2.r, t))
  const g = Math.round(lerp(c1.g, c2.g, t))
  const b = Math.round(lerp(c1.b, c2.b, t))
  return `rgb(${r}, ${g}, ${b})`
}

// Same ramp as in App.tsx
function temperatureToColor(T: number): string {
  const Tmin = 3000
  const Tmax = 30000
  const Tc = Math.min(Math.max(T, Tmin), Tmax)
  const t = (Tc - Tmin) / (Tmax - Tmin)

  const deepRed: RGB = { r: 255, g: 80, b: 80 }
  const warmYellow: RGB = { r: 255, g: 220, b: 150 }
  const pureWhite: RGB = { r: 255, g: 255, b: 255 }
  const blueWhite: RGB = { r: 180, g: 205, b: 255 }
  const deepBlue: RGB = { r: 120, g: 160, b: 255 }

  if (t < 0.25) {
    return mixColors(deepRed, warmYellow, t / 0.25)
  } else if (t < 0.5) {
    return mixColors(warmYellow, pureWhite, (t - 0.25) / 0.25)
  } else if (t < 0.75) {
    return mixColors(pureWhite, blueWhite, (t - 0.5) / 0.25)
  } else {
    return mixColors(blueWhite, deepBlue, (t - 0.75) / 0.25)
  }
}

// map physical R and L into StarPreview visual knobs
function mapPhysicalToVisual(
  R: number, // R / R☉
  L: number, // L / L☉
  params: StarParams,
) {
  // ---- size from radius ----
  const Rclamp = Math.min(Math.max(R, 0.2), 300)

  // gentle power law so giants are big but not insane
  let sizePx = 40 * Math.pow(Rclamp, 0.45)
  sizePx = Math.min(Math.max(sizePx, 24), 260)

  // ---- glow from luminosity + CNO ----
  const logL = Math.log10(Math.max(L, 1e-4))
  const L_norm = Math.min(Math.max((logL + 1) / 5, 0), 1)
  const cno = params.cnoFraction

  // softer CNO boost so build + sim feel similar
  const glow = L_norm * (1 + 0.5 * cno)

  return { sizePx, glow }
}

// anchor positions on HRD for final remnants (purely visual)
function getRemnantAnchor(rem: "wd" | "ns" | "bh"): HRPoint {
  if (rem === "wd") {
    return { logT: 3.7, logL: -3.0 }
  }
  if (rem === "ns") {
    return { logT: 4.5, logL: -1.5 }
  }
  // black hole – very dim, right edge
  return { logT: 3.5, logL: -4.4 }
}




// Visual playback speed per phase (1 = normal, >1 = slower on screen)
function getPhaseSpeedMultiplier(phaseId: string): number {
  switch (phaseId) {
    case "ms":
      // still slower than baseline so MS lingers
      return 2.0

    case "subgiant":
      // short transition
      return 3.0

    case "rgb":
      // THIS is the long diagonal up/right → make it *really* slow
      return 12.0

    case "heBurn":
      // the little wiggle at the top of the diagonal
      return 8.0

    case "agb":
      return 4.0

    case "preCollapse":
      // keep collapse snappy
      return 1.0

    case "wdFinal":
      return 2.0

    case "nsFinal":
    case "bhFinal":
      return 3.0

    default:
      return 1.0
  }
}






type SimulationRunnerProps = {
  params: StarParams
  initialSizePx: number
  initialColor: string
  initialGlow: number
  initialPulseSeconds: number
}

export function SimulationRunner({
  params,
  initialSizePx,
  initialColor,
  initialGlow,
  initialPulseSeconds,
}: SimulationRunnerProps) {
  // 1) build timeline whenever the star parameters change
  const timeline = useMemo(() => computeEvolutionTimeline(params), [params])

  // 2) simulation state
  const [timeMyr, setTimeMyr] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const [countdown, setCountdown] = useState(3) // 3-second countdown
  const [hasFinished, setHasFinished] = useState(false)

  // HR track points, drawn only while sim is running
  const [trackPoints, setTrackPoints] = useState<HRPoint[]>([])

  // reset when star / timeline changes
  useEffect(() => {
    setTimeMyr(0)
    setHasStarted(false)
    setCountdown(3)
    setHasFinished(false)
    setTrackPoints([])
  }, [timeline.totalLifetimeMyr])

  // 🔧 2.5) compute a size scale so that at t=0 the sim size
  // matches the build-screen initialSizePx
  const sizeScale = useMemo(() => {
    const state0 = getStarStateAtTime(params, timeline, 0)
    const { sizePx: baseSize } = mapPhysicalToVisual(state0.R, state0.L, params)

    if (!baseSize || baseSize <= 0) return 1
    return initialSizePx / baseSize
  }, [params, timeline, initialSizePx])

  // 3) countdown before auto-play
  useEffect(() => {
    if (hasStarted || hasFinished) return
    if (countdown <= 0) {
      // jump a tiny bit into the main sequence so things are already moving
      setTimeMyr((prevTime) =>
        prevTime === 0 ? timeline.totalLifetimeMyr * 0.01 : prevTime,
      )
      setHasStarted(true)
      // clear any stale track, start fresh
      setTrackPoints([])
      return
    }
    const id = window.setTimeout(() => {
      setCountdown((c) => c - 1)
    }, 1000)

    return () => window.clearTimeout(id)
  }, [countdown, hasStarted, hasFinished, timeline.totalLifetimeMyr])

  // 4) auto-play loop — ONE PASS only, no looping
  useEffect(() => {
    if (!hasStarted || hasFinished) return

    let frameId: number
    let last = performance.now()

    const totalLifetime = timeline.totalLifetimeMyr
    const baseDurationSec = 25 // global ~25 s playback
    const baseRateMyrPerSec = totalLifetime / baseDurationSec

    function loop(now: number) {
      const dtSec = (now - last) / 1000
      last = now

      setTimeMyr((prev) => {
        // which phase are we currently in, based on previous time?
        const prevState = getStarStateAtTime(params, timeline, prev)
        const phaseFactor = getPhaseSpeedMultiplier(prevState.phaseId)
        // bigger phaseFactor => slower visual progress in that phase
        const rateThisPhase = baseRateMyrPerSec / phaseFactor

        const nextRaw = prev + dtSec * rateThisPhase
        const clamped = Math.min(nextRaw, totalLifetime)

        const s = getStarStateAtTime(params, timeline, clamped)

        const logT_phys = Math.log10(Math.max(s.T_eff, 1))
        const logL_phys = Math.log10(Math.max(s.L, 1e-4))

        let hrLogT = logT_phys
        let hrLogL = logL_phys
        let isCollapseSample = false

        const isFinalPhaseSample =
          s.phaseId === "wdFinal" ||
          s.phaseId === "nsFinal" ||
          s.phaseId === "bhFinal"

        if (s.remnant && isFinalPhaseSample) {
          const target = getRemnantAnchor(s.remnant)
          // start sliding once phaseFrac > 0.3
          const f = Math.min(Math.max((s.phaseFrac - 0.3) / 0.7, 0), 1)
          hrLogT = logT_phys * (1 - f) + target.logT * f
          hrLogL = logL_phys * (1 - f) + target.logL * f
          isCollapseSample = f > 0
        }

        // Thin out the samples so the track stays nicely "dashed"
        setTrackPoints((prevTrack) => {
          const nextPoint: HRPoint = {
            logT: hrLogT,
            logL: hrLogL,
            isCollapse: isCollapseSample,
          }

          const lastPt = prevTrack[prevTrack.length - 1]
          if (lastPt) {
            const dT = Math.abs(nextPoint.logT - lastPt.logT)
            const dL = Math.abs(nextPoint.logL - lastPt.logL)

            // if we haven't moved much, skip adding a new point
            if (dT < 0.01 && dL < 0.01) {
              return prevTrack
            }
          }

          return [...prevTrack, nextPoint]
        })

        if (nextRaw >= totalLifetime) {
          cancelAnimationFrame(frameId)
          setHasFinished(true)
          return totalLifetime
        }

        return clamped
      })

      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [hasStarted, hasFinished, timeline, params])

  // 4.5) smoothed visual star state (low-pass filter on T, R, L)
  const [smoothStarState, setSmoothStarState] = useState(() =>
    getStarStateAtTime(params, timeline, 0),
  )

  useEffect(() => {
    const raw = getStarStateAtTime(params, timeline, timeMyr)
    const alpha = 0.25 // 0 = frozen, 1 = raw (higher = less smoothing)

    setSmoothStarState((prev) => {
      if (!prev) return raw
      return {
        ...raw,
        T_eff: prev.T_eff + (raw.T_eff - prev.T_eff) * alpha,
        R: prev.R + (raw.R - prev.R) * alpha,
        L: prev.L + (raw.L - prev.L) * alpha,
      }
    })
  }, [params, timeline, timeMyr])

  // 5) split: raw state drives HR track + marker, smoothed drives visuals
  const visualState = smoothStarState
  const physicalState = getStarStateAtTime(params, timeline, timeMyr)

  const { T_eff: T_vis, R: R_vis, L: L_vis } = visualState
  const {
    T_eff: T_phys_now,
    L: L_phys_now,
    remnant,
    phaseId,
    phaseFrac,
    fracTotal,
  } = physicalState

  // Final-phase detection based on physical state
  const isFinalPhase =
    phaseId === "wdFinal" || phaseId === "nsFinal" || phaseId === "bhFinal"

  // Only reveal the remnant visuals once we're well into the final phase
  const remnantForPreview =
    isFinalPhase && phaseFrac > 0.3 ? remnant : undefined

  // 6) convert to visuals (size, glow, color) using smoothed state,
  // then apply the calibration scale
  const colorPhysical = temperatureToColor(T_vis)
  const { sizePx: rawSizePx, glow: glowPhysical } = mapPhysicalToVisual(
    R_vis,
    L_vis,
    params,
  )
  const sizePx = rawSizePx * sizeScale // what goes to the star

  // --- Blend visuals so sim starts EXACTLY like build, then eases into physical ---

  // Use pure build visuals until countdown is done
  const useBuildVisuals = !hasStarted || timeMyr < 1e-6

  // Color: lock to build until sim starts, then switch to physical
  const color = useBuildVisuals ? initialColor : colorPhysical

  // Glow:
  //   • lock to build while not started
  //   • after start, blend over first 2% of lifetime
  let glow: number
  if (!hasStarted) {
    glow = initialGlow
  } else {
    const lifeBlendWindow = 0.02 * timeline.totalLifetimeMyr // first 2% of life
    const glowBlend =
      lifeBlendWindow > 0 ? Math.min(timeMyr / lifeBlendWindow, 1) : 1

    glow =
      glowBlend < 1
        ? initialGlow * (1 - glowBlend) + glowPhysical * glowBlend
        : glowPhysical
  }

  const pulseSeconds = initialPulseSeconds

  // 7) HR diagram coordinates – from RAW physical state so marker
  // hugs the yellow track exactly.
  const logT_phys_now = Math.log10(Math.max(T_phys_now, 1))
  const logL_phys_now = Math.log10(Math.max(L_phys_now, 1e-4))

  let hrLogT = logT_phys_now
  let hrLogL = logL_phys_now

  if (remnantForPreview && isFinalPhase) {
    const target = getRemnantAnchor(remnantForPreview)

    // start sliding once remnant visuals are on; finish by end of phase
    const f = Math.min(Math.max((phaseFrac - 0.3) / 0.7, 0), 1)

    hrLogT = logT_phys_now * (1 - f) + target.logT * f
    hrLogL = logL_phys_now * (1 - f) + target.logL * f
  }

  // lock HR zoom so there’s no random zoom-in/out glitch
  const disableStarZoom = true



  return (
    <div className="simulation-runner">
      <div className="simulation-runner-preview">
        <StarEvolutionPreview
          sizePx={sizePx}
          color={color}
          glow={glow}
          pulseSeconds={pulseSeconds}
          remnant={remnantForPreview}
        />

        {!hasStarted && (
          <div className="simulation-countdown">
            Simulation starts in {countdown}…
          </div>
        )}

        {hasFinished && (
          <div className="simulation-finished">
            Evolution complete
          </div>
        )}
      </div>

      {/* === HR DIAGRAM ON SIM SCREEN === */}
      <div className="simulation-panels-row">
        <div className="simulation-hr-tilt">
          <HRDiagram
            current={{ logT: hrLogT, logL: hrLogL }}
            track={hasStarted ? trackPoints : undefined}
            disableStarZoom={disableStarZoom}
            remnant={remnantForPreview}
            fracTotal={fracTotal}
            hasFinished={hasFinished}
          />
        </div>
      </div>
    </div>
  )
}
