import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewerChat from './ViewerChat'

const submitButton = (container) => container.querySelector('button[type="submit"]')
const input = () => screen.getByPlaceholderText('Send message...')

describe('ViewerChat (Message to Host)', () => {
  // CASE-054
  describe('CASE-054: viewer opens the Message to Host dialog', () => {
    it('shows a message box with the "Send message..." placeholder', () => {
      render(<ViewerChat />)

      expect(input()).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBe(input())
      expect(input()).toHaveValue('')
    })

    it('shows a submit button', () => {
      const { container } = render(<ViewerChat />)
      expect(submitButton(container)).toBeInTheDocument()
    })

    it('shows the viewer name in the header', () => {
      render(<ViewerChat viewerName="Ana Cruz" />)
      expect(screen.getByText('Messages (Ana Cruz)')).toBeInTheDocument()
    })

    it('tells the viewer that messages are only sent to the host when there are none', () => {
      render(<ViewerChat messages={[]} />)
      expect(screen.getByText(/ONLY/)).toBeInTheDocument()
      expect(screen.getByText(/sent to the host/)).toBeInTheDocument()
    })

    it('lists the messages sent so far instead of the hint', () => {
      const messages = [
        { name: 'Ana Cruz', text: 'Please zoom in' },
        { name: 'Ana Cruz', text: 'Thank you' },
      ]
      render(<ViewerChat viewerName="Ana Cruz" messages={messages} />)

      expect(screen.getByText('Please zoom in')).toBeInTheDocument()
      expect(screen.getByText('Thank you')).toBeInTheDocument()
      expect(screen.getAllByText('Ana Cruz:')).toHaveLength(2)
      expect(screen.queryByText(/ONLY/)).not.toBeInTheDocument()
    })

    // The appendix calls the dialog "Message to Host". The component has no such title;
    // its header reads "Messages (<name>)". Fix: render the text "Message to Host" in the
    // header (or change the appendix wording). This flips to failing once it is added;
    // then change it.fails to it.
    it.fails('shows the title "Message to Host"', () => {
      render(<ViewerChat viewerName="Ana Cruz" />)
      expect(screen.getByText('Message to Host')).toBeInTheDocument()
    })

    // The submit button contains only an icon and has no aria-label or title, so screen
    // readers (and this app's visually impaired users) get an unnamed button. Fix: add
    // aria-label="Submit" (or "Send message"). Change it.fails to it afterwards.
    it.fails('gives the submit button an accessible name', () => {
      render(<ViewerChat />)
      expect(screen.getByRole('button', { name: /submit|send/i })).toBeInTheDocument()
    })

    it('renders without any props', () => {
      expect(() => render(<ViewerChat />)).not.toThrow()
    })
  })

  // CASE-055
  describe('CASE-055: viewer enters a message and clicks Submit', () => {
    it('sends the typed message to the host', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()
      const { container } = render(<ViewerChat onSendMessage={onSendMessage} />)

      await user.type(input(), 'Please zoom in')
      await user.click(submitButton(container))

      expect(onSendMessage).toHaveBeenCalledTimes(1)
      expect(onSendMessage).toHaveBeenCalledWith('Please zoom in')
    })

    it('clears the message box after sending', async () => {
      const user = userEvent.setup()
      const { container } = render(<ViewerChat onSendMessage={vi.fn()} />)

      await user.type(input(), 'hello')
      await user.click(submitButton(container))

      expect(input()).toHaveValue('')
    })

    it('also sends when Enter is pressed', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()
      render(<ViewerChat onSendMessage={onSendMessage} />)

      await user.type(input(), 'hello{Enter}')

      expect(onSendMessage).toHaveBeenCalledWith('hello')
      expect(input()).toHaveValue('')
    })

    it('sends several messages one after another', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()
      render(<ViewerChat onSendMessage={onSendMessage} />)

      await user.type(input(), 'first{Enter}')
      await user.type(input(), 'second{Enter}')

      expect(onSendMessage.mock.calls).toEqual([['first'], ['second']])
    })

    it('sends the text as typed, including surrounding spaces', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()
      render(<ViewerChat onSendMessage={onSendMessage} />)

      await user.type(input(), '  hi  {Enter}')

      expect(onSendMessage).toHaveBeenCalledWith('  hi  ')
    })

    it('does not reload the page (the form submit is cancelled)', async () => {
      const user = userEvent.setup()
      const { container } = render(<ViewerChat onSendMessage={vi.fn()} />)
      await user.type(input(), 'hello')

      const event = new Event('submit', { bubbles: true, cancelable: true })
      container.querySelector('form').dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })
  })

  // CASE-056
  describe('CASE-056: viewer clicks Submit with an empty message', () => {
    it('does not send an empty message', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()
      const { container } = render(<ViewerChat onSendMessage={onSendMessage} />)

      await user.click(submitButton(container))

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('does not send when Enter is pressed on an empty box', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()
      render(<ViewerChat onSendMessage={onSendMessage} />)

      await user.type(input(), '{Enter}')

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('does not send a message made only of spaces and keeps what was typed', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()
      const { container } = render(<ViewerChat onSendMessage={onSendMessage} />)

      await user.type(input(), '   ')
      await user.click(submitButton(container))

      expect(onSendMessage).not.toHaveBeenCalled()
      expect(input()).toHaveValue('   ')
    })

    // The appendix expects the viewer to be prompted to enter a valid message. The component
    // returns silently: no alert, no aria-invalid, no `required` constraint. Fix: add the
    // `required` attribute to the input (browser prompt) or show an error with role="alert".
    // Change it.fails to it afterwards.
    it.fails('prompts the viewer to enter a valid message', async () => {
      const user = userEvent.setup()
      const { container } = render(<ViewerChat onSendMessage={vi.fn()} />)

      await user.click(submitButton(container))

      const prompted =
        screen.queryByRole('alert') !== null ||
        input().getAttribute('aria-invalid') === 'true' ||
        !input().checkValidity()
      expect(prompted).toBe(true)
    })
  })

  // CASE-057
  describe('CASE-057: viewer clicks the close (X) button', () => {
    it('calls onClose', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<ViewerChat onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'Close Chat' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not send what was typed when closing', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()
      render(<ViewerChat onSendMessage={onSendMessage} onClose={vi.fn()} />)
      await user.type(input(), 'draft')

      await user.click(screen.getByRole('button', { name: 'Close Chat' }))

      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('does not close when a message is submitted', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<ViewerChat onSendMessage={vi.fn()} onClose={onClose} />)

      await user.type(input(), 'hello{Enter}')

      expect(onClose).not.toHaveBeenCalled()
    })

    it('does not throw with the default handlers', async () => {
      const user = userEvent.setup()
      render(<ViewerChat />)

      await user.type(input(), 'hello{Enter}')
      await user.click(screen.getByRole('button', { name: 'Close Chat' }))
    })
  })
})