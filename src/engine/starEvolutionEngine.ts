// src/engine/starEvolutionEngine.ts
import type { StarParams, InitialStarState } from "./starEngine"
import { computeInitialStar } from "./starEngine"

export type RemnantKind = "wd" | "ns" | "bh"

type BasePhaseId =
  | "ms"        // main sequence
  | "subgiant"
  | "rgb"       // red-giant branch
  | "hb"        // core He-burning (horizontal branch / clump)
  | "agb"       // asymptotic giant branch
  | "wd"        // generic late cooling phase duration

export type EvolutionPhaseId =
  | BasePhaseId
  | "wdFinal"   // white dwarf cooling track (actual remnant)
  | "nsFinal"   // neutron star cooling track
  | "bhFinal"   // black hole endpoint (no real track)

// Labels for the big evolutionary stages we’ll show
export type EvolutionPhase = {
  id: EvolutionPhaseId
  label: string

  // physical time in Myr
  tStartMyr: number
  tEndMyr: number
  durationMyr: number

  // 0–1 normalized timeline, good for progress bars
  fracStart: number
  fracEnd: number
}

export type EvolutionTimeline = {
  totalLifetimeMyr: number
  phases: EvolutionPhase[]
  initial: InitialStarState   // main-sequence anchor from build engine
  remnant: RemnantKind        // wd / ns / bh fate for this star
}

// --- helpers ---

function clampMass(M: number): number {
  // Lifetime is allowed to vary from 0.1–50 Msun.
  // (Structure / phase fractions will treat everything below ~0.5 Msun
  //  as “low-mass” in the interpolation; see computeEvolutionTimeline.)
  return Math.min(Math.max(M, 0.1), 50)
}

/**
 * Main–sequence lifetime, in Gyr, using the
 *   t_MS ∝ fuel / burn rate ∝ (X * M) / L_ms
 * idea from your engine notes.
 *
 * We scale to the Sun: t_⊙ = 10 Gyr, X_⊙ ≈ 0.70, L_⊙ = 1.
 * This automatically bakes in:
 *   - Mass (via M and L_ms from starEngine)
 *   - CNO effects (via L_ms)
 *   - Composition X
 * plus a mild metallicity tweak.
 */
function mainSequenceLifetimeGyrFromInitial(
  initial: InitialStarState,
  params: StarParams
): number {
  const M = clampMass(params.mass)
  const Z = Math.min(Math.max(params.metallicity, 0.0001), 0.04)

  const X = initial.X
  const L_ms = Math.max(initial.L_ms, 1e-4) // guard vs 0

  // Solar reference values
  const tSunGyr = 10         // 10 Gyr
  const X_sun = 0.70
  const L_sun = 1.0          // because L_ms is already in L☉

  // Fuel / burn-rate scaling
  const fuelFactor = X / X_sun
  const burnRateFactor = L_ms / L_sun
  const massFactor = M      // M / M_sun, and M_sun = 1

  let tGyr = tSunGyr * fuelFactor * (massFactor / burnRateFactor)

  // Mild metallicity tweak: metal-rich stars live a bit longer
  const Zsun = 0.02
  const Zrel = Zsun > 0 ? Z / Zsun : 1
  tGyr *= Math.pow(Zrel, 0.2)

  // Keep lifetimes within a sane range for gameplay:
  //   - don’t let extreme dwarfs live > 200 Gyr
  //   - don’t let massive stars live < a few Myr
  const tMinGyr = 0.003   // 3 Myr
  const tMaxGyr = 200     // 200 Gyr

  tGyr = Math.min(Math.max(tGyr, tMinGyr), tMaxGyr)

  return tGyr
}

/**
 * Main entry point:
 * given the Build–screen parameters, return phase durations & normalized
 * fractions along the total lifetime.
 */
