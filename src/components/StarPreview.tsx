// src/components/StarPreview.tsx
import React from "react"

type RemnantKind = "wd" | "ns" | "bh"

type StarPreviewProps = {
  sizePx: number        // diameter in pixels
  color: string         // base color from T_eff
  glow: number          // 0–1, from luminosity (derived from starEngine)
  pulseSeconds: number  // pulsation period in seconds
  remnant?: RemnantKind // optional: WD / NS / BH visual tweaks
}

/**
 * Take a CSS color string (rgb(...), hsl(...), or hex) and
 * return a version with the requested alpha, when possible.
 * This is ONLY used for the soft halo tint.
 */
function withAlpha(base: string, alpha: number): string {
  const trimmed = base.trim()

  // rgb(r, g, b) -> rgba(r, g, b, a)
  if (trimmed.startsWith("rgb(")) {
    const inside = trimmed.slice(4, -1) // drop "rgb(" and ")"
    return `rgba(${inside}, ${alpha})`
  }

  // hsl(h s% l%) -> hsl(h s% l% / a)
  if (trimmed.startsWith("hsl(")) {
    const inside = trimmed.slice(4, -1)
    return `hsl(${inside} / ${alpha})`
  }

  // For hex / named colors we just fall back to the original;
  // browsers will ignore the alpha in boxShadow if not supported.
  return trimmed
}

