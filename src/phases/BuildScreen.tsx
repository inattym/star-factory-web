import { useEffect, useState } from 'react'
import { StarPreview } from '../components/StarPreview'
import { HRDiagram } from '../components/HRDiagram'
import { computeInitialStar } from '../engine/starEngine'
import type { StarParams } from '../engine/starEngine'
import { SwipeToActivate } from '../components/SwipeToActivate'


type BuildScreenProps = {
  params: StarParams
  onChangeParam: <K extends keyof StarParams>(key: K, value: number) => void
  sizePx: number
  color: string
  glow: number
  pulseSeconds: number
  onLaunchSimulation: () => void
}

// --- LOG SCALE MASS HELPERS ---------------------------------

// Convert slider (0..1) → real mass (0.1..50)
function sliderToMass(x: number): number {
  const logMin = Math.log10(0.1)
  const logMax = Math.log10(50)
  const logVal = logMin + x * (logMax - logMin)
  return Math.pow(10, logVal)
}

// Convert mass (0.1..50) → slider position (0..1)
function massToSlider(m: number): number {
  const logMin = Math.log10(0.1)
  const logMax = Math.log10(50)
  const logVal = Math.log10(m)
  return (logVal - logMin) / (logMax - logMin)
}

// ======== GLOBAL CONFIG / COLOR GRADIENT =========

const NUM_BARS = 25
const MASS_SLOPE = 5 // expo-ish slope: higher → steeper

// map bar position 0..1 (left→right) to gradient colors for MASS (green→red)
function getMassColors(pos: number) {
  const x = Math.min(1, Math.max(0, pos))

  let hue: number
  if (x <= 0.5) {
    // 0 → 0.5 : green (120°) → yellow (60°)
    const u = x / 0.5
    hue = 120 - 60 * u
  } else {
    // 0.5 → 1 : yellow (60°) → red (0°)
    const u = (x - 0.5) / 0.5
    hue = 60 - 60 * u
  }

  // darker as we go right
  const lightness = 60 - 20 * x // 60% → 40%

  const active = `hsl(${hue}, 85%, ${lightness}%)`
  const inactive = `hsla(${hue}, 40%, ${lightness + 10}%, 0.25)`

  return { active, inactive }
}

// cool steel gradient for METALLICITY (blue-grey metal)
function getMetallicityColors(pos: number) {
  const x = Math.min(1, Math.max(0, pos))

  // hue
  const hue = 210 + 20 * x
  // saturation
  const sat = 35 - 15 * x
  // lightness
  const light = 90 - 60 * x

  const active = `hsl(${hue}, ${sat}%, ${light}%)`
  const inactive = `hsla(${hue}, ${Math.max(
    10,
    sat - 10,
  )}%, ${Math.min(light + 10, 80)}%, 0.25)`

  return { active, inactive }
}

// hot fusion golds for CNO (yellow → deep orange)
function getCNOColors(pos: number) {
  const x = Math.min(1, Math.max(0, pos))

  // hue
  const hue = 55 - 25 * x
  // saturation
  const sat = 80 + 10 * x
  // lightness
  const light = 90 - 50 * x

  const active = `hsl(${hue}, ${sat}%, ${light}%)`
  const inactive = `hsla(${hue}, ${Math.max(
    40,
    sat - 20,
  )}%, ${Math.min(light + 10, 80)}%, 0.25)`

  return { active, inactive }
}

// ======== MASS STAIR CONTROL (smooth + curved) =========

type MassStairControlProps = {
  mass: number
  onChangeMass: (m: number) => void
}

