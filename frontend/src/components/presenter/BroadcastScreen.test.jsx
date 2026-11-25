import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import BroadcastScreen from './BroadcastScreen'

describe('BroadcastScreen (CASE-004: live preview)', () => {
  it('renders a video element for the live preview', () => {
    const { container } = render(<BroadcastScreen />)
    expect(container.querySelector('video')).toBeInTheDocument()
  })

  it('configures the preview to autoplay, muted and inline', () => {
    const { container } = render(<BroadcastScreen />)
    const video = container.querySelector('video')

    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('playsinline')
    expect(video.muted).toBe(true)
  })

  it('attaches the supplied ref to the video element', () => {
    const previewRef = React.createRef()
    const { container } = render(<BroadcastScreen previewRef={previewRef} />)

    expect(previewRef.current).toBe(container.querySelector('video'))
  })

  it('allows a stream to be assigned through the ref', () => {
    const previewRef = React.createRef()
    render(<BroadcastScreen previewRef={previewRef} />)
    const stream = { id: 'fake-stream' }

    previewRef.current.srcObject = stream

    expect(previewRef.current.srcObject).toBe(stream)
  })

  it('renders without a ref', () => {
    expect(() => render(<BroadcastScreen />)).not.toThrow()
  })
})