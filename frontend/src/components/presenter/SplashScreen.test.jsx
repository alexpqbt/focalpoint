import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SplashScreen from './SplashScreen'

const captured = vi.hoisted(() => ({ props: null, handleAddRoom: null }))

vi.mock('./Rooms', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef(function RoomsStub(props, ref) {
      captured.props = props
      React.useImperativeHandle(ref, () => ({ handleAddRoom: captured.handleAddRoom }))
      return <button onClick={() => props.onShareScreen('selected-room')}>room-share</button>
    }),
  }
})

describe('SplashScreen (End Broadcast / standby screen)', () => {
  beforeEach(() => {
    captured.props = null
    captured.handleAddRoom = vi.fn()
  })

  // CASE-008
  describe('CASE-008: screen contents', () => {
    it('shows the logo, tagline and the Share Screen button', () => {
      render(<SplashScreen />)

      expect(screen.getByRole('img', { name: 'Logo' })).toBeInTheDocument()
      expect(screen.getByText('Broadcast your screen, Local and Offline.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Share Screen/ })).toBeInTheDocument()
    })

    it('embeds the Rooms panel (saved rooms and logs)', () => {
      render(<SplashScreen />)
      expect(screen.getByText('room-share')).toBeInTheDocument()
    })
  })

  describe('Share Screen button', () => {
    it('calls onShareScreen when provided', async () => {
      const user = userEvent.setup()
      const onShareScreen = vi.fn()
      render(<SplashScreen onShareScreen={onShareScreen} />)

      await user.click(screen.getByRole('button', { name: /Share Screen/ }))

      expect(onShareScreen).toHaveBeenCalledTimes(1)
      expect(captured.handleAddRoom).not.toHaveBeenCalled()
    })

    it('opens the Add Room flow through the internal Rooms ref when onShareScreen is absent', async () => {
      const user = userEvent.setup()
      render(<SplashScreen />)

      await user.click(screen.getByRole('button', { name: /Share Screen/ }))

      expect(captured.handleAddRoom).toHaveBeenCalledTimes(1)
    })

    it('uses an externally supplied roomsRef', async () => {
      const user = userEvent.setup()
      const roomsRef = React.createRef()
      render(<SplashScreen roomsRef={roomsRef} />)

      expect(roomsRef.current).not.toBeNull()
      await user.click(screen.getByRole('button', { name: /Share Screen/ }))

      expect(captured.handleAddRoom).toHaveBeenCalledTimes(1)
    })
  })

  describe('starting a session from a saved room', () => {
    it('passes onStartSharing to Rooms as onShareScreen', async () => {
      const user = userEvent.setup()
      const onStartSharing = vi.fn()
      render(<SplashScreen onStartSharing={onStartSharing} />)

      await user.click(screen.getByText('room-share'))

      expect(onStartSharing).toHaveBeenCalledWith('selected-room')
    })

    it('does not throw when no onStartSharing is supplied', async () => {
      const user = userEvent.setup()
      render(<SplashScreen />)
      await user.click(screen.getByText('room-share'))
    })
  })
})