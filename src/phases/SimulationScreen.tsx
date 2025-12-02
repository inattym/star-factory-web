// src/phases/SimulationScreen.tsx
import React from "react"
import type { StarParams } from "../engine/starEngine"
import { SimulationRunner } from "../components/Simulation/SimulationRunner"

type SimulationScreenProps = {
  params: StarParams
  initialSizePx: number
  initialColor: string
  initialGlow: number
  initialPulseSeconds: number
}

export function SimulationScreen({
  params,
  initialSizePx,
  initialColor,
  initialGlow,
  initialPulseSeconds,
}: SimulationScreenProps) {
  return (
    <main className="app-main">
      <SimulationRunner
        params={params}
        initialSizePx={initialSizePx}
        initialColor={initialColor}
        initialGlow={initialGlow}
        initialPulseSeconds={initialPulseSeconds}
      />
    </main>
  )
}
