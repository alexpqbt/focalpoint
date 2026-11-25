import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard'

const captured = vi.hoisted(() => ({ sidebar: null, broadcast: null }))

vi.mock('./Sidebar', () => ({
  default: (props) => {
    captured.sidebar = props
    return (
      <div data-testid="sidebar">
        <button onClick={props.onEndSession}>end</button>
        <button onClick={() => props.onOpenModal('viewers')}>open-viewers</button>
        <button onClick={() => props.onExport('csv')}>export-csv</button>
      </div>
    )
  },
}))

vi.mock('./BroadcastScreen', () => ({
  default: (props) => {
    captured.broadcast = props
    return <div data-testid="broadcast" />
  },
}))

describe('Dashboard (Start / Active Broadcast layout)', () => {
  beforeEach(() => {
    captured.sidebar = null
    captured.broadcast = null
  })

  it('renders the Sidebar and the BroadcastScreen', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('broadcast')).toBeInTheDocument()
  })

  it('forwards viewers, messages, isSharing and callbacks to Sidebar', () => {
    const viewers = [{ identity: 'a', name: 'Ana', attributes: {} }]
    const messages = [{ name: 'Ana', text: 'hi' }]
    const onEndSession = vi.fn()
    const onOpenModal = vi.fn()
    const onExport = vi.fn()

    render(
      <Dashboard
        viewers={viewers}
        messages={messages}
        isSharing
        onEndSession={onEndSession}
        onOpenModal={onOpenModal}
        onExport={onExport}
      />,
    )

    expect(captured.sidebar.viewers).toBe(viewers)
    expect(captured.sidebar.messages).toBe(messages)
    expect(captured.sidebar.isSharing).toBe(true)
    expect(captured.sidebar.onEndSession).toBe(onEndSession)
    expect(captured.sidebar.onOpenModal).toBe(onOpenModal)
    expect(captured.sidebar.onExport).toBe(onExport)
  })

  it('passes the preview ref to BroadcastScreen', () => {
    const previewRef = React.createRef()
    render(<Dashboard previewRef={previewRef} />)
    expect(captured.broadcast.previewRef).toBe(previewRef)
  })

  it('uses safe defaults when no props are supplied', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    expect(captured.sidebar.viewers).toEqual([])
    expect(captured.sidebar.messages).toEqual([])
    expect(captured.sidebar.isSharing).toBe(false)

    // default no-op callbacks must not throw
    await user.click(screen.getByText('end'))
    await user.click(screen.getByText('open-viewers'))
    await user.click(screen.getByText('export-csv'))
  })

  it('invokes the supplied callbacks with the expected arguments', async () => {
    const user = userEvent.setup()
    const onEndSession = vi.fn()
    const onOpenModal = vi.fn()
    const onExport = vi.fn()
    render(
      <Dashboard onEndSession={onEndSession} onOpenModal={onOpenModal} onExport={onExport} />,
    )

    await user.click(screen.getByText('end'))
    await user.click(screen.getByText('open-viewers'))
    await user.click(screen.getByText('export-csv'))

    expect(onEndSession).toHaveBeenCalledTimes(1)
    expect(onOpenModal).toHaveBeenCalledWith('viewers')
    expect(onExport).toHaveBeenCalledWith('csv')
  })
})