export function StarPreview({
  sizePx,
  color,
  glow,
  pulseSeconds,
  remnant,
}: StarPreviewProps) {
  const g = Math.max(0, Math.min(glow, 1))

  const isWD = remnant === "wd"
  const isNS = remnant === "ns"
  const isBH = remnant === "bh"

  // Visual size of the disc: default = sizePx, but neutron stars shrink to a tiny dot
  const baseSize = sizePx
  const discSize = isNS
    ? Math.min(Math.max(baseSize * 0.22, 34), 56) // clamp to a small but visible range
    : baseSize

  // For white dwarfs, never let the visual glow drop too low
  // so they always keep a 3D-looking disc + halo even if
  // physically very faint.
  const gVisual = isWD ? Math.max(g, 0.35) : g

  // Detect dark vs light so we can make halo stronger on white backgrounds
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches

  // Global brightness factor: dim stars ~0.6, bright stars ~1.4
  const brightness = 0.6 + 0.8 * gVisual
  const brightnessBoost = isNS ? 1.6 : isBH ? 0.8 : 1
  const finalBrightness = brightness * brightnessBoost

  // Halo sizes scale with luminosity, then are tweaked by remnant type
  const baseInnerHalo = 20 + gVisual * 40 // 20–60 px
  const baseOuterHalo = 60 + gVisual * 80 // 60–140 px

  let haloBoost = 1
  if (isWD) haloBoost = 0.7 // compact, faint
  else if (isNS) haloBoost = 1.4 // tiny but very intense
  else if (isBH) haloBoost = 0.5 // tight ring, not a huge glow

  const innerHalo = baseInnerHalo * haloBoost
  const outerHalo = baseOuterHalo * haloBoost

  // Base star-disc background
  let discBackground = `radial-gradient(
      circle at 30% 25%,
      #ffffff,
      ${color},
      #000000 80%
    )`
  let discBorder: string | undefined

  if (isWD) {
    // small, hot, very white, with stronger 3D shading
    discBackground = `radial-gradient(
      circle at 26% 22%,
      #ffffff 0%,
      #f9f9ff 20%,
      #e4e9ff 45%,
      #c3ccff 70%,
      #7a82a8 100%
    )`
  } else if (isNS) {
    // neutron star: tiny, extremely hot blue-white point with a tight dark rim
    discBackground = `radial-gradient(
      circle at 30% 24%,
      #ffffff 0%,
      #f7fbff 18%,
      #c5ddff 35%,
      #5a7fff 60%,
      #020618 100%
    )`
    discBorder = "1px solid rgba(210, 225, 255, 0.9)"
  } else if (isBH) {
    // dark center with a bright, fairly thin ring
    discBackground = `radial-gradient(
      circle at center,
      #000000 55%,
      #9ec4ff 60%,
      #4d7bff 63%,
      #000000 75%
    )`
    discBorder = "2px solid rgba(158, 196, 255, 0.6)"
  }

  // === THEME-AWARE HALO ALPHAS ===
  const whiteHaloBase = prefersDark ? 0.05 : 0.02
  const whiteHaloSlope = prefersDark ? 0.10 : 0.05

  const colorInnerBase = prefersDark ? 0.20 : 0.55
  const colorInnerSlope = prefersDark ? 0.15 : 0.60

  const colorOuterBase = prefersDark ? 0.05 : 0.35
  const colorOuterSlope = prefersDark ? 0.10 : 0.45

  let whiteHaloAlpha = whiteHaloBase + whiteHaloSlope * gVisual
  let colorHaloInnerAlpha = colorInnerBase + colorInnerSlope * gVisual
  let colorHaloOuterAlpha = colorOuterBase + colorOuterSlope * gVisual

  // WD / NS halo tint: force cool blue instead of the generic color
  const haloTintColor =
    isWD || isNS ? "rgb(180, 210, 255)" : color

  // For BHs: kill most of the glow, keep just a faint blue-ish ring
  if (isBH) {
    whiteHaloAlpha *= 0.1
    colorHaloInnerAlpha = 0.18
    colorHaloOuterAlpha = 0.10
  }

  // Extra faint gray halo ONLY in light mode to give contrast on white bg
  const extraLightHalo = !prefersDark && !isBH
    ? `, 0 0 ${outerHalo * 1.4}px rgba(0, 0, 0, 0.06)`
    : ""

  // --- STAR DISC STYLE ---
  const boxShadow = isBH
    ? `
      0 0 ${innerHalo * 0.8}px rgba(120, 170, 255, 0.35),
      0 0 ${outerHalo}px rgba(70, 120, 255, 0.2)
    `
    : `
      0 0 ${innerHalo * 0.5}px rgba(255, 255, 255, ${whiteHaloAlpha}),
      0 0 ${outerHalo * 0.8}px ${withAlpha(haloTintColor, colorHaloInnerAlpha)},
      0 0 ${outerHalo * 1.2}px ${withAlpha(haloTintColor, colorHaloOuterAlpha)}
      ${extraLightHalo}
    `

  const finalBoxShadow =
    isWD && !isBH
      ? `${boxShadow},
      inset 0 0 ${discSize * 0.22}px rgba(0, 0, 40, 0.45)`
      : boxShadow

  const style: React.CSSProperties = {
    width: `${discSize}px`,
    height: `${discSize}px`,
    borderRadius: "50%",

    background: discBackground,
    border: discBorder,

    boxShadow: finalBoxShadow,
    filter: `brightness(${finalBrightness})`,
  }

  // --- GROUND SHADOW STYLE ---
  const shadowWidth = discSize * 1.05
  const shadowHeight = discSize * 0.30
  const centerAlpha = 0.25 + 0.35 * gVisual

  const shadowStyle: React.CSSProperties = {
    width: `${shadowWidth}px`,
    height: `${shadowHeight}px`,
    background: `radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, ${centerAlpha}) 0%,
      rgba(0, 0, 0, ${centerAlpha * 0.6}) 40%,
      rgba(0, 0, 0, 0) 100%
    )`,
    borderRadius: "50%",
    filter: "blur(3px)",
    ["--shadow-offset" as any]: `${-discSize * 0.08}px`,
  }

  return (
    <div
      className="star-preview-wrapper"
      style={{ ["--pulse-duration" as any]: `${pulseSeconds}s` }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2.4rem",
        }}
      >
        <div className="star-preview" style={style} />
        {/* black holes: no cute drop shadow */}
        {!isBH && <div className="star-ground-shadow" style={shadowStyle} />}
      </div>
    </div>
  )
}
