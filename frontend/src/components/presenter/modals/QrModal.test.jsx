import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import QrModal from './QrModal'

const URL_TEXT = 'http://192.168.1.10:8080/view'

describe('QrModal', () => {
  let writeText

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // CASE-036
  describe('CASE-036: enlarged QR code', () => {
    it('renders a canvas for the QR code and attaches qrRef to it', () => {
      const qrRef = React.createRef()
      const { container } = render(<QrModal qrRef={qrRef} viewerURL={URL_TEXT} />)

      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      expect(qrRef.current).toBe(canvas)
    })
  })

  // CASE-037
  describe('CASE-037: session URL below the QR code', () => {
    it('displays the viewer URL', () => {
      render(<QrModal qrRef={React.createRef()} viewerURL={URL_TEXT} />)
      expect(screen.getByText(URL_TEXT)).toBeInTheDocument()
    })

    it('displays a waiting placeholder while the URL is empty', () => {
      render(<QrModal qrRef={React.createRef()} />)
      expect(screen.getByText('waiting…')).toBeInTheDocument()
    })
  })

  // CASE-038
  describe('CASE-038: Copy button', () => {
    it('copies the link and switches the label to "Copied"', () => {
      render(<QrModal qrRef={React.createRef()} viewerURL={URL_TEXT} />)

      fireEvent.click(screen.getByRole('button', { name: /Copy/ }))

      expect(writeText).toHaveBeenCalledWith(URL_TEXT)
      expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument()
    })

    it('reverts the label to "Copy" after 2 seconds', () => {
      vi.useFakeTimers()
      render(<QrModal qrRef={React.createRef()} viewerURL={URL_TEXT} />)

      fireEvent.click(screen.getByRole('button', { name: /Copy/ }))
      expect(screen.getByText('Copied')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1999)
      })
      expect(screen.getByText('Copied')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })

    it('does nothing when there is no URL yet', () => {
      render(<QrModal qrRef={React.createRef()} />)

      fireEvent.click(screen.getByRole('button', { name: /Copy/ }))

      expect(writeText).not.toHaveBeenCalled()
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })
  })

  // Closing
  describe('closing the modal', () => {
    it('closes from the X button', () => {
      const onClose = vi.fn()
      render(<QrModal qrRef={React.createRef()} viewerURL={URL_TEXT} onClose={onClose} />)

      fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes when the backdrop is clicked', () => {
      const onClose = vi.fn()
      const { container } = render(
        <QrModal qrRef={React.createRef()} viewerURL={URL_TEXT} onClose={onClose} />,
      )

      fireEvent.click(container.firstChild)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('stays open when the card content is clicked', () => {
      const onClose = vi.fn()
      render(<QrModal qrRef={React.createRef()} viewerURL={URL_TEXT} onClose={onClose} />)

      fireEvent.click(screen.getByText(URL_TEXT))

      expect(onClose).not.toHaveBeenCalled()
    })
  })
})