type IntroScreenProps = {
  onStartTutorial: () => void
  onSkipToBuild: () => void
}

export function IntroScreen({
  onStartTutorial,
  onSkipToBuild,
}: IntroScreenProps) {
  // mark props as used so TypeScript doesn’t complain
  void onStartTutorial
  void onSkipToBuild

  return (
    <section className="panel panel-intro">
      <h2>Welcome to the Star Factory</h2>
      <p style={{ marginTop: "-0.5rem", fontSize: "0.9rem", opacity: 0.8 }}>
        by NateC & NathanM
      </p>

      <p>
        You&apos;re running a stellar assembly line. Your job: choose the mass,
        metallicity (Z), and CNO content of newborn stars and see how their
        lives unfold on the HR diagram.
      </p>

      <p>
        Massive, metal-poor, CNO-rich? Tiny, metal-rich, long-lived? Your
        choices set the brightness, color, lifetime, and final fate.
      </p>

      <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "1rem" }}>
        This project was created as a final assignment for the University of
        Utah fall 2025 ASTRO 3070 course.
      </p>
    </section>
  )
}

