import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from './App'

vi.mock('./components/presenter/PresenterApp', async () => {
  const React = await import('react')
  return { default: () => React.createElement('div', null, 'PRESENTER SCREEN') }
})
vi.mock('./components/viewer/ViewerApp', async () => {
  const React = await import('react')
  return { default: () => React.createElement('div', null, 'VIEWER SCREEN') }
})

function visit(url) {
  window.history.pushState({}, '', url)
  return render(<App />)
}

afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
})

// The browser behaviour of scanning a QR code or typing a URL cannot run in jsdom.
// What the app controls is what the address resolves to, which is tested here.
describe('CASE-041 and CASE-042: the session URL opens the viewer page', () => {
  it('shows the viewer page at /view', () => {
    visit('/view')

    expect(screen.getByText('VIEWER SCREEN')).toBeInTheDocument()
    expect(screen.queryByText('PRESENTER SCREEN')).not.toBeInTheDocument()
  })

  it('shows the viewer page for the exact URL the QR code carries', () => {
    const qrTarget = new URL('http://192.168.1.10:8080/view')

    visit(qrTarget.pathname + qrTarget.search)

    expect(screen.getByText('VIEWER SCREEN')).toBeInTheDocument()
  })

  it('shows the viewer page when the URL is typed with a trailing slash', () => {
    visit('/view/')

    expect(screen.getByText('VIEWER SCREEN')).toBeInTheDocument()
  })

  it('shows the viewer page when the URL has a query string or hash', () => {
    visit('/view?source=qr#top')

    expect(screen.getByText('VIEWER SCREEN')).toBeInTheDocument()
  })

  it('keeps the viewer on /view and does not redirect', () => {
    visit('/view')

    expect(window.location.pathname).toBe('/view')
  })
})

describe('presenter route and fallback', () => {
  it('shows the presenter page at /', () => {
    visit('/')

    expect(screen.getByText('PRESENTER SCREEN')).toBeInTheDocument()
    expect(screen.queryByText('VIEWER SCREEN')).not.toBeInTheDocument()
  })

  it.each(['/unknown', '/viewer', '/view/extra', '/presenter/room'])(
    'redirects %s to the presenter page',
    (path) => {
      visit(path)

      expect(screen.getByText('PRESENTER SCREEN')).toBeInTheDocument()
      expect(window.location.pathname).toBe('/')
    },
  )
})