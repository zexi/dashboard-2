/**
 * Minimal PCA (2 components) for visualizing embedding vectors.
 * Power iteration on the covariance matrix — good enough for a playground
 * scatter plot and dependency free.
 */

const MAX_ITER = 120
const TOLERANCE = 1e-10

function meanVector (vectors) {
  const dim = vectors[0].length
  const mean = new Array(dim).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) mean[i] += v[i]
  }
  return mean.map(x => x / vectors.length)
}

function center (vectors, mean) {
  return vectors.map(v => v.map((x, i) => x - mean[i]))
}

/** Covariance-vector product: (X^T X / n) * v, where rows of X are centered. */
function covarianceTimes (centered, v) {
  const n = centered.length
  const dim = v.length
  // X v
  const xv = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = 0
    const row = centered[i]
    for (let j = 0; j < dim; j++) s += row[j] * v[j]
    xv[i] = s
  }
  // X^T (X v)
  const out = new Array(dim).fill(0)
  for (let i = 0; i < n; i++) {
    const row = centered[i]
    const s = xv[i]
    for (let j = 0; j < dim; j++) out[j] += row[j] * s
  }
  return out.map(x => x / n)
}

function norm (v) {
  return Math.sqrt(v.reduce((acc, x) => acc + x * x, 0))
}

function normalize (v) {
  const n = norm(v)
  if (!n) return null
  return v.map(x => x / n)
}

function randomUnit (dim, seed) {
  // Deterministic seed so repeated runs look identical.
  const out = new Array(dim)
  let s = seed
  for (let i = 0; i < dim; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    out[i] = (s / 0x7fffffff) - 0.5
  }
  return normalize(out)
}

function powerIteration (centered, seed, deflate) {
  let v = randomUnit(centered[0].length, seed)
  if (!v) return null
  let lambda = 0
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let next = covarianceTimes(centered, v)
    if (deflate) next = deflate(next)
    const nextNorm = norm(next)
    if (!nextNorm) break
    const unit = next.map(x => x / nextNorm)
    const delta = unit.reduce((acc, x, i) => acc + Math.abs(x - v[i]), 0)
    v = unit
    lambda = nextNorm
    if (delta < TOLERANCE) break
  }
  return { vector: v, lambda }
}

/**
 * Project vectors onto their two dominant principal components.
 * @param {number[][]} vectors
 * @returns {{ x: number, y: number, explained: number[] }[]}
 */
export function computePca2D (vectors) {
  const list = (vectors || []).filter(v => Array.isArray(v) && v.length > 0)
  if (!list.length) return []
  const dim = list[0].length
  // Malformed / mixed-length rows cannot be projected.
  if (list.some(v => v.length !== dim)) {
    return list.map(() => ({ x: 0, y: 0, explained: [0, 0] }))
  }
  if (list.length === 1 || dim === 1) {
    return list.map(() => ({ x: 0, y: 0, explained: [0, 0] }))
  }
  const mean = meanVector(list)
  const centered = center(list, mean)

  const first = powerIteration(centered, 1)
  if (!first) return list.map(() => ({ x: 0, y: 0, explained: [0, 0] }))
  const pc1 = first.vector
  const second = powerIteration(centered, 7, (v) => {
    // Deflate pc1 out of the candidate direction.
    const dot = v.reduce((acc, x, i) => acc + x * pc1[i], 0)
    return v.map((x, i) => x - dot * pc1[i])
  })
  const pc2 = second ? second.vector : new Array(dim).fill(0)

  const totalVar = first.lambda + (second ? second.lambda : 0)
  const explained = totalVar > 0
    ? [first.lambda / totalVar, (second ? second.lambda : 0) / totalVar]
    : [0, 0]

  return centered.map(row => {
    let x = 0
    let y = 0
    for (let i = 0; i < dim; i++) {
      x += row[i] * pc1[i]
      y += row[i] * pc2[i]
    }
    return { x, y, explained }
  })
}

/** Cosine distance helper used by the playground heatmap tooltip. */
export function cosineSimilarity (a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
