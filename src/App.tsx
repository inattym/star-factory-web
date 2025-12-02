// src/App.tsx
import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import { IntroScreen } from './phases/IntroScreen'
import { BuildScreen } from './phases/BuildScreen'
import { TutorialScreen } from './phases/TutorialScreen'
import { ScoringScreen } from './phases/ScoringScreen'
import { computeInitialStar } from './engine/starEngine'
import type { StarParams } from './engine/starEngine'
import { SimulationScreen } from './phases/SimulationScreen'
import './engine/debugProbes'

type Phase = 'intro' | 'tutorial' | 'build' | 'simulation' | 'scoring'

const phaseOrder: Phase[] = ['intro', 'tutorial', 'build', 'simulation', 'scoring']

// ---------- smooth temperature → color helpers ----------

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

// More realistic temperature → color ramp
function temperatureToColor(T: number): string {
  const Tmin = 3000
  const Tmax = 30000
  const Tc = Math.min(Math.max(T, Tmin), Tmax)
  const t = (Tc - Tmin) / (Tmax - Tmin)

  const deepRed: RGB    = { r: 255, g: 80,  b: 80 }   // ~3k K
  const warmYellow: RGB = { r: 255, g: 220, b: 150 }  // ~5.5k K
  const pureWhite: RGB  = { r: 255, g: 255, b: 255 }  // ~8k K
  const blueWhite: RGB  = { r: 180, g: 205, b: 255 }  // ~12k K
  const deepBlue: RGB   = { r: 120, g: 160, b: 255 }  // ~30k K

  if (t < 0.25) {
    return mixColors(deepRed, warmYellow, t / 0.25)
  } else if (t < 0.50) {
    return mixColors(warmYellow, pureWhite, (t - 0.25) / 0.25)
  } else if (t < 0.75) {
    return mixColors(pureWhite, blueWhite, (t - 0.50) / 0.25)
  } else {
    return mixColors(blueWhite, deepBlue, (t - 0.75) / 0.25)
  }
}

// --------------------------------------------------------

function getStarVisuals(params: StarParams) {
  const initial = computeInitialStar(params)

  // base size from luminosity
  const clampedLogL = Math.min(Math.max(initial.logL, -4), 6)
  const baseSizePx = 40 + (clampedLogL + 4) * (220 / 10)

  // ----- REDUCED METALLICITY EFFECT (size only) -----
  const Z = params.metallicity
  const Z_ref = 0.02 // solar reference
  const Z_rel = Math.max(-0.9, Math.min((Z - Z_ref) / Z_ref, 1.5))

  const sizeZFactor = 1 - 0.05 * Z_rel
  const sizePx = baseSizePx * sizeZFactor

  // color: mostly set by T_eff, only gently cooled by Z
  const T_eff = initial.T_eff
  const T_visual = T_eff * (1 - 0.12 * Z_rel)
  const color = temperatureToColor(T_visual)

  // ----- REDUCED CNO BRIGHTNESS EFFECT -----
  const L_norm = Math.min(Math.max((initial.logL + 1) / 5, 0), 1)
  const cno = params.cnoFraction

  // small brightness boost from CNO
  const glow = L_norm * (1 + 0.5 * cno)

  // luminous stars pulse faster, CNO is a mild modifier
  const pulseSeconds = (4 - 2.0 * L_norm) / (1 + 0.25 * cno)

  return { sizePx, color, glow, pulseSeconds }
}

function App() {
  const [phase, setPhase] = useState<Phase>('intro')

  const [params, setParams] = useState<StarParams>({
    mass: 1.0,
    metallicity: 0.02,
    cnoFraction: 0.3,
  })

  function updateParam<K extends keyof StarParams>(key: K, value: number) {
    setParams((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const { sizePx, color, glow, pulseSeconds } = getStarVisuals(params)

  // measure each tab so the capsule centers on the text
  const tabsContainerRef = useRef<HTMLDivElement | null>(null)
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [capsuleVars, setCapsuleVars] = useState<React.CSSProperties>({})

  useEffect(() => {
    const index = phaseOrder.indexOf(phase)
    const btn = tabButtonRefs.current[index]
    const container = tabsContainerRef.current
    if (!btn || !container) return

    const x = btn.offsetLeft
    const width = btn.offsetWidth

    setCapsuleVars({
      '--capsule-x': `${x}px`,
      '--capsule-width': `${width}px`,
    } as React.CSSProperties)
  }, [phase])

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="phase-tabs" ref={tabsContainerRef} style={capsuleVars}>
          <div className="nav-capsule" />

          <button
            ref={(el) => {
              tabButtonRefs.current[0] = el
            }}
            className={phase === 'intro' ? 'tab active' : 'tab'}
            onClick={() => setPhase('intro')}
          >
            Intro
          </button>
          <button
            ref={(el) => {
              tabButtonRefs.current[1] = el
            }}
            className={phase === 'tutorial' ? 'tab active' : 'tab'}
            onClick={() => setPhase('tutorial')}
          >
            Tutorial
          </button>
          <button
            ref={(el) => {
              tabButtonRefs.current[2] = el
            }}
            className={phase === 'build' ? 'tab active' : 'tab'}
            onClick={() => setPhase('build')}
          >
            Build
          </button>
          <button
            ref={(el) => {
              tabButtonRefs.current[3] = el
            }}
            className={phase === 'simulation' ? 'tab active' : 'tab'}
            onClick={() => setPhase('simulation')}
          >
            Simulation
          </button>
          <button
            ref={(el) => {
              tabButtonRefs.current[4] = el
            }}
            className={phase === 'scoring' ? 'tab active' : 'tab'}
            onClick={() => setPhase('scoring')}
          >
            Scoring
          </button>
        </div>
      </header>

      <main className="app-main">
        {phase === 'intro' && (
          <IntroScreen
            onStartTutorial={() => setPhase('tutorial')}
            onSkipToBuild={() => setPhase('build')}
          />
        )}

        {phase === 'tutorial' && <TutorialScreen />}

        {phase === 'build' && (
          <BuildScreen
            params={params}
            onChangeParam={updateParam}
            sizePx={sizePx}
            color={color}
            glow={glow}
            pulseSeconds={pulseSeconds}
            onLaunchSimulation={() => setPhase('simulation')}
          />
        )}

        {phase === 'simulation' && (
          <SimulationScreen
            params={params}
            initialSizePx={sizePx}
            initialColor={color}
            initialGlow={glow}
            initialPulseSeconds={pulseSeconds}
          />
        )}

        {phase === 'scoring' && (
          <ScoringScreen onRestart={() => setPhase('build')} />
        )}
      </main>
    </div>
  )
}

export default App
