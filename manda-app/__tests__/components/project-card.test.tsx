import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectCard } from '@/components/projects/project-card'
import type { Deal } from '@/lib/supabase/types'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockDeal: Deal = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Acquisition',
  user_id: 'user-123',
  status: 'active',
  deal_type: 'tech-ma',
  company_name: 'Test Company Inc',
  industry: 'Technology',
  irl_template: null,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-20T15:30:00Z',
}

describe('ProjectCard', () => {
  it('renders project name', () => {
    render(<ProjectCard deal={mockDeal} />)
    expect(screen.getByText('Test Acquisition')).toBeInTheDocument()
  })

  it('renders company name when provided', () => {
    render(<ProjectCard deal={mockDeal} />)
    expect(screen.getByText('Test Company Inc')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    render(<ProjectCard deal={mockDeal} />)
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('renders deal type badge', () => {
    render(<ProjectCard deal={mockDeal} />)
    expect(screen.getByText('Tech M&A')).toBeInTheDocument()
  })

  it('renders industry badge when provided', () => {
    render(<ProjectCard deal={mockDeal} />)
    expect(screen.getByText('Technology')).toBeInTheDocument()
  })

  it('renders progress section', () => {
    render(<ProjectCard deal={mockDeal} />)
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('links to project dashboard', () => {
    render(<ProjectCard deal={mockDeal} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/projects/123e4567-e89b-12d3-a456-426614174000/dashboard')
  })

  it('handles missing optional fields gracefully', () => {
    const minimalDeal: Deal = {
      id: 'minimal-id',
      name: 'Minimal Deal',
      user_id: 'user-123',
      status: 'active',
      deal_type: null,
      company_name: null,
      industry: null,
      irl_template: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-20T15:30:00Z',
    }

    render(<ProjectCard deal={minimalDeal} />)
    expect(screen.getByText('Minimal Deal')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument() // Default deal type
  })

  it('handles on-hold status', () => {
    const onHoldDeal: Deal = {
      ...mockDeal,
      status: 'on-hold',
    }

    render(<ProjectCard deal={onHoldDeal} />)
    expect(screen.getByText('on hold')).toBeInTheDocument()
  })
})
