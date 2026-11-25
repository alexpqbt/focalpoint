import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import ChatModal from './ChatModal'

const MESSAGES = [
  { name: 'Ana Cruz', text: 'Can you repeat that?' },
  { name: 'Ben Diaz', text: 'Slide 3 is not loading for me' },
  { name: 'Ana Cruz', text: 'Never mind, got it' },
]

afterEach(cleanup)

function setup(props = {}) {
  const onClose = vi.fn()
  const utils = render(<ChatModal onClose={onClose} {...props} />)
  return { ...utils, onClose }
}

// ---------------------------------------------------------------------------
describe('CASE-039: Chat Preview with received messages', () => {
  it('shows a "Chat" pop-up', () => {
    setup({ messages: MESSAGES })

    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument()
  })

  it('shows the viewer name and the message for every message received', () => {
    setup({ messages: MESSAGES })

    expect(screen.getAllByText('Ana Cruz')).toHaveLength(2)
    expect(screen.getByText('Ben Diaz')).toBeInTheDocument()
    for (const m of MESSAGES) {
      expect(screen.getByText(m.text)).toBeInTheDocument()
    }
  })

  it('pairs each name with its own message, in the order received', () => {
    const { container } = setup({ messages: MESSAGES })

    const rows = container.querySelectorAll('div.border-b.pb-2')
    expect(rows).toHaveLength(3)
    MESSAGES.forEach((m, i) => {
      expect(within(rows[i]).getByText(m.name)).toBeInTheDocument()
      expect(within(rows[i]).getByText(m.text)).toBeInTheDocument()
    })
  })

  it('lists more than two messages (the sidebar preview only shows two)', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `Viewer ${i}`, text: `Message ${i}` }))
    setup({ messages: many })

    expect(screen.getByText('Message 0')).toBeInTheDocument()
    expect(screen.getByText('Message 11')).toBeInTheDocument()
  })

  it('does not show the empty-state text when there are messages', () => {
    setup({ messages: MESSAGES })

    expect(screen.queryByText('No messages yet.')).not.toBeInTheDocument()
  })

  it('shows message text as plain text, not as markup', () => {
    const { container } = setup({ messages: [{ name: 'Eve', text: '<b>bold</b><img src=x>' }] })

    expect(screen.getByText('<b>bold</b><img src=x>')).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows new messages when the parent passes an updated list', () => {
    const { rerender, onClose } = setup({ messages: [MESSAGES[0]] })
    expect(screen.queryByText(MESSAGES[1].text)).not.toBeInTheDocument()

    rerender(<ChatModal messages={MESSAGES.slice(0, 2)} onClose={onClose} />)

    expect(screen.getByText(MESSAGES[1].text)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('CASE-040: Chat Preview with no messages', () => {
  it('shows "No messages yet."', () => {
    setup({ messages: [] })

    expect(screen.getByText('No messages yet.')).toBeInTheDocument()
  })

  it('shows "No messages yet." when no messages prop is given', () => {
    setup()

    expect(screen.getByText('No messages yet.')).toBeInTheDocument()
  })

  it('still shows the Chat title and a close button', () => {
    setup({ messages: [] })

    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('closing the Chat pop-up', () => {
  it('closes from the X button', () => {
    const { onClose } = setup({ messages: MESSAGES })

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked', () => {
    const { onClose, container } = setup({ messages: MESSAGES })

    fireEvent.click(container.firstChild)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open when the card or a message is clicked', () => {
    const { onClose } = setup({ messages: MESSAGES })

    fireEvent.click(screen.getByRole('heading', { name: 'Chat' }))
    fireEvent.click(screen.getByText(MESSAGES[1].text))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not throw when closed without an onClose handler', () => {
    render(<ChatModal messages={[]} />)

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))).not.toThrow()
  })
})