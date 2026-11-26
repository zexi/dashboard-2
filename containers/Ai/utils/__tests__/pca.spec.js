import { computePca2D, cosineSimilarity } from '../pca'

describe('computePca2D', () => {
  it('separates clusters along the dominant axis', () => {
    // Two groups far apart on x, tight on y → pc1 ≈ x axis.
    const vectors = [
      [0, 0], [1, 0], [0, 1], [1, 1],
      [10, 0], [11, 0], [10, 1], [11, 1],
    ]
    const points = computePca2D(vectors)
    expect(points).toHaveLength(vectors.length)
    const first = points.slice(0, 4).map(p => p.x)
    const second = points.slice(4).map(p => p.x)
    expect(Math.max(...first)).toBeLessThan(Math.min(...second))
    expect(points[0].explained[0]).toBeGreaterThan(0.5)
  })

  it('returns a flat plane for a single vector', () => {
    const points = computePca2D([[0.1, 0.2, 0.3]])
    expect(points).toEqual([{ x: 0, y: 0, explained: [0, 0] }])
  })

  it('does not throw on degenerate or malformed input', () => {
    expect(computePca2D([])).toEqual([])
    expect(computePca2D(null)).toEqual([])
    // Identical vectors → zero variance, still returns one point per row.
    const same = computePca2D([[1, 1], [1, 1]])
    expect(same).toHaveLength(2)
    expect(Number.isFinite(same[0].x)).toBe(true)
    // Mixed dimensions degrade to the origin instead of throwing.
    const mixed = computePca2D([[1, 2], [1, 2, 3]])
    expect(mixed.every(p => p.x === 0 && p.y === 0)).toBe(true)
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical directions and 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('returns 0 for invalid input', () => {
    expect(cosineSimilarity([], [])).toBe(0)
    expect(cosineSimilarity([1], [1, 2])).toBe(0)
    expect(cosineSimilarity(null, [1])).toBe(0)
  })
})
