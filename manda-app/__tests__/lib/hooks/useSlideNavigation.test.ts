/**
 * useSlideNavigation Hook Tests
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #5 - Slide navigation functionality
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSlideNavigation } from '@/lib/hooks/useSlideNavigation'
import { Slide } from '@/lib/types/cim'

const createMockSlide = (id: string): Slide => ({
  id,
  section_id: 'section-1',
  title: `Slide ${id}`,
  components: [],
  visual_concept: null,
  status: 'draft',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

describe('useSlideNavigation', () => {
  const mockSlides = [
    createMockSlide('slide-1'),
    createMockSlide('slide-2'),
    createMockSlide('slide-3'),
  ]

  describe('initialization', () => {
    it('should return current slide at given index', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 0,
          onIndexChange,
        })
      )

      expect(result.current.currentSlide?.id).toBe('slide-1')
      expect(result.current.currentIndex).toBe(0)
    })

    it('should return correct total slides count', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 0,
          onIndexChange,
        })
      )

      expect(result.current.totalSlides).toBe(3)
    })

    it('should return null currentSlide for empty slides array', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: [],
          currentIndex: 0,
          onIndexChange,
        })
      )

      expect(result.current.currentSlide).toBeNull()
      expect(result.current.totalSlides).toBe(0)
    })
  })

  describe('navigation state', () => {
    it('should disable previous on first slide', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 0,
          onIndexChange,
        })
      )

      expect(result.current.canGoPrevious).toBe(false)
      expect(result.current.canGoNext).toBe(true)
    })

    it('should disable next on last slide', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 2,
          onIndexChange,
        })
      )

      expect(result.current.canGoPrevious).toBe(true)
      expect(result.current.canGoNext).toBe(false)
    })

    it('should enable both on middle slide', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 1,
          onIndexChange,
        })
      )

      expect(result.current.canGoPrevious).toBe(true)
      expect(result.current.canGoNext).toBe(true)
    })
  })

  describe('navigation functions', () => {
    it('should call onIndexChange with next index on goToNext', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 0,
          onIndexChange,
        })
      )

      act(() => {
        result.current.goToNext()
      })

      expect(onIndexChange).toHaveBeenCalledWith(1)
    })

    it('should call onIndexChange with previous index on goToPrevious', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 2,
          onIndexChange,
        })
      )

      act(() => {
        result.current.goToPrevious()
      })

      expect(onIndexChange).toHaveBeenCalledWith(1)
    })

    it('should call onIndexChange with specific index on goToSlide', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 0,
          onIndexChange,
        })
      )

      act(() => {
        result.current.goToSlide(2)
      })

      expect(onIndexChange).toHaveBeenCalledWith(2)
    })

    it('should not call onIndexChange for goToNext when at last slide', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 2,
          onIndexChange,
        })
      )

      act(() => {
        result.current.goToNext()
      })

      expect(onIndexChange).not.toHaveBeenCalled()
    })

    it('should not call onIndexChange for goToPrevious when at first slide', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 0,
          onIndexChange,
        })
      )

      act(() => {
        result.current.goToPrevious()
      })

      expect(onIndexChange).not.toHaveBeenCalled()
    })

    it('should not call onIndexChange for invalid goToSlide index', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 0,
          onIndexChange,
        })
      )

      act(() => {
        result.current.goToSlide(-1)
      })

      expect(onIndexChange).not.toHaveBeenCalled()

      act(() => {
        result.current.goToSlide(10)
      })

      expect(onIndexChange).not.toHaveBeenCalled()
    })
  })

  describe('bounds checking', () => {
    it('should clamp current index to valid range', () => {
      const onIndexChange = vi.fn()
      const { result } = renderHook(() =>
        useSlideNavigation({
          slides: mockSlides,
          currentIndex: 10, // Out of bounds
          onIndexChange,
        })
      )

      // Should clamp to last valid index
      expect(result.current.currentSlide?.id).toBe('slide-3')
    })
  })
})
