// src/engine/debugProbes.ts
import { computeInitialStar, type StarParams } from "./starEngine"
import { computeEvolutionTimeline } from "./starEvolutionEngine"
import { getStarStateAtTime } from "./starEvolutionCurves"

type ProbeRow = {
  mass: number
  Z: number
  cno: number
  lifetimeMyr: number
  tEndMyr: number

  logT_init: number
  logL_init: number

  phaseEnd: string
  remnantEnd: string | null
  logT_end: number
  logL_end: number
}

/**
 * Dev-only helper:
 * sample a grid of (M, Z, CNO) and log initial + endpoint states.
 */
export function runDebugGrid(): ProbeRow[] {
  const masses = [0.1, 0.2, 0.5, 1, 3, 8, 15, 30, 50]
  const metallicities = [0.0, 0.0001, 0.004, 0.02, 0.04]
  const cnoFractions = [0.0, 0.3, 0.6, 1.0]

  const rows: ProbeRow[] = []

  for (const mass of masses) {
    for (const Z of metallicities) {
      for (const cno of cnoFractions) {
        const params: StarParams = { mass, metallicity: Z, cnoFraction: cno }

        const initial = computeInitialStar(params)
        const timeline = computeEvolutionTimeline(params)
        const lifetimeMyr = timeline.totalLifetimeMyr

        // sample right at the end of the timeline
        const end = getStarStateAtTime(params, timeline, timeline.totalLifetimeMyr)

        rows.push({
          mass,
          Z,
          cno,
          lifetimeMyr,
          tEndMyr: timeline.totalLifetimeMyr,

          logT_init: initial.logT,
          logL_init: initial.logL,
          phaseEnd: end.phaseId,
          remnantEnd: end.remnant ?? null,
          logT_end: end.logT,
          logL_end: end.logL,
        })
      }
    }
  }

  const summary = rows.reduce(
    (acc, row) => {
      const key = row.remnantEnd ?? "none"
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  console.log("Remnant summary (count by fate):", summary)

  console.table(rows)
  return rows
}

// Optional: expose on window so you can call it from DevTools
declare global {
  interface Window {
    runDebugGrid?: () => ProbeRow[]
  }
}

if (typeof window !== "undefined") {
  window.runDebugGrid = runDebugGrid
}
