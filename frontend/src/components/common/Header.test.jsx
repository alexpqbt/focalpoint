import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Header from './Header'

describe('Header', () => {
  it('shows the logo', () => {
    render(<Header />)
    expect(screen.getByRole('img', { name: 'Logo' })).toBeInTheDocument()
  })

  it('shows standby mode by default', () => {
    render(<Header />)
    expect(screen.getByText('Mode: Standby')).toBeInTheDocument()
  })

  it('shows standby mode on the splash screen', () => {
    render(<Header currentScreen="splash" />)
    expect(screen.getByText('Mode: Standby')).toBeInTheDocument()
  })

  it('shows the live-session status on the dashboard', () => {
    render(<Header currentScreen="dashboard" />)
    expect(screen.getByText('Mode: Live Session Active')).toBeInTheDocument()
    expect(screen.queryByText('Mode: Standby')).not.toBeInTheDocument()
  })

  it('falls back to standby for an unknown screen', () => {
    render(<Header currentScreen="something-else" />)
    expect(screen.getByText('Mode: Standby')).toBeInTheDocument()
  })
})