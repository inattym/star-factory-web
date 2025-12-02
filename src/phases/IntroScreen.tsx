type IntroScreenProps = {
  onStartTutorial: () => void
  onSkipToBuild: () => void
}

export function IntroScreen({
  onStartTutorial,
  onSkipToBuild,
}: IntroScreenProps) {
  return (
    <section className="panel panel-intro">
      <h2>Welcome to the Star Factory</h2>
      <p>
        You&apos;re running a stellar assembly line. Your job: choose the mass,
        metallicity (Z), and CNO content of newborn stars and see how their
        lives unfold on the HR diagram.
      </p>
      <p>
        Massive, metal-poor, CNO-rich? Tiny, metal-rich, long-lived? Your
        choices set the brightness, color, lifetime, and final fate.
      </p>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <button onClick={onStartTutorial}>Start Tutorial</button>
        <button onClick={onSkipToBuild}>Skip to Building</button>
      </div>
    </section>
  )
}