export function computeEvolutionTimeline(
  params: StarParams
): EvolutionTimeline {
  const M = clampMass(params.mass)

  const remnant: RemnantKind =
    M < 8 ? "wd" : M < 25 ? "ns" : "bh"

  // main-sequence anchor state (T_eff, R_ms, L_ms, etc.)
  const initial = computeInitialStar(params)

  // --- 1. Main–sequence lifetime in Myr ---
  const tMsGyr = mainSequenceLifetimeGyrFromInitial(initial, params)
  const tMsMyr = tMsGyr * 1_000

  // --- 2. Mass-dependent post–MS fractions (relative to t_MS) ---
  // For low-mass (~1 Msun):
  //   subgiant ~ 0.05 t_MS
  //   RGB      ~ 0.10 t_MS
  //   HB       ~ 0.10 t_MS
  //   AGB      ~ 0.02 t_MS
  //
  // For high mass (~50 Msun) everything after MS is very fast,
  // so these fractions shrink smoothly with log(M).

  // For the *shape* of the lifetime fractions, we only want to
  // distinguish “low-mass” vs “high-mass” behavior. Below about
  // 0.5 Msun everything looks like a very long-lived low-mass star,
  // so we clamp the *structural* mass there, while still letting the
  // lifetime itself use the full 0.1–50 Msun range via clampMass().
  const Mstruct = Math.min(Math.max(M, 0.5), 50)

  const logMinStruct = Math.log10(0.5)
  const logMaxStruct = Math.log10(50)
  const uStruct = Math.min(
    Math.max(
      (Math.log10(Mstruct) - logMinStruct) / (logMaxStruct - logMinStruct),
      0
    ),
    1
  )

  // helper: interpolate between "low-mass" (uStruct=0) and
  // "high-mass" (uStruct=1) behavior
  const lerp = (low: number, high: number) => low + (high - low) * uStruct

  const fSub = lerp(0.05, 0.01)
  const fRGB = lerp(0.10, 0.015)
  const fHB  = lerp(0.10, 0.02)
  const fAGB = lerp(0.02, 0.005)

  const rawPostSum = fSub + fRGB + fHB + fAGB

  // we want the combined post-MS duration to be
  //   ~0.27 t_MS for low mass, ~0.15 t_MS for high mass
  const targetPostFrac = lerp(0.27, 0.15)
  const scale = targetPostFrac / rawPostSum

  const tSub = fSub * scale * tMsMyr
  const tRGB = fRGB * scale * tMsMyr
  const tHB  = fHB  * scale * tMsMyr
  const tAGB = fAGB * scale * tMsMyr

  // White-dwarf cooling track:
  // ridiculously long, but we cap it so progress bars stay sane.
  const rawWD = 10 * tMsMyr * Math.pow(M, -0.7)
  const tWD   = Math.min(rawWD, 5 * tMsMyr)  // cap at ~5× main-sequence lifetime

  const durations: Record<BasePhaseId, number> = {
    ms:  tMsMyr,
    subgiant: tSub,
    rgb: tRGB,
    hb:  tHB,
    agb: tAGB,
    wd:  tWD,
  }

  const totalLifetimeMyr = Object.values(durations).reduce(
    (sum, t) => sum + t,
    0
  )

  // Base sequence of phases before the final remnant-specific tail
  const orderedBase: { id: BasePhaseId; label: string }[] = [
    { id: "ms",       label: "Main sequence" },
    { id: "subgiant", label: "Subgiant" },
    { id: "rgb",      label: "Red giant branch" },
    { id: "hb",       label: "Helium burning" },
    { id: "agb",      label: "Asymptotic giant branch" },
  ]

  // Pick a final phase id/label based on the remnant kind
  let finalPhaseId: EvolutionPhaseId
  let finalLabel: string

  if (remnant === "wd") {
    finalPhaseId = "wdFinal"
    finalLabel = "White dwarf cooling"
  } else if (remnant === "ns") {
    finalPhaseId = "nsFinal"
    finalLabel = "Neutron star cooling"
  } else {
    finalPhaseId = "bhFinal"
    finalLabel = "Black hole remnant"
  }

  let cursor = 0
  const phases: EvolutionPhase[] = []

  // push all non-terminal phases
  for (const { id, label } of orderedBase) {
    const dt = durations[id]
    const tStart = cursor
    const tEnd = cursor + dt
    cursor = tEnd

    const fracStart = tStart / totalLifetimeMyr
    const fracEnd = tEnd / totalLifetimeMyr

    phases.push({
      id,
      label,
      tStartMyr: tStart,
      tEndMyr: tEnd,
      durationMyr: dt,
      fracStart,
      fracEnd,
    })
  }

  // push the remnant-specific final cooling / endpoint phase
  {
    const dt = durations.wd
    const tStart = cursor
    const tEnd = cursor + dt
    cursor = tEnd

    const fracStart = tStart / totalLifetimeMyr
    const fracEnd = tEnd / totalLifetimeMyr

    phases.push({
      id: finalPhaseId,
      label: finalLabel,
      tStartMyr: tStart,
      tEndMyr: tEnd,
      durationMyr: dt,
      fracStart,
      fracEnd,
    })
  }

  return { totalLifetimeMyr, phases, initial, remnant }
}

