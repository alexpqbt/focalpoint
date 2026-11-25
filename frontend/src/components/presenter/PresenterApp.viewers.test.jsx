import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PresenterApp from './PresenterApp'

// ---------------------------------------------------------------------------
// Mocks: LiveKit, qrcode, config and the screens that are not under test.
// Sidebar, ViewersModal and QrModal are the REAL components.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({ rooms: [], toCanvas: vi.fn() }))

vi.mock('livekit-client', () => {
  class Room {
    constructor() {
      this.localParticipant = {
        setScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
        getTrackPublication: vi.fn(() => ({ videoTrack: { mediaStreamTrack: { kind: 'video' } } })),
      }
      this.remoteParticipants = new Map()
      this.connect = vi.fn().mockResolvedValue(undefined)
      this.disconnect = vi.fn().mockResolvedValue(undefined)
      this.on = vi.fn()
      this.registerTextStreamHandler = vi.fn()
      h.rooms.push(this)
    }
  }
  return { Room, RoomEvent: { LocalTrackUnpublished: 'localTrackUnpublished' } }
})
vi.mock('qrcode', () => ({ toCanvas: (...args) => h.toCanvas(...args) }))
vi.mock('../config.js', () => ({
  initConfig: () => Promise.resolve(),
  getServerIP: () => '192.168.1.10',
  getLivekitURI: () => 'ws://192.168.1.10:7880',
  VIDEO_CFG: {},
}))
vi.mock('../util/polyfill.js', () => ({}))
vi.mock('../util/logStore.js', () => ({ saveLog: vi.fn() }))
vi.mock('../common/Header', () => ({ default: () => null }))
vi.mock('../common/Footer', () => ({ default: () => null }))
vi.mock('./modals/ChatModal', () => ({ default: () => null }))
vi.mock('./SplashScreen', async () => {
  const React = await import('react')
  return {
    default: ({ onStartSharing }) =>
      React.createElement('button', { onClick: onStartSharing }, 'Share Screen'),
  }
})
vi.mock('./Dashboard', async () => {
  const React = await import('react')
  const { default: Sidebar } = await import('./Sidebar')
  return {
    default: ({ onEndSession, onOpenModal, viewers, messages }) =>
      React.createElement(Sidebar, { onEndSession, onOpenModal, viewers, messages }),
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ANA = { identity: 's1', name: 'Ana Cruz', attributes: { 'First Name': 'Ana', 'Last Name': 'Cruz' } }
const BEN = { identity: 's2', name: 'Ben Diaz', attributes: { 'First Name': 'Ben', 'Last Name': 'Diaz' } }

let participants
let roomConfig
let removeStatus
let fetchMock
let intervalSpy
let writeText

const callsTo = (pred) => fetchMock.mock.calls.filter(([u, o]) => pred(u, o))
const participantPolls = () => callsTo((u) => u === '/participants')
const removeCalls = () => callsTo((u) => u.startsWith('/participants/') && u.endsWith('/remove'))

const sidebar = () => within(screen.getByRole('complementary'))
const viewersHeading = (n) => screen.getByRole('heading', { name: `Viewers: ${n}` })
const removeButtons = () => screen.queryAllByRole('button', { name: 'Remove' })

async function startBroadcast() {
  const user = userEvent.setup()
  render(<PresenterApp />)
  await user.click(await screen.findByRole('button', { name: 'Share Screen' }))
  await screen.findByRole('complementary')
  return { user }
}

const openViewers = (user) => user.click(sidebar().getByText(/^Viewers:/))
const openQr = (user) => user.click(sidebar().getByText('[QR CODE]'))

// Runs the callback that PresenterApp registered with setInterval(…, 3500).
async function runPoll() {
  const call = intervalSpy.mock.calls.filter((c) => c[1] === 3500).at(-1)
  await act(async () => {
    await call[0]()
  })
}

beforeEach(() => {
  participants = []
  roomConfig = { user_inputs: [], fields: [] }
  removeStatus = 200
  h.rooms.length = 0
  h.toCanvas.mockReset()
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  vi.stubGlobal('MediaStream', class { constructor(tracks) { this.tracks = tracks } })
  intervalSpy = vi.spyOn(globalThis, 'setInterval')

  fetchMock = vi.fn(async (url, opts = {}) => {
    if (url.startsWith('/token')) return { ok: true, text: async () => 'tok' }
    if (url === '/logs/reset') return { ok: true }
    if (url === '/participants') {
      return { ok: true, json: async () => ({ count: participants.length, participants }) }
    }
    if (url.startsWith('/participants/') && url.endsWith('/remove')) {
      if (removeStatus !== 200) return { ok: false, status: removeStatus }
      const id = decodeURIComponent(url.split('/')[2])
      participants = participants.filter((p) => p.identity !== id)
      return { ok: true, json: async () => ({ status: 'removed' }) }
    }
    if (url === '/room-config') return { ok: true, json: async () => roomConfig }
    throw new Error(`Unexpected fetch ${opts.method || 'GET'} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// CASE-031 to CASE-035: Viewers List wired into the presenter
// ---------------------------------------------------------------------------
describe('CASE-031: no viewers connected', () => {
  it('shows zero in the sidebar and an empty list in the overlay', async () => {
    const { user } = await startBroadcast()
    expect(sidebar().getByText('Viewers: 0')).toBeInTheDocument()

    await openViewers(user)

    expect(viewersHeading(0)).toBeInTheDocument()
    expect(removeButtons()).toHaveLength(0)
  })
})

describe('CASE-032: viewers connected', () => {
  it('polls /participants with the presenter token as soon as the broadcast starts', async () => {
    participants = [ANA, BEN]
    await startBroadcast()

    await waitFor(() => expect(participantPolls().length).toBeGreaterThanOrEqual(1))
    expect(participantPolls()[0][1]).toEqual({ headers: { Authorization: 'Bearer tok' } })
    expect(await sidebar().findByText('Viewers: 2')).toBeInTheDocument()
  })

  it('lists every viewer with a Remove button in the overlay', async () => {
    participants = [ANA, BEN]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 2')

    await openViewers(user)

    expect(viewersHeading(2)).toBeInTheDocument()
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
    expect(screen.getByText('Ben Diaz')).toBeInTheDocument()
    expect(removeButtons()).toHaveLength(2)
  })

  it('shows the answers from the customized join form (CASE-047, host side)', async () => {
    roomConfig = { user_inputs: ['First Name', 'Last Name'], fields: [] }
    participants = [ANA]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 1')

    await openViewers(user)

    expect(await screen.findByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Cruz')).toBeInTheDocument()
  })

  it('uses the identity when a participant has no name', async () => {
    participants = [{ identity: 'guest-9', name: '', attributes: null }]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 1')

    await openViewers(user)

    expect(screen.getByText('guest-9')).toBeInTheDocument()
  })

  it('updates the count and the open list when the next poll finds a new viewer', async () => {
    participants = [ANA]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 1')
    await openViewers(user)

    participants = [ANA, BEN]
    await runPoll()

    expect(await sidebar().findByText('Viewers: 2')).toBeInTheDocument()
    expect(viewersHeading(2)).toBeInTheDocument()
    expect(screen.getByText('Ben Diaz')).toBeInTheDocument()
  })

  it('keeps the old list when a poll fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    participants = [ANA]
    await startBroadcast()
    await sidebar().findByText('Viewers: 1')

    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500 }))
    await runPoll()

    expect(sidebar().getByText('Viewers: 1')).toBeInTheDocument()
  })
})

// The code labels the button "Remove"; the appendix calls it "Disconnect".
describe('CASE-033: Remove a viewer', () => {
  it('sends POST /participants/:identity/remove with the presenter token', async () => {
    participants = [ANA, BEN]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 2')
    await openViewers(user)

    await user.click(removeButtons()[0])

    await waitFor(() => expect(removeCalls()).toHaveLength(1))
    const [url, opts] = removeCalls()[0]
    expect(url).toBe('/participants/s1/remove')
    expect(opts).toEqual({ method: 'POST', headers: { Authorization: 'Bearer tok' } })
  })

  it('drops the viewer from the list and lowers the count by one, keeping the overlay open', async () => {
    participants = [ANA, BEN]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 2')
    await openViewers(user)

    await user.click(removeButtons()[0])

    await waitFor(() => expect(viewersHeading(1)).toBeInTheDocument())
    expect(sidebar().getByText('Viewers: 1')).toBeInTheDocument()
    expect(screen.queryByText('Ana Cruz')).not.toBeInTheDocument()
    expect(screen.getByText('Ben Diaz')).toBeInTheDocument()
  })

  it('re-reads /participants after a successful removal', async () => {
    participants = [ANA, BEN]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 2')
    await openViewers(user)
    const before = participantPolls().length

    await user.click(removeButtons()[0])

    await waitFor(() => expect(participantPolls().length).toBe(before + 1))
  })

  it('URL-encodes identities that contain special characters', async () => {
    participants = [{ identity: 'a b/c', name: 'Odd One', attributes: {} }]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 1')
    await openViewers(user)

    await user.click(removeButtons()[0])

    await waitFor(() => expect(removeCalls()).toHaveLength(1))
    expect(removeCalls()[0][0]).toBe('/participants/a%20b%2Fc/remove')
  })

  it('keeps the viewer listed and does not re-poll when the server refuses', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    removeStatus = 404
    participants = [ANA]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 1')
    await openViewers(user)
    const before = participantPolls().length

    await user.click(removeButtons()[0])

    await waitFor(() => expect(removeCalls()).toHaveLength(1))
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('disconnect failed', 's1', 404))
    expect(participantPolls()).toHaveLength(before)
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
    expect(viewersHeading(1)).toBeInTheDocument()
  })
  // The viewer's own blank page is browser behaviour (see CASE-052 and CASE-053).
})

describe('CASE-034: remove the last remaining viewer', () => {
  it('leaves an empty list and a count of zero', async () => {
    participants = [ANA]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 1')
    await openViewers(user)

    await user.click(removeButtons()[0])

    await waitFor(() => expect(viewersHeading(0)).toBeInTheDocument())
    expect(sidebar().getByText('Viewers: 0')).toBeInTheDocument()
    expect(removeButtons()).toHaveLength(0)
  })
})

describe('CASE-035: dismiss the Viewers overlay', () => {
  it('closes from the X button and leaves the active broadcast screen visible', async () => {
    const { user } = await startBroadcast()
    await openViewers(user)
    expect(viewersHeading(0)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close modal' }))

    expect(screen.queryByRole('heading', { name: /^Viewers:/ })).not.toBeInTheDocument()
    expect(sidebar().getByRole('button', { name: /End Session/ })).toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', async () => {
    const { user } = await startBroadcast()
    await openViewers(user)

    await user.click(viewersHeading(0).closest('div.fixed'))

    expect(screen.queryByRole('heading', { name: /^Viewers:/ })).not.toBeInTheDocument()
  })

  it('does not end the session or stop polling', async () => {
    participants = [ANA]
    const { user } = await startBroadcast()
    await sidebar().findByText('Viewers: 1')
    await openViewers(user)

    await user.click(screen.getByRole('button', { name: 'Close modal' }))

    expect(h.rooms[0].disconnect).not.toHaveBeenCalled()
    participants = [ANA, BEN]
    await runPoll()
    expect(await sidebar().findByText('Viewers: 2')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// CASE-036 to CASE-038: QR code preview wired into the presenter
// ---------------------------------------------------------------------------
describe('CASE-036: enlarged QR code', () => {
  it('opens the QR overlay from the sidebar thumbnail', async () => {
    const { user } = await startBroadcast()

    await openQr(user)

    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('draws the viewer URL onto the overlay canvas at 80% of the smaller viewport side', async () => {
    window.innerWidth = 1000
    window.innerHeight = 500
    const { user } = await startBroadcast()

    await openQr(user)

    await waitFor(() => expect(h.toCanvas).toHaveBeenCalledTimes(1))
    const [canvas, url, opts, callback] = h.toCanvas.mock.calls[0]
    expect(canvas).toBe(document.querySelector('canvas'))
    expect(url).toBe('http://192.168.1.10:8080/view')
    expect(opts).toEqual({ width: 400 })
    expect(typeof callback).toBe('function')
  })

  it('uses the width when the window is narrower than it is tall', async () => {
    window.innerWidth = 400
    window.innerHeight = 900
    const { user } = await startBroadcast()

    await openQr(user)

    await waitFor(() => expect(h.toCanvas).toHaveBeenCalled())
    expect(h.toCanvas.mock.calls[0][2]).toEqual({ width: 320 })
  })

  it('logs a message when the QR cannot be drawn', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
    h.toCanvas.mockImplementation((_c, _u, _o, cb) => cb(new Error('boom')))
    const { user } = await startBroadcast()

    await openQr(user)

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('QR render failed:', expect.any(Error)),
    )
  })

  it('does not draw a QR for the Viewers overlay', async () => {
    const { user } = await startBroadcast()

    await openViewers(user)

    expect(h.toCanvas).not.toHaveBeenCalled()
  })

  it('draws again each time the overlay is reopened', async () => {
    const { user } = await startBroadcast()
    await openQr(user)
    await waitFor(() => expect(h.toCanvas).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Close modal' }))
    expect(document.querySelector('canvas')).not.toBeInTheDocument()
    await openQr(user)

    await waitFor(() => expect(h.toCanvas).toHaveBeenCalledTimes(2))
  })
})

describe('CASE-037: session URL below the QR code', () => {
  it('shows the viewer URL built from the server IP', async () => {
    const { user } = await startBroadcast()

    await openQr(user)

    expect(screen.getByText('http://192.168.1.10:8080/view')).toBeInTheDocument()
  })
})

describe('CASE-038: Copy button', () => {
  it('copies the viewer URL and shows "Copied"', async () => {
    const { user } = await startBroadcast()
    await openQr(user)

    await user.click(screen.getByRole('button', { name: /Copy/ }))

    expect(writeText).toHaveBeenCalledWith('http://192.168.1.10:8080/view')
    expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument()
  })
})