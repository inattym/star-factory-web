// src/engine/starEngine.ts

// Input parameters controlled by the sliders
export type StarParams = {
  mass: number          // in solar masses (M☉)
  metallicity: number   // Z
  cnoFraction: number   // fraction of Z in CNO elements (0–1)
}

// Output: physical state of a main-sequence star, in solar-ish units
export type InitialStarState = {
  // Composition
  X: number       // hydrogen mass fraction
  Y: number       // helium mass fraction
  Z: number       // metals (same as input metallicity)
  Z_cno: number   // CNO part of metals
  Z_other: number // non-CNO metals

  // Structure
  L_ms: number    // main-sequence luminosity in L☉
  R_ms: number    // main-sequence radius in R☉
  T_eff: number   // effective temperature in K

  // HR diagram coordinates
  logL: number    // log10(L/L☉)
  logT: number    // log10(T/K)
}

/**
 * Clamp a value into [min, max].
 */
function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

/**
 * Compute a physically-motivated main-sequence star:
 * - Uses simple mass–luminosity and mass–radius scalings
 * - Includes helium enrichment with metallicity
 * - Modifies temperature/luminosity slightly with Z and CNO fraction
 *
 * This is NOT a full stellar evolution code, but it respects the
 * qualitative trends used in real stellar astrophysics.
 */
export function computeInitialStar(params: StarParams): InitialStarState {
  const { mass, metallicity, cnoFraction } = params

  // --- Basic sanity / clamping of inputs ---
  const M = clamp(mass, 0.1, 50)          // stay in 0.1–50 M☉
  const Z = clamp(metallicity, 0.0, 0.04) // 0–0.04 (~0–2 Z☉)
  const fCNO = clamp(cnoFraction, 0, 1)

  // --- Metal partition ---
  const Z_cno = Z * fCNO
  const Z_other = Z * (1 - fCNO)

  // --- Helium enrichment law ---
  // Primordial helium Y_p ≈ 0.248, dY/dZ ≈ 1.5–2
  const Y_p = 0.248
  const dYdZ = 1.7
  let Y = Y_p + dYdZ * Z

  // Ensure Y is not crazy (0–0.5)
  Y = clamp(Y, 0.22, 0.40)

  // Hydrogen is what's left
  let X = 1 - Y - Z
  X = Math.max(0, X)

  // --- Mass–luminosity & mass–radius relations (main sequence) ---
  // Simple broken power law for *base* luminosity:
  //   low-mass < 0.5 M☉:   L ∝ M^2.3
  //   0.5–2 M☉:           L ∝ M^4
  //   > 2 M☉:             L ∝ M^3.5
  let L_ms_base: number
  if (M < 0.5) {
    L_ms_base = Math.pow(M, 2.3)
  } else if (M < 2) {
    L_ms_base = Math.pow(M, 4.0)
  } else {
    L_ms_base = Math.pow(M, 3.5)
  }

  // Radius scaling: roughly R ∝ M^0.8 on the main sequence
  const R_ms = Math.pow(M, 0.8)

  // --- Metallicity dependence (L and T) ---
  // Higher Z → higher opacity → slightly cooler *and* dimmer at fixed M.
  const Z_sun = 0.02
  const Z_rel = Z_sun > 0 ? clamp(Z / Z_sun, 0.1, 3.0) : 1.0

  // Luminosity: metal-poor stars a bit more luminous, metal-rich a bit less.
  const L_Z_factor = Math.pow(Z_rel, -0.25)
  let L_ms = L_ms_base * L_Z_factor

  // --- "Base" effective temperature from L and R ---
  // Using L/L☉ = (R/R☉)^2 (T/T☉)^4
  const T_sun = 5772 // K
  const T_base = T_sun * Math.pow(L_ms / (R_ms * R_ms), 0.25)

  // Temperature metallicity tweak (opacity effect on top)
  const metallicityExponent = -0.10
  let T_eff = T_base * Math.pow(Z_rel, metallicityExponent)

  // --- CNO dependence (only really matters for more massive stars) ---
  // For M ≳ 1.3 M☉ the CNO cycle matters; for low mass it’s basically pp-chain.
  if (M > 1.3) {
    // Weight that rises from ~0 at 1.3 M☉ to ~1.0 at ~5 M☉
    const massWeight = clamp((M - 1.3) / (5.0 - 1.3), 0, 1)

    // Let fCNO depart from a "reference" 0.3 (roughly solar mix)
    const fCNO_ref = 0.3
    const deltaCNO = fCNO - fCNO_ref

    // Up to ~±20% in L and ~±8% in T for extreme CNO at high mass
    const L_cnoBoost = 1 + 0.4 * deltaCNO * massWeight
    const T_cnoBoost = 1 + 0.15 * deltaCNO * massWeight

    L_ms *= L_cnoBoost
    T_eff *= T_cnoBoost
  }

  const logL = Math.log10(L_ms)
  const logT = Math.log10(T_eff)

  return {
    X,
    Y,
    Z,
    Z_cno,
    Z_other,
    L_ms,
    R_ms,
    T_eff,
    logL,
    logT,
  }
}

