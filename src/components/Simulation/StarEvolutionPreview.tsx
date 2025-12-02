import { StarPreview } from "../StarPreview"

type StarEvolutionPreviewProps = {
  sizePx: number
  color: string
  glow: number
  // optional – only set near the very end of the simulation
  remnant?: "wd" | "ns" | "bh"
  pulseSeconds?: number
}

export function StarEvolutionPreview({
  sizePx,
  color,
  glow,
  remnant,
  pulseSeconds,
}: StarEvolutionPreviewProps) {
  return (
    <StarPreview
      sizePx={sizePx}
      color={color}
      glow={glow}
      remnant={remnant}
      pulseSeconds={pulseSeconds ?? 3}
    />
  )
}