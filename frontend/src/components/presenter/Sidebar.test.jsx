import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from './Sidebar'

const msgs = (n) => Array.from({ length: n }, (_, i) => ({ name: `User ${i + 1}`, text: `Message ${i + 1}` }))
const viewersOf = (n) =>
  Array.from({ length: n }, (_, i) => ({ identity: `id${i}`, name: `Viewer ${i}`, attributes: {} }))

describe('Sidebar', () => {
  // CASE-004: Active Broadcast screen elements
  describe('CASE-004: Active Broadcast elements', () => {
    it('shows the End Session button', () => {
      render(<Sidebar />)
      expect(screen.getByRole('button', { name: /End Session/ })).toBeInTheDocument()
    })

    it('shows the QR code thumbnail with the expand hint', () => {
      render(<Sidebar />)
      expect(screen.getByText('Click to Expand')).toBeInTheDocument()
      expect(screen.getByText('[QR CODE]')).toBeInTheDocument()
    })

    it('shows a viewer count of 0 when no viewers are connected', () => {
      render(<Sidebar />)
      expect(screen.getByText('Viewers: 0')).toBeInTheDocument()
    })
  })

  // CASE-005 / CASE-006: viewer count follows the viewers prop
  describe('viewer count', () => {
    it('CASE-005: increases when viewers join', () => {
      const { rerender } = render(<Sidebar viewers={[]} />)
      expect(screen.getByText('Viewers: 0')).toBeInTheDocument()

      rerender(<Sidebar viewers={viewersOf(1)} />)
      expect(screen.getByText('Viewers: 1')).toBeInTheDocument()

      rerender(<Sidebar viewers={viewersOf(3)} />)
      expect(screen.getByText('Viewers: 3')).toBeInTheDocument()
    })

    it('CASE-006: decreases when viewers leave', () => {
      const { rerender } = render(<Sidebar viewers={viewersOf(3)} />)
      expect(screen.getByText('Viewers: 3')).toBeInTheDocument()

      rerender(<Sidebar viewers={viewersOf(1)} />)
      expect(screen.getByText('Viewers: 1')).toBeInTheDocument()

      rerender(<Sidebar viewers={[]} />)
      expect(screen.getByText('Viewers: 0')).toBeInTheDocument()
    })
  })

  // CASE-007 (Sidebar part): the button triggers the handler
  describe('CASE-007: End Session button', () => {
    it('calls onEndSession once per click', async () => {
      const user = userEvent.setup()
      const onEndSession = vi.fn()
      render(<Sidebar onEndSession={onEndSession} />)

      await user.click(screen.getByRole('button', { name: /End Session/ }))

      expect(onEndSession).toHaveBeenCalledTimes(1)
    })

    it('does not throw with the default no-op handler', async () => {
      const user = userEvent.setup()
      render(<Sidebar />)
      await user.click(screen.getByRole('button', { name: /End Session/ }))
    })
  })

  // Modal triggers (also used by CASE-035, CASE-036, CASE-039)
  describe('modal triggers', () => {
    it("opens the 'qr' modal from the QR thumbnail", async () => {
      const user = userEvent.setup()
      const onOpenModal = vi.fn()
      render(<Sidebar onOpenModal={onOpenModal} />)

      await user.click(screen.getByText('[QR CODE]'))

      expect(onOpenModal).toHaveBeenCalledWith('qr')
    })

    it("opens the 'chat' modal from the Expand Chat button", async () => {
      const user = userEvent.setup()
      const onOpenModal = vi.fn()
      render(<Sidebar onOpenModal={onOpenModal} />)

      await user.click(screen.getByRole('button', { name: 'Expand Chat' }))

      expect(onOpenModal).toHaveBeenCalledWith('chat')
    })

    it("opens the 'viewers' modal from the viewer count", async () => {
      const user = userEvent.setup()
      const onOpenModal = vi.fn()
      render(<Sidebar onOpenModal={onOpenModal} viewers={viewersOf(2)} />)

      await user.click(screen.getByText('Viewers: 2'))

      expect(onOpenModal).toHaveBeenCalledWith('viewers')
    })
  })

  // Chat preview
  describe('chat preview', () => {
    it('shows no message entries when there are no messages', () => {
      render(<Sidebar messages={[]} />)
      expect(screen.queryByText(/^Message \d/)).not.toBeInTheDocument()
    })

    it('shows sender name and text for a message', () => {
      render(<Sidebar messages={[{ name: 'Ana', text: 'Please zoom in' }]} />)
      expect(screen.getByText('Ana')).toBeInTheDocument()
      expect(screen.getByText('Please zoom in')).toBeInTheDocument()
    })

    it('previews only the first two messages', () => {
      render(<Sidebar messages={msgs(4)} />)
      expect(screen.getByText('Message 1')).toBeInTheDocument()
      expect(screen.getByText('Message 2')).toBeInTheDocument()
      expect(screen.queryByText('Message 3')).not.toBeInTheDocument()
      expect(screen.queryByText('Message 4')).not.toBeInTheDocument()
    })
  })
})