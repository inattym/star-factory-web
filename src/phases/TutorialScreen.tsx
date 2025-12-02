export function TutorialScreen() {
  return (
    <section className="panel">
      <h2>Tutorial</h2>
      <p>
        Welcome to the Star Factory! Here’s a simple, middle‑school‑friendly breakdown of how the whole game works.
      </p>

      <h3>1. You choose what your star is made of</h3>
      <p>
        Every star starts with ingredients. In this game you control three important ones:
        <br />• <strong>Mass</strong> — how big your star is
        <br />• <strong>Metallicity</strong> — the extra elements mixed in besides hydrogen
        <br />• <strong>CNO Fraction</strong> — special ingredients (Carbon, Nitrogen, Oxygen) that make the star burn hotter
        <br /><br />
        These choices decide how your star looks, how bright it gets, and how long it lives.
      </p>

      <h3>2. The game uses simple astronomy rules</h3>
      <p>
        Your star follows real physics ideas:
        <br />• Bigger mass → burns fuel faster → shorter life
        <br />• Smaller mass → burns slowly → much longer life
        <br />• More metals → slightly cooler and redder
        <br />• More CNO → hotter core → brighter star
      </p>

      <h3>3. We place your star on the HR Diagram</h3>
      <p>
        The HR Diagram is a famous star chart:
        <br />• Left → Right: Hot → Cool
        <br />• Bottom → Top: Dim → Bright
        <br /><br />
        Your star appears as a dot, just like real stars astronomers study.
      </p>

      <h3>4. Your star ages over time</h3>
      <p>
        As time passes, your star moves through life stages:
        <br />Main Sequence → Subgiant → Red Giant → Helium Burning → AGB → Final fate (White Dwarf, Neutron Star, or Black Hole)
        <br /><br />
        Each stage changes its temperature, brightness, size, and its position on the HR Diagram.
      </p>

      <h3>5. The visual star matches the physics</h3>
      <p>
        The star you see isn’t random — it updates based on the physics:
        <br />• Hotter → turns bluer
        <br />• Cooler → turns redder
        <br />• Brighter → glow increases
        <br />• Larger → the star circle grows
        <br /><br />
        As the HR Diagram dot moves, the visual star changes with it.
      </p>

      <h3>6. Your goal</h3>
      <p>
        Try to create the <strong>longest‑living star</strong> possible! Adjust the ingredients and see how tiny changes affect its entire life story.
      </p>
    </section>
  )
}
