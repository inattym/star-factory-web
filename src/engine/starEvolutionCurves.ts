// src/engine/starEvolutionCurves.ts
// Smooth, phase-based evolution of a single star on the HR diagram.
//
// Given the Build-screen parameters + an EvolutionTimeline from
// starEvolutionEngine, this module returns the star's L, R, T
// at any physical time t (in Myr), with continuous transitions
// between phases.

import {
  computeInitialStar,
  type StarParams,
  type InitialStarState,
} from "./starEngine"
import type {
  EvolutionTimeline,
  EvolutionPhaseId,
  EvolutionPhase,
  RemnantKind,
} from "./starEvolutionEngine"

// What the Simulation screen actually needs at a given time.
export type StarEvolutionState = {
  // absolute time in Myr
  tMyr: number
  // 0–1 along the TOTAL lifetime (including final cooling cap)
  fracTotal: number

  // which major phase we are in
  phaseId: EvolutionPhaseId
  phaseLabel: string
  // 0–1 within that phase
  phaseFrac: number

  // final fate of the star (from mass + Z + CNO), as decided by the timeline
  remnant: RemnantKind

  // physical properties
  L: number // luminosity in L_sun
  R: number // radius in R_sun
  T_eff: number // effective temperature in K

  logL: number
  logT: number
}

// Convenience type for a state we interpolate between
type StatePoint = {
  L: number
  R: number
  T_eff: number
}

type PhaseShape = {
  start: StatePoint
  end: StatePoint
}

// Internal shape keys: these are the "base" phases that share
// geometry between all final fates. The final wdFinal/nsFinal/bhFinal
// phases all reuse the "wd" shape.
type ShapePhaseId = "ms" | "subgiant" | "rgb" | "hb" | "agb" | "wd"

// ---------- small helpers ----------

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function safePhaseFraction(phase: EvolutionPhase, tMyr: number): number {
  const { tStartMyr, tEndMyr } = phase
  const dt = tEndMyr - tStartMyr
  if (dt <= 0) return 0
  return clamp((tMyr - tStartMyr) / dt, 0, 1)
}

function T_from_LR(L: number, R: number): number {
  // Using L/Lsun = (R/Rsun)^2 (T/Tsun)^4
  const T_sun = 5772
  return T_sun * Math.pow(L / (R * R), 0.25)
}

function R_from_LT(L: number, T: number): number {
  // Invert L/Lsun = (R/Rsun)^2 (T/Tsun)^4 for R
  const T_sun = 5772
  const x = T / T_sun
  return Math.sqrt(L) / (x * x)
}

// ---------- KEYPOINT CONSTRUCTION ----------
// For each big phase, we define a start and end state (L, R, T).
// Within a phase we linearly interpolate between them.
// This guarantees continuity across phase boundaries.

