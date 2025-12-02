type ScoringScreenProps = {
  onRestart: () => void
}

export function ScoringScreen({ onRestart }: ScoringScreenProps) {
  return (
    <section className="panel">
      <h2>Scoring</h2>
      <p>Final results and reflections will appear here.</p>
      <button onClick={onRestart}>Build another star</button>
    </section>
  )
}

