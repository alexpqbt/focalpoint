import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ViewerRoom from './ViewerRoom'

const chat = vi.hoisted(() => ({ props: null }))

// ViewerChat is covered separately (CASE-054 to CASE-058); here it is a stub.
vi.mock('./ViewerChat', () => ({
  default: (props) => {
    chat.props = props
    return (
      <section aria-label="chat">
        <h2>Message to Host</h2>
        <button onClick={props.onClose}>close-chat</button>
      </section>
    )
  },
}))

const controlsWrapper = () => screen.getByRole('button', { name: 'Chat' }).closest('.transition-opacity')
const isVisible = () => controlsWrapper().classList.contains('opacity-100')

describe('ViewerRoom', () => {
  beforeEach(() => {
    chat.props = null
  })

  describe('layout', () => {
    it('renders the video feed and the controls', () => {
      const videoRef = React.createRef()
      const { container } = render(<ViewerRoom videoRef={videoRef} />)

      expect(videoRef.current).toBe(container.querySelector('video'))
      expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
      expect(screen.getByTitle('Leave Room')).toBeInTheDocument()
    })

    it('renders without any props', () => {
      expect(() => render(<ViewerRoom />)).not.toThrow()
    })
  })

  // CASE-050
  describe('CASE-050: Chat button opens "Message to Host"', () => {
    it('does not show the chat popup while the chat is closed', () => {
      render(<ViewerRoom isChatOpen={false} />)
      expect(screen.queryByText('Message to Host')).not.toBeInTheDocument()
    })

    it('shows the "Message to Host" popup when the chat is open', () => {
      render(<ViewerRoom isChatOpen />)
      expect(screen.getByText('Message to Host')).toBeInTheDocument()
    })

    it('asks the parent to toggle the chat when Chat is clicked', () => {
      const onToggleChat = vi.fn()
      render(<ViewerRoom onToggleChat={onToggleChat} />)

      fireEvent.click(screen.getByRole('button', { name: 'Chat' }))

      expect(onToggleChat).toHaveBeenCalledTimes(1)
    })

    it('passes the viewer name, messages and handlers to the chat', () => {
      const messages = [{ name: 'Ana Cruz', text: 'hello' }]
      const onSendMessage = vi.fn()
      const onToggleChat = vi.fn()
      render(
        <ViewerRoom
          isChatOpen
          viewerName="Ana Cruz"
          messages={messages}
          onSendMessage={onSendMessage}
          onToggleChat={onToggleChat}
        />,
      )

      expect(chat.props.viewerName).toBe('Ana Cruz')
      expect(chat.props.messages).toBe(messages)
      expect(chat.props.onSendMessage).toBe(onSendMessage)
      expect(chat.props.onClose).toBe(onToggleChat)
    })

    it('closing the chat uses the same toggle handler', () => {
      const onToggleChat = vi.fn()
      render(<ViewerRoom isChatOpen onToggleChat={onToggleChat} />)

      fireEvent.click(screen.getByText('close-chat'))

      expect(onToggleChat).toHaveBeenCalledTimes(1)
    })
  })

  // CASE-051 (component part)
  describe('CASE-051: leave button', () => {
    it('calls onLeave', () => {
      const onLeave = vi.fn()
      render(<ViewerRoom onLeave={onLeave} />)

      fireEvent.click(screen.getByTitle('Leave Room'))

      expect(onLeave).toHaveBeenCalledTimes(1)
    })
  })

  describe('auto-hiding controls', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const advance = (ms) => act(() => vi.advanceTimersByTime(ms))

    it('shows the controls at first and hides them after 3 seconds of inactivity', () => {
      const { container } = render(<ViewerRoom />)
      expect(isVisible()).toBe(true)
      expect(container.querySelector('main')).toHaveClass('cursor-default')

      advance(2999)
      expect(isVisible()).toBe(true)

      advance(1)
      expect(isVisible()).toBe(false)
      expect(controlsWrapper()).toHaveClass('opacity-0', 'pointer-events-none')
      expect(container.querySelector('main')).toHaveClass('cursor-none')
    })

    it.each([
      ['mousemove', () => fireEvent.mouseMove(window)],
      ['touchstart', () => fireEvent.touchStart(window)],
      ['click', () => fireEvent.click(window)],
    ])('shows the controls again on %s and restarts the 3 second timer', (_name, trigger) => {
      render(<ViewerRoom />)
      advance(3000)
      expect(isVisible()).toBe(false)

      act(() => trigger())
      expect(isVisible()).toBe(true)

      advance(2999)
      expect(isVisible()).toBe(true)
      advance(1)
      expect(isVisible()).toBe(false)
    })

    it('keeps the controls visible while the chat is open', () => {
      const { rerender } = render(<ViewerRoom isChatOpen={false} />)
      advance(3000)
      expect(isVisible()).toBe(false)

      rerender(<ViewerRoom isChatOpen />)
      expect(isVisible()).toBe(true)
      advance(10000)
      expect(isVisible()).toBe(true)
    })

    it('starts hiding again once the chat is closed', () => {
      const { rerender } = render(<ViewerRoom isChatOpen />)
      advance(10000)
      expect(isVisible()).toBe(true)

      rerender(<ViewerRoom isChatOpen={false} />)
      advance(3000)
      expect(isVisible()).toBe(false)
    })

    it('removes its window listeners and timer on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const { unmount } = render(<ViewerRoom />)

      unmount()

      const removed = removeSpy.mock.calls.map(([event]) => event)
      expect(removed).toEqual(expect.arrayContaining(['mousemove', 'touchstart', 'click']))
      expect(() => advance(5000)).not.toThrow()
      removeSpy.mockRestore()
    })
  })
})