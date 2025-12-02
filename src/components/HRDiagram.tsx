// src/components/HRDiagram.tsx

type HRPoint = { logT: number; logL: number; isCollapse?: boolean }

type HRDiagramProps = {
  current?: HRPoint         // current star position
  track?: HRPoint[]         // trail for simulation (optional)
  disableStarZoom?: boolean // when true, stay zoomed-out on global ranges
  remnant?: "wd" | "ns" | "bh" // optional: final fate to style marker
  fracTotal?: number        // 0–1 along total lifetime
  hasFinished?: boolean     // true once simulation is done
}

export function HRDiagram({
  current,
  track,
  disableStarZoom,
  remnant,
  fracTotal,
  hasFinished,
}: HRDiagramProps) {
  // DIAGRAM SIZE (inside the 500×300 bubble)
  const width = 460
  const height = 280

  // Base HR backbone (in log space)
  const mainSequenceBackbone: HRPoint[] = [
    { logT: 4.7,  logL: 5.5 },
    { logT: 4.5,  logL: 3.0 },
    { logT: 4.3,  logL: 1.2 },
    { logT: 4.1,  logL: 0.3 },
    { logT: 3.9,  logL: -0.5 },
    { logT: 3.7,  logL: -1.5 },
    { logT: 3.55, logL: -2.5 },
  ]

  // ---------- helper: deterministic pseudo-random (stable across renders) ----------
  function pseudoRandom(i: number, seed: number) {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
    return x - Math.floor(x)
  }

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
  }

  // sample a point along the main-sequence backbone, t in [0,1]
  function sampleMainSequence(t: number): HRPoint {
    const pts = mainSequenceBackbone
    const n = pts.length
    if (n === 0) return { logT: 4, logL: 0 }

    const totalSeg = n - 1
    const u = Math.min(Math.max(t, 0), 1) * totalSeg
    const i = Math.min(Math.floor(u), totalSeg - 1)
    const local = u - i

    const p0 = pts[i]
    const p1 = pts[i + 1]

    return {
      logT: lerp(p0.logT, p1.logT, local),
      logL: lerp(p0.logL, p1.logL, local),
    }
  }

  // build a clustered "cloud" of MS points (all same color for now)
  function buildMainSequenceCloud(): HRPoint[] {
    const cloud: HRPoint[] = []
    let indexOffset = 0
    const seed = 42

    function addBand(
      t0: number,
      t1: number,
      count: number,
      scatterT: number,
      scatterL: number,
    ) {
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) / count
        const t = lerp(t0, t1, u)
        const base = sampleMainSequence(t)

        const r1 = pseudoRandom(indexOffset + i, seed)
        const r2 = pseudoRandom(indexOffset + i, seed + 1)

        const dT = (r1 - 0.5) * scatterT
        const dL = (r2 - 0.5) * scatterL

        cloud.push({
          logT: base.logT + dT,
          logL: base.logL + dL,
        })
      }
      indexOffset += count
    }

    // Hot O/B: sparse but noticeably puffier
    addBand(0.0, 0.25, 35, 0.05, 0.45)

    // Mid A–G: medium density, medium puffiness
    addBand(0.25, 0.65, 90, 0.06, 0.60)

    // Cool K–M: densest, widest band
    addBand(0.65, 1.0, 130, 0.08, 0.80)

    return cloud
  }

  const mainSequenceCloud = buildMainSequenceCloud()

  // --- Global base ranges: always cover full main sequence cloud ---

  let baseTMin = Math.min(3.5, ...mainSequenceCloud.map(p => p.logT))
  let baseTMax = Math.max(4.7, ...mainSequenceCloud.map(p => p.logT))
  let baseLMin = Math.min(-4, ...mainSequenceCloud.map(p => p.logL))
  let baseLMax = Math.max(6,  ...mainSequenceCloud.map(p => p.logL))

  const baseTSpan = baseTMax - baseTMin || 1
  const baseLSpan = baseLMax - baseLMin || 1

  // slight padding so things aren’t glued to the edges
  baseTMin -= 0.05 * baseTSpan
  baseTMax += 0.05 * baseTSpan
  baseLMin -= 0.10 * baseLSpan
  baseLMax += 0.05 * baseLSpan

  // Now compute a tighter "star" range from the track/current alone
  const starPoints: HRPoint[] =
    track && track.length > 0
      ? track
      : current
      ? [current]
      : []

  let T_MIN = baseTMin
  let T_MAX = baseTMax
  let L_MIN = baseLMin
  let L_MAX = baseLMax

  // only do the zoomy stuff if we are NOT explicitly told to stay global
  if (starPoints.length > 0 && !disableStarZoom) {
    const tVals = starPoints.map((p) => p.logT)
    const lVals = starPoints.map((p) => p.logL)

    let starTMin = Math.min(...tVals)
    let starTMax = Math.max(...tVals)
    let starLMin = Math.min(...lVals)
    let starLMax = Math.max(...lVals)

    // Ensure a minimum window so we never zoom to a single pixel
    const minTSpan = 0.20
    const minLSpan = 1.0

    let starTSpan = Math.max(starTMax - starTMin, minTSpan)
    let starLSpan = Math.max(starLMax - starLMin, minLSpan)

    const starTCenter = 0.5 * (starTMin + starTMax)
    const starLCenter = 0.5 * (starLMin + starLMax)

    starTMin = starTCenter - starTSpan / 2
    starTMax = starTCenter + starTSpan / 2
    starLMin = starLCenter - starLSpan / 2
    starLMax = starLCenter + starLSpan / 2

    const globalTSpan = baseTMax - baseTMin || 1
    const globalLSpan = baseLMax - baseLMin || 1

    const spanRatio = Math.min(
      1,
      Math.max(
        0,
        Math.max(starTSpan / globalTSpan, starLSpan / globalLSpan),
      ),
    )

    // Base zoom based on how small the star region is
    const zoomStrengthBase = Math.min(0.75, 1 - spanRatio)

    // --- ease zoom to zero at very start and very end of the track ---
    let progressFrac: number | null = null
    if (track && track.length > 1 && current) {
      // find index in track closest to current point
      let bestIdx = 0
      let bestDist = Infinity
      track.forEach((p, idx) => {
        const dT = p.logT - current.logT
        const dL = p.logL - current.logL
        const d2 = dT * dT + dL * dL
        if (d2 < bestDist) {
          bestDist = d2
          bestIdx = idx
        }
      })
      progressFrac = bestIdx / (track.length - 1) // 0 at start, 1 at end
    }

    // edgeFactor = 0 at very start/end, 1 in the middle of evolution
    let effectiveZoom = zoomStrengthBase
    if (progressFrac !== null) {
      const edgeFactor = Math.min(progressFrac, 1 - progressFrac) * 2
      // blend: at edges → zoom → 0 (full view); middle → full zoom
      effectiveZoom = zoomStrengthBase * edgeFactor
    }

    T_MIN = baseTMin * (1 - effectiveZoom) + starTMin * effectiveZoom
    T_MAX = baseTMax * (1 - effectiveZoom) + starTMax * effectiveZoom
    L_MIN = baseLMin * (1 - effectiveZoom) + starLMin * effectiveZoom
    L_MAX = baseLMax * (1 - effectiveZoom) + starLMax * effectiveZoom
  }

  // Layout inside the SVG
  const paddingLeft = 60      // room for y-axis label + ticks
  const paddingRight = 110    // room on the right for legend
  const paddingTop = 25
  const paddingBottom = 40

  // horizontal shift for the whole diagram
  const xOffset = 0           // 0 so we don’t clip anything

  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom

  // legend position: inside the SVG, right side, vertically centered-ish
  const legendX = width - 90
  const legendY = paddingTop + 60

  function mapPoint(p: HRPoint) {
    const { logT, logL } = p
    const tClamped = Math.min(Math.max(logT, T_MIN), T_MAX)
    const lClamped = Math.min(Math.max(logL, L_MIN), L_MAX)

    const tNorm = (tClamped - T_MIN) / (T_MAX - T_MIN)
    const lNorm = (lClamped - L_MIN) / (L_MAX - L_MIN)

    const x = paddingLeft + (1 - tNorm) * plotWidth + xOffset // hotter → left
    const y = paddingTop + (1 - lNorm) * plotHeight           // brighter → top

    return { x, y }
  }
  








  // --- split track into solid part + dashed collapse polyline ---
  let solidTrackPoints: HRPoint[] | undefined
  let collapseTrackPoints: HRPoint[] | undefined

  if (track && track.length > 1) {
    const firstCollapseIdx = track.findIndex((p) => p.isCollapse)

    if (firstCollapseIdx >= 0) {
      // solid: everything strictly before first collapse
      solidTrackPoints =
        firstCollapseIdx > 0 ? track.slice(0, firstCollapseIdx) : []

      // dashed: start one point before the first collapse (if exists)
      const startIdx = Math.max(firstCollapseIdx - 1, 0)
      const rawCollapse = track.slice(startIdx)

      // 🔧 downsample collapse points so dashed hop looks clean & segmented
      if (rawCollapse.length <= 12) {
        collapseTrackPoints = rawCollapse
      } else {
        const step = Math.max(1, Math.floor(rawCollapse.length / 12))
        collapseTrackPoints = rawCollapse.filter(
          (_, idx) => idx % step === 0 || idx === rawCollapse.length - 1,
        )
      }
    } else {
      // no collapse at all -> everything solid
      solidTrackPoints = track
      collapseTrackPoints = undefined
    }
  }









  const solidTrackPath =
    solidTrackPoints && solidTrackPoints.length > 1
      ? solidTrackPoints
          .map(pt => {
            const { x, y } = mapPoint(pt)
            return `${x},${y}`
          })
          .join(" ")
      : undefined

  const collapseTrackPath =
    collapseTrackPoints && collapseTrackPoints.length > 1
      ? collapseTrackPoints
          .map(pt => {
            const { x, y } = mapPoint(pt)
            return `${x},${y}`
          })
          .join(" ")
      : undefined

  const currentPos = current ? mapPoint(current) : undefined

  // Generate dynamic tick arrays based on computed ranges
  const L_TICKS = Array.from({ length: 6 }, (_, i) =>
    L_MIN + ((L_MAX - L_MIN) * i) / 5,
  )
  const T_TICKS = Array.from({ length: 6 }, (_, i) =>
    T_MIN + ((T_MAX - T_MIN) * i) / 5,
  )

  // --- remnant-aware marker style for the current star ---
  const markerStyle = (() => {
    if (remnant === "wd") {
      // pale, small-ish point
      return {
        outerR: 6,
        innerR: 3,
        outerStroke: "#cfd8ff",
        innerFill: "#f5f5ff",
        innerStroke: "#cfd8ff",
      }
    }
    if (remnant === "ns") {
      // neutron star: hot blue-white point
      return {
        outerR: 7.5,
        innerR: 3.6,
        outerStroke: "#9ec9ff",   // ring
        innerFill: "#e4f0ff",     // core
        innerStroke: "#9ec9ff",
      }
    }
    if (remnant === "bh") {
      // dark center with purple ring
      return {
        outerR: 8,
        innerR: 4,
        outerStroke: "#bb86fc",
        innerFill: "#050814",
        innerStroke: "#bb86fc",
      }
    }
    // default: original styling via CSS variables
    return {
      outerR: 7,
      innerR: 3.3,
      outerStroke: "var(--hr-current-ring)",
      innerFill: "var(--hr-current-fill)",
      innerStroke: "var(--hr-current-ring)",
    }
  })()

  // --- legend label + marker style (match remnant) ---
  const legendLabel =
    remnant === "wd"
      ? "White dwarf"
      : remnant === "ns"
      ? "Neutron star"
      : remnant === "bh"
      ? "Black hole"
      : "Your star"

  const legendMarkerStyle = (() => {
    if (remnant === "wd") {
      return {
        outerR: 7,
        innerR: 3.2,
        outerStroke: "#cfd8ff",
        innerFill: "#f5f5ff",
        innerStroke: "#cfd8ff",
      }
    }

    if (remnant === "ns") {
      return {
        outerR: 8,
        innerR: 3.8,
        outerStroke: "#9ec9ff",
        innerFill: "#e4f0ff",
        innerStroke: "#9ec9ff",
      }
    }
    if (remnant === "bh") {
      return {
        outerR: 8.5,
        innerR: 4.2,
        outerStroke: "#bb86fc",
        innerFill: "#050814",
        innerStroke: "#bb86fc",
      }
    }
    return {
      outerR: 7,
      innerR: 3.5,
      outerStroke: "var(--hr-current-ring)",
      innerFill: "var(--hr-current-fill)",
      innerStroke: "var(--hr-current-ring)",
    }
  })()

  // --- fade-out opacity for the current marker (BH only) ---
  let markerOpacity = 1
  if (remnant === "bh" && typeof fracTotal === "number") {
    const fadeStart = 0.97  // start fading at 97% of lifetime
    const fadeEnd = 1.0
    const f = Math.min(
      Math.max((fracTotal - fadeStart) / (fadeEnd - fadeStart), 0),
      1,
    )
    markerOpacity = 1 - f
  }

  if (hasFinished && remnant === "bh") {
    markerOpacity = 0
  }

  return (
    <div className="hr-diagram-wrapper">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", margin: "0 auto" }}  // no 100% scaling
      >
        {/* Plot clipping region so lines/points never leak */}
        <defs>
          <clipPath id="hr-plot-clip">
            <rect
              x={paddingLeft + xOffset}
              y={paddingTop}
              width={plotWidth}
              height={plotHeight}
              rx={4}
              ry={4}
            />
          </clipPath>
        </defs>

        {/* Grid + axes */}
        {/* Horizontal (L) grid + labels */}
        {L_TICKS.map(L => {
          const { y } = mapPoint({ logT: T_MIN, logL: L })
          return (
            <g key={`L-${L}`}>
              <line
                x1={paddingLeft + xOffset}
                x2={paddingLeft + plotWidth + xOffset}
                y1={y}
                y2={y}
                stroke="var(--hr-grid)"
                strokeWidth={1.0}
              />
              <text
                x={paddingLeft - 8 + xOffset}
                y={y + 4}
                textAnchor="end"
                fontSize={12}
                fill="var(--hr-axis-text)"
              >
                {L.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* Vertical (T) grid + labels */}
        {T_TICKS.map(T => {
          const { x } = mapPoint({ logT: T, logL: L_MIN })
          return (
            <g key={`T-${T}`}>
              <line
                x1={x}
                x2={x}
                y1={paddingTop}
                y2={paddingTop + plotHeight}
                stroke="var(--hr-grid)"
                strokeWidth={1.0}
              />
              <text
                x={x}
                y={paddingTop + plotHeight + 14}
                textAnchor="middle"
                fontSize={12}
                fill="var(--hr-axis-text)"
              >
                {T.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* Axis labels */}
        <text
          x={paddingLeft - 40 + xOffset}
          y={paddingTop + plotHeight / 2}
          textAnchor="middle"
          fontSize={14}
          fontWeight="bold"
          fill="var(--hr-axis-text)"
          transform={`rotate(-90 ${paddingLeft - 40 + xOffset} ${
            paddingTop + plotHeight / 2
          })`}
        >
          log L / L☉
        </text>

        <text
          x={paddingLeft + plotWidth / 2 + xOffset}
          y={paddingTop + plotHeight + 37}
          textAnchor="middle"
          fontSize={14}
          fontWeight="bold"
          fill="var(--hr-axis-text)"
        >
          log T (K)
        </text>

        {/* Everything inside the plot area */}
        <g clipPath="url(#hr-plot-clip)">
          {/* Main sequence cloud as dots */}
          {mainSequenceCloud.map((pt, idx) => {
            const { x, y } = mapPoint(pt)
            return (
              <circle
                key={`ms-${idx}`}
                cx={x}
                cy={y}
                r={2.4}
                fill="var(--hr-main-seq)"
                opacity={0.95}
              />
            )
          })}

          {/* Solid evolution track */}
          {solidTrackPath && (
            <polyline
              points={solidTrackPath}
              fill="none"
              stroke="var(--hr-track)"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Collapse hop – dashed polyline */}
          {collapseTrackPath && (
            <polyline
              points={collapseTrackPath}
              fill="none"
              stroke="var(--hr-track)"
              strokeWidth={1.8}
              strokeDasharray="6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current star point */}
          {currentPos && markerOpacity > 0 && (
            <>
              <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r={markerStyle.outerR}
                fill="rgba(0,0,0,0)" // transparent, glow handled by stroke
                stroke={markerStyle.outerStroke}
                strokeWidth={2}
                opacity={markerOpacity}
              />
              <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r={markerStyle.innerR}
                fill={markerStyle.innerFill}
                stroke={markerStyle.innerStroke}
                strokeWidth={1}
                opacity={markerOpacity}
              />
            </>
          )}
        </g>





        {/* Legend – right side, stacked vertically */}
        <g transform={`translate(${legendX}, ${legendY})`}>
          {/* Main sequence – mini cloud sample */}
          <g>
            {Array.from({ length: 18 }).map((_, i) => {
              const u = i / 17
              const baseX = u * 44

              // tiny jitter so it looks like a little cloud
              const jx = (pseudoRandom(1000 + i, 99) - 0.5) * 8.0
              const jy = (pseudoRandom(2000 + i, 99) - 0.5) * 8.0

              return (
                <circle
                  key={`ms-leg-${i}`}
                  cx={baseX + jx}
                  cy={jy}
                  r={1.8}
                  fill="var(--hr-main-seq)"
                />
              )
            })}

            <text
              x={-5}
              y={30}
              fontSize={14}
              fill="var(--hr-legend-text)"
              textAnchor="start"
            >
              Main sequence
            </text>
          </g>

          {/* Current star / remnant */}
          <g transform="translate(0, 80)">
            <circle
              cx={12}
              cy={0}
              r={legendMarkerStyle.outerR}
              fill="rgba(0,0,0,0)"
              stroke={legendMarkerStyle.outerStroke}
              strokeWidth={2}
            />
            <circle
              cx={12}
              cy={0}
              r={legendMarkerStyle.innerR}
              fill={legendMarkerStyle.innerFill}
              stroke={legendMarkerStyle.innerStroke}
              strokeWidth={1}
            />
            <text
              x={-5}
              y={30}
              fontSize={14}
              fill="var(--hr-legend-text)"
              textAnchor="start"
            >
              {legendLabel}
            </text>
          </g>





        </g>
      </svg>
    </div>
  )
}
