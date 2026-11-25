import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PresenterApp from './PresenterApp'

// ---------------------------------------------------------------------------
// Mocks: LiveKit, qrcode, config and screens that are not under test.
// Dashboard, Sidebar and ChatModal are the REAL components.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({ rooms: [] }))

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
vi.mock('qrcode', () => ({ toCanvas: vi.fn() }))
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
vi.mock('./BroadcastScreen', () => ({ default: () => null }))
vi.mock('./SplashScreen', async () => {
  const React = await import('react')
  return {
    default: ({ onStartSharing }) =>
      React.createElement('button', { onClick: onStartSharing }, 'Share Screen'),
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let fetchMock

const sidebar = () => within(screen.getByRole('complementary'))
const chatHeading = () => screen.queryByRole('heading', { name: 'Chat' })
const chatModal = () => within(screen.getByRole('heading', { name: 'Chat' }).closest('div.fixed'))

async function startBroadcast(user = userEvent.setup()) {
  await user.click(await screen.findByRole('button', { name: 'Share Screen' }))
  await screen.findByRole('complementary')
  return { user }
}

async function renderAndStart() {
  const user = userEvent.setup()
  render(<PresenterApp />)
  await startBroadcast(user)
  return { user }
}

// Simulates a viewer's text stream arriving on the presenter's LiveKit room.
async function receive(identity, text, room = h.rooms.at(-1)) {
  const [, handler] = room.registerTextStreamHandler.mock.calls.find(
    ([topic]) => topic === 'student-message',
  )
  await act(async () => {
    await handler({ readAll: async () => text }, { identity })
  })
}

const openChat = (user) => user.click(screen.getByRole('button', { name: 'Expand Chat' }))

beforeEach(() => {
  h.rooms.length = 0
  vi.stubGlobal('MediaStream', class { constructor(tracks) { this.tracks = tracks } })
  fetchMock = vi.fn(async (url) => {
    if (url.startsWith('/token')) return { ok: true, text: async () => 'tok' }
    if (url === '/logs/reset') return { ok: true }
    if (url === '/participants') return { ok: true, json: async () => ({ count: 0, participants: [] }) }
    if (url === '/logs/snapshot') return { ok: true, json: async () => ({ rows: [] }) }
    throw new Error(`Unexpected fetch ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
describe('receiving viewer messages', () => {
  it('registers a text-stream handler for the "student-message" topic when the broadcast starts', async () => {
    await renderAndStart()

    const topics = h.rooms[0].registerTextStreamHandler.mock.calls.map(([t]) => t)
    expect(topics).toEqual(['student-message'])
  })
})

describe('CASE-039: Chat Preview with received messages', () => {
  it('opens the Chat pop-up from the sidebar expand button', async () => {
    const { user } = await renderAndStart()

    await openChat(user)

    expect(chatHeading()).toBeInTheDocument()
  })

  it('shows each received message with the viewer\'s name', async () => {
    const { user } = await renderAndStart()
    h.rooms[0].remoteParticipants.set('s1', { name: 'Ana Cruz' })
    h.rooms[0].remoteParticipants.set('s2', { name: 'Ben Diaz' })
    await receive('s1', 'Can you repeat that?')
    await receive('s2', 'Slide 3 is not loading')

    await openChat(user)

    const modal = chatModal()
    expect(modal.getByText('Ana Cruz')).toBeInTheDocument()
    expect(modal.getByText('Can you repeat that?')).toBeInTheDocument()
    expect(modal.getByText('Ben Diaz')).toBeInTheDocument()
    expect(modal.getByText('Slide 3 is not loading')).toBeInTheDocument()
  })

  it('uses the sender\'s identity when the participant is not (or no longer) in the room', async () => {
    const { user } = await renderAndStart()
    await receive('student-77', 'Hello?')

    await openChat(user)

    expect(chatModal().getByText('student-77')).toBeInTheDocument()
  })

  it('uses the identity when the participant has no display name', async () => {
    const { user } = await renderAndStart()
    h.rooms[0].remoteParticipants.set('s5', { name: '' })
    await receive('s5', 'Hi')

    await openChat(user)

    expect(chatModal().getByText('s5')).toBeInTheDocument()
  })

  it('keeps every message in the order received, including repeats from one viewer', async () => {
    const { user } = await renderAndStart()
    h.rooms[0].remoteParticipants.set('s1', { name: 'Ana Cruz' })
    await receive('s1', 'first')
    await receive('s1', 'second')
    await receive('s1', 'third')

    await openChat(user)

    const texts = chatModal().getAllByText(/^(first|second|third)$/).map((n) => n.textContent)
    expect(texts).toEqual(['first', 'second', 'third'])
    expect(chatModal().getAllByText('Ana Cruz')).toHaveLength(3)
  })

  it('shows a message that arrives while the pop-up is already open', async () => {
    const { user } = await renderAndStart()
    await openChat(user)
    expect(chatModal().getByText('No messages yet.')).toBeInTheDocument()

    await receive('s1', 'live message')

    expect(await chatModal().findByText('live message')).toBeInTheDocument()
    expect(chatModal().queryByText('No messages yet.')).not.toBeInTheDocument()
  })

  it('shows only the first two messages in the sidebar preview, but all of them in the pop-up', async () => {
    const { user } = await renderAndStart()
    await receive('s1', 'one')
    await receive('s1', 'two')
    await receive('s1', 'three')

    expect(sidebar().getByText('one')).toBeInTheDocument()
    expect(sidebar().getByText('two')).toBeInTheDocument()
    expect(sidebar().queryByText('three')).not.toBeInTheDocument()

    await openChat(user)
    expect(chatModal().getByText('three')).toBeInTheDocument()
  })

  // POSSIBLE DEFECT (not an appendix case): the sidebar preview uses messages.slice(0, 2),
  // so it shows the two OLDEST messages and never updates once there are two. A "recent
  // messages" preview would normally use slice(-2). Confirm the intent; if the preview should
  // show the latest two, change Sidebar.jsx and turn this it.fails into a normal it.
  it.fails('sidebar preview shows the most recent two messages', async () => {
    await renderAndStart()
    await receive('s1', 'one')
    await receive('s1', 'two')
    await receive('s1', 'three')

    expect(sidebar().getByText('three')).toBeInTheDocument()
  })
})

describe('CASE-040: Chat Preview with no messages', () => {
  it('shows "No messages yet." in the pop-up', async () => {
    const { user } = await renderAndStart()

    await openChat(user)

    expect(chatModal().getByText('No messages yet.')).toBeInTheDocument()
  })

  it('shows an empty sidebar preview', async () => {
    await renderAndStart()

    expect(sidebar().queryByText('No messages yet.')).not.toBeInTheDocument()
    expect(sidebar().getByRole('button', { name: 'Expand Chat' })).toBeInTheDocument()
  })

  it('shows "No messages yet." again in a new session after the host ends the previous one', async () => {
    const { user } = await renderAndStart()
    await receive('s1', 'from the first session')

    await user.click(sidebar().getByRole('button', { name: /End Session/ }))
    await screen.findByRole('button', { name: 'Share Screen' })
    await startBroadcast(user)
    await openChat(user)

    expect(chatModal().getByText('No messages yet.')).toBeInTheDocument()
    expect(chatModal().queryByText('from the first session')).not.toBeInTheDocument()
  })
})

describe('closing the Chat pop-up', () => {
  it('closes from the X button and leaves the active broadcast visible', async () => {
    const { user } = await renderAndStart()
    await openChat(user)

    await user.click(screen.getByRole('button', { name: 'Close modal' }))

    expect(chatHeading()).not.toBeInTheDocument()
    expect(sidebar().getByRole('button', { name: /End Session/ })).toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', async () => {
    const { user } = await renderAndStart()
    await openChat(user)

    await user.click(chatHeading().closest('div.fixed'))

    expect(chatHeading()).not.toBeInTheDocument()
  })

  it('keeps receiving messages after the pop-up is closed', async () => {
    const { user } = await renderAndStart()
    await openChat(user)
    await user.click(screen.getByRole('button', { name: 'Close modal' }))

    await receive('s1', 'sent while closed')
    await openChat(user)

    expect(chatModal().getByText('sent while closed')).toBeInTheDocument()
  })

  it('does not open for the QR or Viewers triggers', async () => {
    const { user } = await renderAndStart()
    await waitFor(() => expect(sidebar().getByText('Viewers: 0')).toBeInTheDocument())

    await user.click(sidebar().getByText('Viewers: 0'))

    expect(chatHeading()).not.toBeInTheDocument()
  })
})