function buildPhaseShapes(
  params: StarParams,
  initial: InitialStarState,
  remnant: RemnantKind,
): Record<ShapePhaseId, PhaseShape> {
  const M = clamp(params.mass, 0.1, 50)
  const Z = clamp(params.metallicity, 0.0, 0.04)
  const fCNO = clamp(params.cnoFraction ?? 0, 0, 1)

  const L0 = initial.L_ms
  const R0 = initial.R_ms
  const T0 = initial.T_eff
  const logL_ms = initial.logL

  // Simple metallicity factor: high Z → a bit cooler, low Z → hotter
  const Zsun = 0.02
  const Zrel = Zsun > 0 ? clamp(Z / Zsun, 0.1, 3.0) : 1.0

  // --- 1) MAIN SEQUENCE (ZAMS → TAMS) ---
  // Low–mass stars brighten slowly on the MS; massive stars change less
  const msBrightening = clamp(0.3 * Math.pow(1 / M, 0.3), 0.05, 0.4) // ~0.3 for 1 Msun
  const msRadiusGrowth = clamp(0.15 * Math.pow(1 / M, 0.2), 0.03, 0.2)

  const msStart: StatePoint = {
    L: L0,
    R: R0,
    T_eff: T0,
  }

  const L_msEnd = L0 * (1 + msBrightening)
  const R_msEnd = R0 * (1 + msRadiusGrowth)
  const T_msEnd = T_from_LR(L_msEnd, R_msEnd) * Math.pow(Zrel, -0.03)

  const msEnd: StatePoint = {
    L: L_msEnd,
    R: R_msEnd,
    T_eff: T_msEnd,
  }

  // --- 2) SUBGIANT ---
  // Envelope expands, luminosity rises a bit, temperature drops.
  const sgLFactor = 1.5 + 1.0 * Math.pow(M, 0.3) // few × brighter
  const sgRFactor = 3.0 + 2.0 * Math.pow(M, 0.2) // radius grows a lot

  const L_sgEnd = L_msEnd * sgLFactor
  const R_sgEnd = R_msEnd * sgRFactor
  const T_sgEnd = T_from_LR(L_sgEnd, R_sgEnd) * Math.pow(Zrel, -0.05)

  const sgEnd: StatePoint = {
    L: L_sgEnd,
    R: R_sgEnd,
    T_eff: T_sgEnd,
  }

  // --- 3) RED-GIANT BRANCH (RGB) ---
  // Very large radius, high luminosity, cooler T (~3500–4500 K).
  const rgbRFactor = 50 * Math.pow(M, 0.6) // tens–hundreds Rsun

  // approximate RGB-tip luminosity from a simple mass–luminosity relation
  const logL_rgbRaw = 4 + 1.3 * Math.log10(M)
  const logL_rgbTip = clamp(
    logL_rgbRaw,
    logL_ms + 0.8, // at least ~6× brighter than MS
    5.8, // cap so even massive stars stay in a sane supergiant range
  )
  const L_rgbTip = Math.pow(10, logL_rgbTip)
  const R_rgbTip = R0 * rgbRFactor

  // target cool RGB temperature, mildly mass-dependent
  const T_rgbNominal = clamp(4100 - 400 * Math.log10(M), 3400, 4600)
  const T_rgbTip = T_rgbNominal * Math.pow(Zrel, -0.05)

  const rgbEnd: StatePoint = {
    L: L_rgbTip,
    R: R_rgbTip,
    T_eff: T_rgbTip,
  }

  // --- 4) CORE HELIUM BURNING (HB / clump / blue loop) ---
  // Luminosity drops from RGB tip, star contracts a lot, T rises.
  const L_hb = L_rgbTip * clamp(0.25 + 0.15 * Math.pow(M, -0.3), 0.2, 0.5)
  const R_hb = R_rgbTip * clamp(0.15 + 0.1 * Math.pow(M, -0.2), 0.08, 0.25)
  const T_hb = T_from_LR(L_hb, R_hb) * Math.pow(Zrel, -0.04)

  const hbEnd: StatePoint = {
    L: L_hb,
    R: R_hb,
    T_eff: T_hb,
  }

  // --- 5) AGB ---
  // Radius and luminosity grow again beyond RGB (thermal pulses etc.).
  const logL_agbRaw =
    logL_rgbTip + clamp(0.15 + 0.25 * Math.log10(M), 0.1, 0.5)
  const logL_agb = clamp(
    logL_agbRaw,
    logL_rgbTip + 0.05,
    6.2, // keep even the brightest AGB / RSG stars below ~1.6×10^6 Lsun
  )
  const L_agb = Math.pow(10, logL_agb)
  const R_agb = R_rgbTip * clamp(1.3 + 0.4 * Math.pow(M, 0.2), 1.2, 2.2)
  const T_agbNominal = T_rgbNominal * 0.9
  const T_agb = T_agbNominal * Math.pow(Zrel, -0.05)

  const agbEnd: StatePoint = {
    L: L_agb,
    R: R_agb,
    T_eff: T_agb,
  }

  // --- 6) FINAL STAGE HANDLING WITH REALISTIC REMNANTS ---
  // For low- and intermediate-mass stars we peel off to a white-dwarf
  // cooling track. For core-collapse progenitors (NS / BH) we end as
  // luminous supergiants or hot WR-like stars instead of faint WDs.

  const isCoreCollapse = remnant !== "wd"

  if (isCoreCollapse) {
    // Base "pre-SN" luminosity: at least as bright as AGB tip,
    // and never below logL ~ 4.5
    const logL_agb = Math.log10(L_agb)
    const logL_core = Math.max(logL_agb, 4.5)
    const L_core = Math.pow(10, logL_core)

    if (remnant === "ns") {
      // Red-supergiant–like endpoint: cool, very luminous.
      const T_rsg = clamp(3600 + 200 * Math.log10(M), 3400, 4300)
      const R_rsg = R_from_LT(L_core, T_rsg)

      const rsgEnd: StatePoint = {
        L: L_core,
        R: R_rsg,
        T_eff: T_rsg,
      }

      return {
        ms: {
          start: msStart,
          end: msEnd,
        },
        subgiant: {
          start: msEnd,
          end: sgEnd,
        },
        rgb: {
          start: sgEnd,
          end: rgbEnd,
        },
        hb: {
          start: rgbEnd,
          end: hbEnd,
        },
        agb: {
          start: hbEnd,
          end: agbEnd,
        },
        // For neutron-star progenitors, keep the final "wd" phase
        // parked as a bright red supergiant / pre-SN core.
        wd: {
          start: agbEnd,
          end: rsgEnd,
        },
      }
    } else {
      // Black-hole progenitors: hotter WR / LBV-like endpoint.
      const logL_core = Math.max(Math.log10(L_agb), 4.5)
      const logL_wr = clamp(logL_core + 0.3, 5.2, 6.2)
      const L_wr = Math.pow(10, logL_wr)
      const T_wr = clamp(
        50000 * Math.pow(M / 25, 0.15),
        40000,
        90000,
      )
      const R_wr = R_from_LT(L_wr, T_wr)

      const wrEnd: StatePoint = {
        L: L_wr,
        R: R_wr,
        T_eff: T_wr,
      }

      return {
        ms: {
          start: msStart,
          end: msEnd,
        },
        subgiant: {
          start: msEnd,
          end: sgEnd,
        },
        rgb: {
          start: sgEnd,
          end: rgbEnd,
        },
        hb: {
          start: rgbEnd,
          end: hbEnd,
        },
        agb: {
          start: hbEnd,
          end: agbEnd,
        },
        // For BH progenitors, final point is hot and extremely luminous.
        wd: {
          start: agbEnd,
          end: wrEnd,
        },
      }
    }
  }

  // --- 6b) WHITE DWARF COOLING (low/intermediate-mass only) ---
  const R_wd = 0.015 * Math.pow(M, -0.2) // very weak mass trend

  const L_wdStart = L0 * clamp(0.08 * Math.pow(M, 0.7), 0.02, 0.3)
  const T_wdStart = 25000 * Math.pow(M, 0.05)

  const L_wdEnd = L0 * clamp(2e-4 * Math.pow(M, 0.3), 5e-5, 5e-4)
  const T_wdEnd = 4500 * Math.pow(Zrel, -0.05)

  const wdStart: StatePoint = {
    L: L_wdStart,
    R: R_wd,
    T_eff: T_wdStart,
  }

  const wdEnd: StatePoint = {
    L: L_wdEnd,
    R: R_wd,
    T_eff: T_wdEnd,
  }

  return {
    ms: {
      start: msStart,
      end: msEnd,
    },
    subgiant: {
      start: msEnd,
      end: sgEnd,
    },
    rgb: {
      start: sgEnd,
      end: rgbEnd,
    },
    hb: {
      start: rgbEnd,
      end: hbEnd,
    },
    agb: {
      start: hbEnd,
      end: agbEnd,
    },
    wd: {
      start: wdStart,
      end: wdEnd,
    },
  }
}