function MassStairControl({ mass, onChangeMass }: MassStairControlProps) {
  // continuous 0..1 value, from current mass (log-mapped)
  const sliderValue = Math.min(1, Math.max(0, massToSlider(mass)))

  function handlePointer(clientX: number, target: HTMLDivElement) {
    const rect = target.getBoundingClientRect()
    const raw = (clientX - rect.left) / rect.width
    const t = Math.min(1, Math.max(0, raw)) // clamp 0..1
    const newMass = sliderToMass(t)
    onChangeMass(newMass)
  }

  return (
    <div
      className="mass-stair"
      onMouseDown={(e) =>
        handlePointer(e.clientX, e.currentTarget as HTMLDivElement)
      }
      onMouseMove={(e) => {
        if (e.buttons !== 1) return
        handlePointer(e.clientX, e.currentTarget as HTMLDivElement)
      }}
    >
      {Array.from({ length: NUM_BARS }).map((_, i) => {
        const barCenter = (i + 0.5) / NUM_BARS // where this bar “lives” along 0..1
        const linearPos = (i + 1) / NUM_BARS

        // mix of linear + exponential so it starts rising earlier
        const expoPos = Math.pow(linearPos, MASS_SLOPE) // expo-ish curve
        const CURVE_MIX = 0.4 // 0 = pure linear, 1 = pure expo
        const heightFrac =
          (1 - CURVE_MIX) * linearPos + CURVE_MIX * expoPos

        const isActive = barCenter <= sliderValue

        const baseHeight = 0.1 + 0.95 * heightFrac // ~20%–100% height
        const heightPercent = baseHeight * 140

        // gradient color based on bar position (mass palette)
        const { active, inactive } = getMassColors(barCenter)

        return (
          <div
            key={i}
            className="mass-stair-bar"
            style={{
              height: `${heightPercent}%`,
              background: isActive ? active : inactive,
            }}
          />
        )
      })}
    </div>
  )
}

// ======== METALLICITY STAIR (linear height, steel colors) =========

const Z_MIN = 0.0
const Z_MAX = 0.04

function sliderToZ(x: number): number {
  return Z_MIN + x * (Z_MAX - Z_MIN)
}

function zToSlider(Z: number): number {
  return (Z - Z_MIN) / (Z_MAX - Z_MIN)
}

type MetallicityStairControlProps = {
  metallicity: number
  onChangeZ: (z: number) => void
}

function MetallicityStairControl({
  metallicity,
  onChangeZ,
}: MetallicityStairControlProps) {
  const sliderValue = Math.min(1, Math.max(0, zToSlider(metallicity)))

  function handlePointer(clientX: number, target: HTMLDivElement) {
    const rect = target.getBoundingClientRect()
    const raw = (clientX - rect.left) / rect.width
    const t = Math.min(1, Math.max(0, raw))
    const newZ = sliderToZ(t)
    onChangeZ(newZ)
  }

  return (
    <div
      className="mass-stair"
      onMouseDown={(e) =>
        handlePointer(e.clientX, e.currentTarget as HTMLDivElement)
      }
      onMouseMove={(e) => {
        if (e.buttons !== 1) return
        handlePointer(e.clientX, e.currentTarget as HTMLDivElement)
      }}
    >
      {Array.from({ length: NUM_BARS }).map((_, i) => {
        const barCenter = (i + 0.5) / NUM_BARS
        const linearPos = (i + 1) / NUM_BARS

        // pure linear slope for height
        const heightFrac = linearPos

        const isActive = barCenter <= sliderValue

        const baseHeight = 0.1 + 0.95 * heightFrac
        const heightPercent = baseHeight * 100

        // use cool metallic palette for Z
        const { active, inactive } = getMetallicityColors(barCenter)

        return (
          <div
            key={i}
            className="mass-stair-bar"
            style={{
              height: `${heightPercent}%`,
              background: isActive ? active : inactive,
            }}
          />
        )
      })}
    </div>
  )
}

// ======== CNO FRACTION STAIR (linear, 0..1, gold/orange) =========

type CNOStairControlProps = {
  cno: number
  onChangeCNO: (c: number) => void
}

function CNOStairControl({ cno, onChangeCNO }: CNOStairControlProps) {
  // cno itself is already 0..1
  const sliderValue = Math.min(1, Math.max(0, cno))

  function handlePointer(clientX: number, target: HTMLDivElement) {
    const rect = target.getBoundingClientRect()
    const raw = (clientX - rect.left) / rect.width
    const t = Math.min(1, Math.max(0, raw))
    onChangeCNO(t)
  }

  return (
    <div
      className="mass-stair"
      onMouseDown={(e) =>
        handlePointer(e.clientX, e.currentTarget as HTMLDivElement)
      }
      onMouseMove={(e) => {
        if (e.buttons !== 1) return
        handlePointer(e.clientX, e.currentTarget as HTMLDivElement)
      }}
    >
      {Array.from({ length: NUM_BARS }).map((_, i) => {
        const barCenter = (i + 0.5) / NUM_BARS
        const linearPos = (i + 1) / NUM_BARS

        // pure linear slope
        const heightFrac = linearPos

        const isActive = barCenter <= sliderValue

        const baseHeight = 0.1 + 0.95 * heightFrac
        const heightPercent = baseHeight * 100

        // molten fusion gold/orange palette for CNO
        const { active, inactive } = getCNOColors(barCenter)

        return (
          <div
            key={i}
            className="mass-stair-bar"
            style={{
              height: `${heightPercent}%`,
              background: isActive ? active : inactive,
            }}
          />
        )
      })}
    </div>
  )
}

