import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewerApp from './ViewerApp'
import { initConfig } from '../config.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({ rooms: [], connectHook: null, connectError: null }))

vi.mock('livekit-client', () => {
  class Room {
    constructor() {
      this.handlers = {}
      this.connect = vi.fn(async () => {
        if (h.connectError) throw h.connectError
        if (h.connectHook) h.connectHook(this)
      })
      this.disconnect = vi.fn(() => Promise.resolve())
      this.localParticipant = { sendText: vi.fn().mockResolvedValue(undefined) }
      h.rooms.push(this)
    }
    on(event, cb) {
      this.handlers[event] = cb
      return this
    }
    emit(event, ...args) {
      this.handlers[event]?.(...args)
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
  initConfig: vi.fn(() => Promise.resolve()),
  getLivekitURI: vi.fn(() => 'ws://192.168.1.10:7880'),
}))
vi.mock('../util/polyfill.js', () => ({}))

// The join form and the chat have their own tests (CASE-041 to 047, CASE-054 to 058).
vi.mock('./ViewerJoin', () => ({
  default: ({ onConnect }) => (
    <div data-testid="join-screen">
      <button onClick={() => onConnect('Ana Cruz', { 'First Name': 'Ana', 'Last Name': 'Cruz' })}>
        join-stub
      </button>
    </div>
  ),
}))
vi.mock('./ViewerChat', () => ({
  default: ({ viewerName, messages, onSendMessage, onClose }) => (
    <section aria-label="chat">
      <h2>Message to Host</h2>
      <span data-testid="chat-viewer">{viewerName}</span>
      <span data-testid="chat-count">{messages.length}</span>
      <button onClick={() => onSendMessage('hello')}>send-hello</button>
      <button onClick={onClose}>close-chat</button>
    </section>
  ),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let fetchMock
let errorSpy
let logSpy

const videoTrack = () => ({ kind: 'video', mediaStreamTrack: { id: 'screen-track' } })
const audioTrack = () => ({ kind: 'audio', mediaStreamTrack: { id: 'audio-track' } })
const emit = (room, event, ...args) => act(() => room.emit(event, ...args))
const video = () => document.querySelector('video')

async function joinRoom() {
  const user = userEvent.setup()
  render(<ViewerApp />)
  await user.click(await screen.findByText('join-stub'))
  await screen.findByTitle('Leave Room')
  return { user, room: h.rooms.at(-1) }
}

describe('ViewerApp: Broadcast View', () => {
  beforeEach(() => {
    h.rooms.length = 0
    h.connectHook = null
    h.connectError = null
    fetchMock = vi.fn(async () => ({ text: async () => 'jwt-token' }))
    vi.stubGlobal('fetch', fetchMock)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('shows a loading state until the config is ready', async () => {
    let release
    initConfig.mockImplementationOnce(() => new Promise((r) => (release = r)))

    render(<ViewerApp />)
    expect(screen.getByText(/Loading/)).toBeInTheDocument()
    expect(screen.queryByTestId('join-screen')).not.toBeInTheDocument()

    release()
    expect(await screen.findByTestId('join-screen')).toBeInTheDocument()
  })

  // CASE-048
  describe('CASE-048: viewer joins an active session', () => {
    it('requests a student token with the name and answers', async () => {
      await joinRoom()

      const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost')
      expect(url.pathname).toBe('/token')
      expect(url.searchParams.get('role')).toBe('student')
      expect(url.searchParams.get('identity')).toMatch(/^student-[a-z0-9]+$/)
      expect(url.searchParams.get('name')).toBe('Ana Cruz')
      expect(JSON.parse(url.searchParams.get('answers'))).toEqual({
        'First Name': 'Ana',
        'Last Name': 'Cruz',
      })
    })

    it('connects to LiveKit with the token and shows the broadcast view', async () => {
      const { room } = await joinRoom()

      expect(room.connect).toHaveBeenCalledWith('ws://192.168.1.10:7880', 'jwt-token')
      expect(screen.queryByTestId('join-screen')).not.toBeInTheDocument()
      expect(video()).toBeInTheDocument()
    })

    it('registers handlers for track and disconnect events', async () => {
      const { room } = await joinRoom()

      expect(Object.keys(room.handlers).sort()).toEqual(
        ['disconnected', 'trackSubscribed', 'trackUnsubscribed'].sort(),
      )
    })

    it("displays the host's shared screen when the video track is subscribed", async () => {
      const { room } = await joinRoom()
      const track = videoTrack()

      emit(room, 'trackSubscribed', track)

      await waitFor(() => expect(video().srcObject).not.toBeNull())
      expect(video().srcObject.tracks).toEqual([track.mediaStreamTrack])
    })

    it('displays the screen when the track arrives while still connecting', async () => {
      const track = videoTrack()
      h.connectHook = (room) => room.emit('trackSubscribed', track)

      await joinRoom()

      await waitFor(() => expect(video().srcObject).not.toBeNull())
      expect(video().srcObject.tracks).toEqual([track.mediaStreamTrack])
    })

    it('ignores audio tracks', async () => {
      const { room } = await joinRoom()

      emit(room, 'trackSubscribed', audioTrack())

      expect(video().srcObject == null).toBe(true)
    })

    it('stays on the join screen when the token request fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('offline'))
      const user = userEvent.setup()
      render(<ViewerApp />)

      await user.click(await screen.findByText('join-stub'))

      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('Failed to join session', expect.any(Error)),
      )
      expect(screen.getByTestId('join-screen')).toBeInTheDocument()
      expect(h.rooms).toHaveLength(0)
    })

    it('stays on the join screen when LiveKit refuses the connection', async () => {
      h.connectError = new Error('room full')
      const user = userEvent.setup()
      render(<ViewerApp />)

      await user.click(await screen.findByText('join-stub'))

      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('Failed to join session', expect.any(Error)),
      )
      expect(screen.getByTestId('join-screen')).toBeInTheDocument()
      expect(screen.queryByTitle('Leave Room')).not.toBeInTheDocument()
    })

    // The room is assigned to roomRef before room.connect(), so a failed connect leaves a
    // Room object behind that is never disconnected.
    it.todo('disconnects the room when connecting fails (not implemented in source)')
  })

  // CASE-049
  describe('CASE-049: viewer joins when no active session exists', () => {
    it('shows an empty video (blank screen) when no track is published', async () => {
      await joinRoom()

      expect(video()).toBeInTheDocument()
      expect(video().srcObject == null).toBe(true)
    })

    it('goes blank again when the host stops sharing (track unsubscribed)', async () => {
      const { room } = await joinRoom()
      emit(room, 'trackSubscribed', videoTrack())
      await waitFor(() => expect(video().srcObject).not.toBeNull())

      emit(room, 'trackUnsubscribed', videoTrack())

      await waitFor(() => expect(video().srcObject == null).toBe(true))
    })

    it('does not clear the video when an audio track is unsubscribed', async () => {
      const { room } = await joinRoom()
      emit(room, 'trackSubscribed', videoTrack())
      await waitFor(() => expect(video().srcObject).not.toBeNull())

      emit(room, 'trackUnsubscribed', audioTrack())

      expect(video().srcObject).not.toBeNull()
    })
  })

  // CASE-050
  describe('CASE-050: viewer clicks "Chat"', () => {
    it('opens the "Message to Host" pop-up with the viewer name', async () => {
      const { user } = await joinRoom()
      expect(screen.queryByText('Message to Host')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Chat' }))

      expect(screen.getByText('Message to Host')).toBeInTheDocument()
      expect(screen.getByTestId('chat-viewer')).toHaveTextContent('Ana Cruz')
    })

    it('closes the pop-up when Chat is clicked again', async () => {
      const { user } = await joinRoom()
      await user.click(screen.getByRole('button', { name: 'Chat' }))

      await user.click(screen.getByRole('button', { name: 'Chat' }))

      expect(screen.queryByText('Message to Host')).not.toBeInTheDocument()
    })

    it('closes the pop-up from the pop-up close button', async () => {
      const { user } = await joinRoom()
      await user.click(screen.getByRole('button', { name: 'Chat' }))

      await user.click(screen.getByText('close-chat'))

      expect(screen.queryByText('Message to Host')).not.toBeInTheDocument()
    })
  })

  // CASE-051
  describe('CASE-051: viewer clicks the leave (X) button', () => {
    it('disconnects from the room and ends the viewing session', async () => {
      const { user, room } = await joinRoom()

      await user.click(screen.getByTitle('Leave Room'))

      await waitFor(() => expect(room.disconnect).toHaveBeenCalledTimes(1))
      expect(screen.queryByTitle('Leave Room')).not.toBeInTheDocument()
      expect(video()).not.toBeInTheDocument()
    })

    it('clears the stream, messages and open chat so a rejoin starts clean', async () => {
      const { user, room } = await joinRoom()
      emit(room, 'trackSubscribed', videoTrack())
      await user.click(screen.getByRole('button', { name: 'Chat' }))
      await user.click(screen.getByText('send-hello'))
      await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('1'))

      await user.click(screen.getByTitle('Leave Room'))
      await screen.findByTestId('join-screen')
      await user.click(screen.getByText('join-stub'))
      await screen.findByTitle('Leave Room')

      expect(h.rooms).toHaveLength(2)
      expect(screen.queryByText('Message to Host')).not.toBeInTheDocument()
      expect(video().srcObject == null).toBe(true)
      await user.click(screen.getByRole('button', { name: 'Chat' }))
      expect(screen.getByTestId('chat-count')).toHaveTextContent('0')
    })

    it('still ends the session when disconnecting fails', async () => {
      const { user, room } = await joinRoom()
      room.disconnect.mockRejectedValueOnce(new Error('socket closed'))

      await user.click(screen.getByTitle('Leave Room'))

      expect(await screen.findByTestId('join-screen')).toBeInTheDocument()
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error))
    })

    it('a late Disconnected event after leaving does not break anything', async () => {
      const { user, room } = await joinRoom()
      await user.click(screen.getByTitle('Leave Room'))
      await screen.findByTestId('join-screen')

      expect(() => emit(room, 'disconnected')).not.toThrow()
      expect(screen.getByTestId('join-screen')).toBeInTheDocument()
      expect(room.disconnect).toHaveBeenCalledTimes(1)
    })
  })

  // CASE-052 and CASE-053 both reach the viewer as LiveKit events:
  //  - host ends the session   -> the presenter leaves the room (track unsubscribed, and a
  //                              Disconnected event once the room is closed)
  //  - host removes the viewer -> the server removes the participant (Disconnected)
  describe('CASE-052: host ends the session while the viewer is watching', () => {
    it('clears the video immediately when the host track goes away', async () => {
      const { room } = await joinRoom()
      emit(room, 'trackSubscribed', videoTrack())
      await waitFor(() => expect(video().srcObject).not.toBeNull())

      emit(room, 'trackUnsubscribed', videoTrack())

      await waitFor(() => expect(video().srcObject == null).toBe(true))
    })

    it('leaves the viewing page immediately when the room disconnects', async () => {
      const { room } = await joinRoom()
      emit(room, 'trackSubscribed', videoTrack())

      emit(room, 'disconnected')

      expect(await screen.findByTestId('join-screen')).toBeInTheDocument()
      expect(screen.queryByTitle('Leave Room')).not.toBeInTheDocument()
      expect(video()).not.toBeInTheDocument()
    })

    it('closes the chat pop-up and drops messages', async () => {
      const { user, room } = await joinRoom()
      await user.click(screen.getByRole('button', { name: 'Chat' }))
      await user.click(screen.getByText('send-hello'))
      await waitFor(() => expect(screen.getByTestId('chat-count')).toHaveTextContent('1'))

      emit(room, 'disconnected')
      await screen.findByTestId('join-screen')

      expect(screen.queryByText('Message to Host')).not.toBeInTheDocument()
      await user.click(screen.getByText('join-stub'))
      await screen.findByTitle('Leave Room')
      await user.click(screen.getByRole('button', { name: 'Chat' }))
      expect(screen.getByTestId('chat-count')).toHaveTextContent('0')
    })

    it('disconnects its own room object once and ignores a repeated event', async () => {
      const { room } = await joinRoom()

      emit(room, 'disconnected')
      emit(room, 'disconnected')

      expect(room.disconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('CASE-053: host disconnects the viewer individually', () => {
    it("takes the viewer off the broadcast page as soon as LiveKit reports the removal", async () => {
      const { room } = await joinRoom()
      emit(room, 'trackSubscribed', videoTrack())
      await waitFor(() => expect(video().srcObject).not.toBeNull())

      emit(room, 'disconnected')

      expect(await screen.findByTestId('join-screen')).toBeInTheDocument()
      expect(video()).not.toBeInTheDocument()
    })

    it('lets the viewer rejoin afterwards with a fresh room (no ban list)', async () => {
      const { user, room } = await joinRoom()
      emit(room, 'disconnected')
      await screen.findByTestId('join-screen')

      await user.click(screen.getByText('join-stub'))
      await screen.findByTitle('Leave Room')

      expect(h.rooms).toHaveLength(2)
      expect(h.rooms[1]).not.toBe(room)
    })
  })

  describe('unmount', () => {
    it('disconnects the room when the viewer navigates away', async () => {
      const user = userEvent.setup()
      const { unmount } = render(<ViewerApp />)
      await user.click(await screen.findByText('join-stub'))
      await screen.findByTitle('Leave Room')
      const room = h.rooms[0]

      unmount()

      expect(room.disconnect).toHaveBeenCalledTimes(1)
    })
  })
})