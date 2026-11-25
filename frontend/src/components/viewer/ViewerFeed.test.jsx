import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ViewerFeed from './ViewerFeed'

describe('ViewerFeed (CASE-048 / CASE-049: broadcast video)', () => {
  it('renders a video element', () => {
    const { container } = render(<ViewerFeed />)
    expect(container.querySelector('video')).toBeInTheDocument()
  })

  it('autoplays inline so the stream starts without a tap', () => {
    const { container } = render(<ViewerFeed />)
    const video = container.querySelector('video')

    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('playsinline')
  })

  it('attaches the supplied ref to the video element', () => {
    const videoRef = React.createRef()
    const { container } = render(<ViewerFeed videoRef={videoRef} />)

    expect(videoRef.current).toBe(container.querySelector('video'))
  })

  it('shows nothing (no stream) until a stream is assigned through the ref', () => {
    const videoRef = React.createRef()
    render(<ViewerFeed videoRef={videoRef} />)

    expect(videoRef.current.srcObject == null).toBe(true)
  })

  it('renders without a ref', () => {
    expect(() => render(<ViewerFeed />)).not.toThrow()
  })
})