/**
 * IRL Progress Calculation Tests
 *
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 * ACs: 1, 2, 6 (Progress calculation functionality)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateIRLFulfilledProgress,
  calculateIRLProgressByCategory,
  calculateIRLFulfilledProgressWithCategories,
  IRLItem,
} from '@/lib/types/irl'

// Helper to create test IRL items
function createIRLItem(overrides: Partial<IRLItem> = {}): IRLItem {
  return {
    id: 'item-1',
    irlId: 'irl-1',
    category: 'Financial',
    itemName: 'Test Item',
    priority: 'medium',
    status: 'not_started',
    fulfilled: false,
    sortOrder: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('calculateIRLFulfilledProgress (AC6)', () => {
  it('should return zero progress for empty items array', () => {
    const result = calculateIRLFulfilledProgress([])

    expect(result).toEqual({
      total: 0,
      fulfilled: 0,
      unfulfilled: 0,
      percentComplete: 0,
    })
  })

  it('should calculate correct progress for all unfulfilled items', () => {
    const items = [
      createIRLItem({ id: '1', fulfilled: false }),
      createIRLItem({ id: '2', fulfilled: false }),
      createIRLItem({ id: '3', fulfilled: false }),
    ]

    const result = calculateIRLFulfilledProgress(items)

    expect(result).toEqual({
      total: 3,
      fulfilled: 0,
      unfulfilled: 3,
      percentComplete: 0,
    })
  })

  it('should calculate correct progress for all fulfilled items', () => {
    const items = [
      createIRLItem({ id: '1', fulfilled: true }),
      createIRLItem({ id: '2', fulfilled: true }),
      createIRLItem({ id: '3', fulfilled: true }),
    ]

    const result = calculateIRLFulfilledProgress(items)

    expect(result).toEqual({
      total: 3,
      fulfilled: 3,
      unfulfilled: 0,
      percentComplete: 100,
    })
  })

  it('should calculate correct progress for mixed fulfilled/unfulfilled items', () => {
    const items = [
      createIRLItem({ id: '1', fulfilled: true }),
      createIRLItem({ id: '2', fulfilled: false }),
      createIRLItem({ id: '3', fulfilled: true }),
      createIRLItem({ id: '4', fulfilled: false }),
    ]

    const result = calculateIRLFulfilledProgress(items)

    expect(result).toEqual({
      total: 4,
      fulfilled: 2,
      unfulfilled: 2,
      percentComplete: 50,
    })
  })

  it('should round percentage correctly (AC1)', () => {
    // 1/3 = 33.33% should round to 33%
    const items = [
      createIRLItem({ id: '1', fulfilled: true }),
      createIRLItem({ id: '2', fulfilled: false }),
      createIRLItem({ id: '3', fulfilled: false }),
    ]

    const result = calculateIRLFulfilledProgress(items)

    expect(result.percentComplete).toBe(33)
  })

  it('should only count items where fulfilled === true (AC6)', () => {
    // Status field should not affect progress
    const items = [
      createIRLItem({ id: '1', fulfilled: true, status: 'complete' }),
      createIRLItem({ id: '2', fulfilled: false, status: 'complete' }), // complete status but NOT fulfilled
      createIRLItem({ id: '3', fulfilled: true, status: 'not_started' }), // not started but IS fulfilled
    ]

    const result = calculateIRLFulfilledProgress(items)

    // Only 2 items have fulfilled: true
    expect(result.fulfilled).toBe(2)
    expect(result.unfulfilled).toBe(1)
  })
})

describe('calculateIRLProgressByCategory (AC2)', () => {
  it('should return empty array for empty items', () => {
    const result = calculateIRLProgressByCategory([])

    expect(result).toEqual([])
  })

  it('should calculate progress for single category', () => {
    const items = [
      createIRLItem({ id: '1', category: 'Financial', fulfilled: true }),
      createIRLItem({ id: '2', category: 'Financial', fulfilled: false }),
      createIRLItem({ id: '3', category: 'Financial', fulfilled: true }),
    ]

    const result = calculateIRLProgressByCategory(items)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      category: 'Financial',
      fulfilled: 2,
      total: 3,
      percentComplete: 67,
    })
  })

  it('should calculate independent progress for each category (AC2)', () => {
    const items = [
      // Financial: 2/3 fulfilled
      createIRLItem({ id: '1', category: 'Financial', fulfilled: true }),
      createIRLItem({ id: '2', category: 'Financial', fulfilled: false }),
      createIRLItem({ id: '3', category: 'Financial', fulfilled: true }),
      // Legal: 1/2 fulfilled
      createIRLItem({ id: '4', category: 'Legal', fulfilled: true }),
      createIRLItem({ id: '5', category: 'Legal', fulfilled: false }),
      // Technical: 0/1 fulfilled
      createIRLItem({ id: '6', category: 'Technical', fulfilled: false }),
    ]

    const result = calculateIRLProgressByCategory(items)

    expect(result).toHaveLength(3)

    const financial = result.find(p => p.category === 'Financial')
    expect(financial).toEqual({
      category: 'Financial',
      fulfilled: 2,
      total: 3,
      percentComplete: 67,
    })

    const legal = result.find(p => p.category === 'Legal')
    expect(legal).toEqual({
      category: 'Legal',
      fulfilled: 1,
      total: 2,
      percentComplete: 50,
    })

    const technical = result.find(p => p.category === 'Technical')
    expect(technical).toEqual({
      category: 'Technical',
      fulfilled: 0,
      total: 1,
      percentComplete: 0,
    })
  })

  it('should handle category with all items fulfilled', () => {
    const items = [
      createIRLItem({ id: '1', category: 'Complete', fulfilled: true }),
      createIRLItem({ id: '2', category: 'Complete', fulfilled: true }),
    ]

    const result = calculateIRLProgressByCategory(items)

    expect(result[0]).toEqual({
      category: 'Complete',
      fulfilled: 2,
      total: 2,
      percentComplete: 100,
    })
  })
})

describe('calculateIRLFulfilledProgressWithCategories', () => {
  it('should combine overall progress with category breakdown', () => {
    const items = [
      createIRLItem({ id: '1', category: 'Financial', fulfilled: true }),
      createIRLItem({ id: '2', category: 'Financial', fulfilled: false }),
      createIRLItem({ id: '3', category: 'Legal', fulfilled: true }),
    ]

    const result = calculateIRLFulfilledProgressWithCategories(items)

    // Overall progress
    expect(result.total).toBe(3)
    expect(result.fulfilled).toBe(2)
    expect(result.unfulfilled).toBe(1)
    expect(result.percentComplete).toBe(67)

    // Category breakdown
    expect(result.byCategory).toHaveLength(2)
  })

  it('should return empty byCategory for empty items', () => {
    const result = calculateIRLFulfilledProgressWithCategories([])

    expect(result.total).toBe(0)
    expect(result.byCategory).toEqual([])
  })
})
