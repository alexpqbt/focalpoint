import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewerApp from './ViewerApp'

// ---------------------------------------------------------------------------
// Mocks. ViewerJoin is the REAL component; ViewerRoom is a stub (covered in Step 10).
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({ rooms: [], connectError: null, initGate: null }))

vi.mock('livekit-client', () => {
  class Room {
    constructor() {
      this.handlers = {}
      this.connect = vi.fn(async () => {
        if (h.connectError) throw h.connectError
      })
      this.disconnect = vi.fn().mockResolvedValue(undefined)
      this.on = vi.fn((evt, fn) => { this.handlers[evt] = fn })
      this.localParticipant = { sendText: vi.fn().mockResolvedValue(undefined) }
      h.rooms.push(this)
    }
  }
  return {
    Room,
    RoomEvent: {
      TrackSubscribed: 'trackSubscribed',
      TrackUnsubscribed: 'trackUnsubscribed',
      Disconnected: 'disconnected',
    },
  }
})
vi.mock('../config.js', () => ({
  initConfig: () => (h.initGate ? h.initGate.promise : Promise.resolve()),
  getLivekitURI: () => 'ws://192.168.1.10:7880',
}))
vi.mock('../util/polyfill.js', () => ({}))
vi.mock('./ViewerRoom', async () => {
  const React = await import('react')
  return {
    default: ({ viewerName }) => React.createElement('div', null, `In room as ${viewerName}`),
  }
})

// ---------------------------------------------------------------------------
let fetchMock
let roomConfig
let tokenResponse

const tokenCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/token'))
const parsedToken = (i = 0) => new URL(tokenCalls()[i][0], 'http://host')

beforeEach(() => {
  h.rooms.length = 0
  h.connectError = null
  h.initGate = null
  roomConfig = { user_inputs: [] }
  tokenResponse = 'jwt-token'
  fetchMock = vi.fn(async (url) => {
    if (url === '/room-config') return { json: async () => roomConfig }
    if (String(url).startsWith('/token')) return { text: async () => tokenResponse }
    throw new Error(`Unexpected fetch ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(window, 'alert').mockImplementation(() => { })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function renderViewer() {
  const user = userEvent.setup()
  render(<ViewerApp />)
  await screen.findByRole('heading', { name: 'Enter display name' })
  return { user }
}

// ---------------------------------------------------------------------------
describe('opening the session page', () => {
  it('shows "Loading…" until the app configuration is ready', async () => {
    let release
    h.initGate = { promise: new Promise((r) => { release = r }) }
    render(<ViewerApp />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()

    release()
    expect(await screen.findByRole('heading', { name: 'Enter display name' })).toBeInTheDocument()
  })

  it('starts on the name entry screen without connecting to anything', async () => {
    await renderViewer()

    expect(h.rooms).toHaveLength(0)
    expect(tokenCalls()).toHaveLength(0)
  })
})

describe('CASE-045: valid name and Connect', () => {
  it('requests a student token carrying the name', async () => {
    const { user } = await renderViewer()

    await user.type(screen.getByPlaceholderText('Name'), 'Ana Cruz')
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(tokenCalls()).toHaveLength(1))
    const url = parsedToken()
    expect(url.pathname).toBe('/token')
    expect(url.searchParams.get('role')).toBe('student')
    expect(url.searchParams.get('name')).toBe('Ana Cruz')
    expect(url.searchParams.get('identity')).toMatch(/^student-[a-z0-9]{1,7}$/)
    expect(url.searchParams.get('answers')).toBe('{}')
  })

  it('URL-encodes names with spaces and special characters', async () => {
    const { user } = await renderViewer()

    await user.type(screen.getByPlaceholderText('Name'), 'Ana & Ben/Ç')
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(tokenCalls()).toHaveLength(1))
    expect(tokenCalls()[0][0]).toContain('name=Ana%20%26%20Ben%2F%C3%87')
    expect(parsedToken().searchParams.get('name')).toBe('Ana & Ben/Ç')
  })

  it('connects to LiveKit with the returned token and moves to the Broadcast View screen', async () => {
    const { user } = await renderViewer()

    await user.type(screen.getByPlaceholderText('Name'), 'Ana Cruz')
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    expect(await screen.findByText('In room as Ana Cruz')).toBeInTheDocument()
    expect(h.rooms).toHaveLength(1)
    expect(h.rooms[0].connect).toHaveBeenCalledWith('ws://192.168.1.10:7880', 'jwt-token')
    expect(screen.queryByRole('heading', { name: 'Enter display name' })).not.toBeInTheDocument()
  })

  it('subscribes to track and disconnect events before connecting', async () => {
    const { user } = await renderViewer()

    await user.type(screen.getByPlaceholderText('Name'), 'Ana')
    await user.click(screen.getByRole('button', { name: 'Connect' }))
    await screen.findByText('In room as Ana')

    expect(Object.keys(h.rooms[0].handlers).sort()).toEqual(
      ['disconnected', 'trackSubscribed', 'trackUnsubscribed'],
    )
  })
})

describe('CASE-046: required field empty on a customized form', () => {
  it('alerts and never requests a token or connects', async () => {
    roomConfig = { user_inputs: ['First Name', 'Last Name'] }
    const { user } = await renderViewer()
    await user.type(screen.getByLabelText('First Name'), 'Ana')

    await user.click(screen.getByRole('button', { name: 'Connect' }))

    expect(window.alert).toHaveBeenCalledWith('Please fill in all fields')
    expect(tokenCalls()).toHaveLength(0)
    expect(h.rooms).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Enter display name' })).toBeInTheDocument()
  })
})

describe('CASE-047: customized form filled in', () => {
  it('sends the joined name and the answers by label to /token', async () => {
    roomConfig = { user_inputs: ['First Name', 'Last Name'] }
    const { user } = await renderViewer()

    await user.type(screen.getByLabelText('First Name'), 'Ana')
    await user.type(screen.getByLabelText('Last Name'), 'Cruz')
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(tokenCalls()).toHaveLength(1))
    const url = parsedToken()
    expect(url.searchParams.get('name')).toBe('Ana Cruz')
    expect(JSON.parse(url.searchParams.get('answers'))).toEqual({
      'First Name': 'Ana',
      'Last Name': 'Cruz',
    })
    expect(await screen.findByText('In room as Ana Cruz')).toBeInTheDocument()
  })
})

describe('when connecting fails', () => {
  it('stays on the name entry screen if LiveKit refuses the connection', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    h.connectError = new Error('connection refused')
    const { user } = await renderViewer()

    await user.type(screen.getByPlaceholderText('Name'), 'Ana')
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to join session', expect.any(Error)))
    expect(screen.getByRole('heading', { name: 'Enter display name' })).toBeInTheDocument()
    expect(screen.queryByText(/In room as/)).not.toBeInTheDocument()
  })

  it('stays on the name entry screen if the token request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    fetchMock.mockImplementation(async (url) => {
      if (url === '/room-config') return { json: async () => roomConfig }
      throw new TypeError('Failed to fetch')
    })
    const { user } = await renderViewer()

    await user.type(screen.getByPlaceholderText('Name'), 'Ana')
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(errorSpy).toHaveBeenCalled())
    expect(h.rooms).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Enter display name' })).toBeInTheDocument()
  })
})