// Helper: map the timeline's EvolutionPhaseId into our internal
// shape keys. All the remnant-specific finals collapse onto "wd".
function shapeKeyForPhase(id: EvolutionPhaseId): ShapePhaseId {
  if (id === "wdFinal" || id === "nsFinal" || id === "bhFinal") {
    return "wd"
  }
  // For all non-final phases, EvolutionPhaseId matches ShapePhaseId.
  return id as ShapePhaseId
}

// ---------- PUBLIC API ----------

/**
 * Given Build-screen parameters, a precomputed EvolutionTimeline, and
 * a physical time tMyr along that timeline, return a smooth, phase-aware
 * stellar state. This is the *only* function the Simulation visuals
 * need to call.
 */
export function getStarStateAtTime(
  params: StarParams,
  timeline: EvolutionTimeline,
  tMyrRaw: number,
): StarEvolutionState {
  const initial = computeInitialStar(params)

  // Remnant fate is decided once in the timeline (mass + Z + CNO)
  const remnant = timeline.remnant

  // clamp time into [0, totalLifetime]
  const total = timeline.totalLifetimeMyr
  const tMyr = clamp(tMyrRaw, 0, total)
  const fracTotal = total > 0 ? tMyr / total : 0

  // locate the active phase
  let active: EvolutionPhase | null = null
  for (const ph of timeline.phases) {
    if (tMyr >= ph.tStartMyr && tMyr <= ph.tEndMyr) {
      active = ph
      break
    }
  }

  // If for some numerical reason we slipped past the end, pin to last phase
  if (!active && timeline.phases.length > 0) {
    active = timeline.phases[timeline.phases.length - 1]
  }

  if (!active) {
    // extremely defensive fallback: just return the initial MS state
    return {
      tMyr: 0,
      fracTotal: 0,
      phaseId: "ms",
      phaseLabel: "Main sequence",
      phaseFrac: 0,
      remnant,
      L: initial.L_ms,
      R: initial.R_ms,
      T_eff: initial.T_eff,
      logL: initial.logL,
      logT: initial.logT,
    }
  }

  const phaseFrac = safePhaseFraction(active, tMyr)

  // build (or rebuild) the phase keypoints for this star
  const shapes = buildPhaseShapes(params, initial, remnant)
  const key = shapeKeyForPhase(active.id)
  const shape = shapes[key]

  const L = lerp(shape.start.L, shape.end.L, phaseFrac)
  const R = lerp(shape.start.R, shape.end.R, phaseFrac)
  const T_eff = lerp(shape.start.T_eff, shape.end.T_eff, phaseFrac)

  const logL = Math.log10(Math.max(L, 1e-6))
  const logT = Math.log10(Math.max(T_eff, 10))

  return {
    tMyr,
    fracTotal,
    phaseId: active.id,
    phaseLabel: active.label,
    phaseFrac,
    remnant,
    L,
    R,
    T_eff,
    logL,
    logT,
  }
}
