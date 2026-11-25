import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewerControls from './ViewerControls'

describe('ViewerControls', () => {
  it('shows the Chat button and the leave (X) button', () => {
    render(<ViewerControls />)

    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByTitle('Leave Room')).toBeInTheDocument()
  })

  // CASE-050
  it('CASE-050: calls onToggleChat when Chat is clicked', async () => {
    const user = userEvent.setup()
    const onToggleChat = vi.fn()
    const onLeave = vi.fn()
    render(<ViewerControls onToggleChat={onToggleChat} onLeave={onLeave} />)

    await user.click(screen.getByRole('button', { name: 'Chat' }))

    expect(onToggleChat).toHaveBeenCalledTimes(1)
    expect(onLeave).not.toHaveBeenCalled()
  })

  // CASE-051
  it('CASE-051: calls onLeave when the X button is clicked', async () => {
    const user = userEvent.setup()
    const onToggleChat = vi.fn()
    const onLeave = vi.fn()
    render(<ViewerControls onToggleChat={onToggleChat} onLeave={onLeave} />)

    await user.click(screen.getByTitle('Leave Room'))

    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onToggleChat).not.toHaveBeenCalled()
  })

  it('does not throw with the default no-op handlers', async () => {
    const user = userEvent.setup()
    render(<ViewerControls />)

    await user.click(screen.getByRole('button', { name: 'Chat' }))
    await user.click(screen.getByTitle('Leave Room'))
  })
})