// =============================================

export function BuildScreen({
  params,
  onChangeParam,
  sizePx,
  color,
  glow,
  pulseSeconds,
  onLaunchSimulation,
}: BuildScreenProps) {
  const [disableStarZoom, setDisableStarZoom] = useState(true)

  // when sliders are being dragged, we want zoom enabled (star-focused).
  // when the drag finishes (pointer up), we zoom back out to the full main sequence.
  function withZoomTracking<T>(handler: (v: T) => void) {
    return (v: T) => {
      setDisableStarZoom(false) // user is actively adjusting → zoom in
      handler(v)
    }
  }

  useEffect(() => {
    const end = () => setDisableStarZoom(true) // pointer released → zoom out to full MS
    window.addEventListener('pointerup', end)
    window.addEventListener('mouseup', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('mouseup', end)
    }
  }, [])

  const initial = computeInitialStar(params)

  return (
    <section className="panel">
      <div className="build-layout">
        {/* LEFT: big star preview */}
        <div className="panel-left">
          <StarPreview
            sizePx={sizePx}
            color={color}
            glow={glow}
            pulseSeconds={pulseSeconds}
          />
          <SwipeToActivate onComplete={onLaunchSimulation} />
        </div>

        {/* RIGHT: sliders, summary, HR diagram stacked */}
        <div className="panel-right">
          {/* 1) Controls + launch button */}
          <div className="build-card build-card-controls">

            {/* MASS — LOG SCALE + stair control */}
            <div className="slider-card slider-card-mass">
              <div className="control-group">
                <label>Mass (M☉): {params.mass.toFixed(2)}</label>
                <MassStairControl
                  mass={params.mass}
                  onChangeMass={withZoomTracking((m) => onChangeParam('mass', m))}
                />
              </div>
            </div>

            {/* METALLICITY — linear stair */}
            <div className="slider-card slider-card-metallicity">
              <div className="control-group">
                <label>Metallicity Z: {params.metallicity.toFixed(3)}</label>
                <MetallicityStairControl
                  metallicity={params.metallicity}
                  onChangeZ={withZoomTracking((z) => onChangeParam('metallicity', z))}
                />
              </div>
            </div>

            {/* CNO FRACTION — linear stair */}
            <div className="slider-card slider-card-cno">
              <div className="control-group">
                <label>
                  CNO Fraction: {params.cnoFraction.toFixed(2)}
                </label>
                <CNOStairControl
                  cno={params.cnoFraction}
                  onChangeCNO={withZoomTracking((c) => onChangeParam('cnoFraction', c))}
                />
              </div>
            </div>


          </div>

          {/* 2) Current star summary */}
          <div className="build-card build-card-summary">
            <div className="star-summary-card">
              <ul className="summary-list">
                <h3 className="summary-title">Manufacturing Report</h3>
                <li>Mass: {params.mass.toFixed(2)} M☉</li>
                <li>Metallicity Z: {params.metallicity.toFixed(3)}</li>
                <li>CNO fraction: {params.cnoFraction.toFixed(2)}</li>
                <li>X (H): {initial.X.toFixed(3)}</li>
                <li>Y (He): {initial.Y.toFixed(3)}</li>
                <li>log₁₀(T / K): {initial.logT.toFixed(3)}</li>
                <li>log₁₀(L / L☉): {initial.logL.toFixed(3)}</li>
              </ul>
            </div>
          </div>

          {/* 3) HR diagram */}
          <div className="build-card build-card-hr">
            <HRDiagram
              current={{
                logT: initial.logT,
                logL: initial.logL,
              }}
              disableStarZoom={disableStarZoom}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
