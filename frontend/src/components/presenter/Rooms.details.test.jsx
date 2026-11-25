import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Rooms from './Rooms'
import { loadLogs } from '../util/logStore.js'

vi.mock('../util/logStore.js', () => ({ loadLogs: vi.fn() }))
vi.mock('./Logs', () => ({ default: () => null }))

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------
const ROOM_1 = {
  id: 1,
  label: 'Room 1',
  roomSize: '30',
  fields: [
    { name: 'Section', value: 'BSIT 4C' },
    { name: 'Subject', value: 'Math' },
  ],
  userInputs: ['First Name', 'Last Name'],
}
const ROOM_2 = {
  id: 2,
  label: 'Room 2',
  roomSize: '10',
  fields: [{ name: 'Section', value: 'BSCS 2A' }],
  userInputs: ['Student ID'],
}

let fetchMock
let existingRooms
let handlers // per-test overrides: list, del, roomConfig
let confirmSpy

const roomFromBody = (id, body) => ({
  id,
  label: `Room ${id}`,
  roomSize: String(body.room_size),
  fields: body.fields,
  userInputs: body.user_inputs,
})

const callsTo = (url, method) =>
  fetchMock.mock.calls.filter(([u, o]) => u === url && (o?.method || 'GET') === method)
const roomConfigCalls = () => callsTo('/room-config', 'POST')
const deleteCalls = () =>
  fetchMock.mock.calls.filter(([, o]) => o?.method === 'DELETE')
const putCalls = () => fetchMock.mock.calls.filter(([, o]) => o?.method === 'PUT')
const lastBody = (calls) => JSON.parse(calls.at(-1)[1].body)

const heading = (name) => screen.queryByRole('heading', { name })
const roomSizeInput = () =>
  screen.getByText(/Room size \(Max 50\)/).parentElement.querySelector('input')
const fieldNames = () => screen.queryAllByPlaceholderText('Field Name').map((i) => i.value)
const fieldValues = () => screen.queryAllByPlaceholderText('Value').map((i) => i.value)
const inputNames = () => screen.queryAllByPlaceholderText('Input Name').map((i) => i.value)
const fieldCard = (i) => screen.getAllByPlaceholderText('Field Name')[i].parentElement
const inputCard = (i) => screen.getAllByPlaceholderText('Input Name')[i].parentElement.parentElement
const removeIn = (card) => card.querySelector('button')

const btn = (name) => screen.getByRole('button', { name })
const maxSizeRow = () => screen.getByText('Max Size:').parentElement
const section = (title) => screen.getByRole('heading', { name: title }).parentElement

async function renderRooms(props = {}) {
  const user = userEvent.setup()
  const onShareScreen = vi.fn()
  render(<Rooms onShareScreen={onShareScreen} {...props} />)
  return { user, onShareScreen }
}

async function openRoom(label = 'Room 1', props = {}) {
  const ctx = await renderRooms(props)
  await ctx.user.click(await screen.findByText(label))
  await screen.findByRole('heading', { name: label })
  return ctx
}

async function openNewRoom() {
  const ctx = await renderRooms()
  await screen.findByText(/No saved rooms yet/)
  await ctx.user.click(btn(/^Add Room/))
  await screen.findByText('Customize New Room')
  return ctx
}

beforeEach(() => {
  existingRooms = [ROOM_1, ROOM_2]
  handlers = {}
  loadLogs.mockResolvedValue([])
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  fetchMock = vi.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET'
    if (url === '/rooms' && method === 'GET') {
      return handlers.list ? handlers.list() : { ok: true, json: async () => existingRooms }
    }
    if (url === '/rooms' && method === 'POST') {
      return { ok: true, json: async () => roomFromBody(3, JSON.parse(opts.body)) }
    }
    if (url.startsWith('/rooms/') && method === 'PUT') {
      const id = Number(url.split('/').pop())
      return { ok: true, json: async () => roomFromBody(id, JSON.parse(opts.body)) }
    }
    if (url.startsWith('/rooms/') && method === 'DELETE') {
      return handlers.del ? handlers.del() : { ok: true, status: 200, json: async () => ({}) }
    }
    if (url === '/room-config' && method === 'POST') {
      return handlers.roomConfig ? handlers.roomConfig() : { ok: true, json: async () => ({}) }
    }
    throw new Error(`Unexpected fetch ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  confirmSpy.mockRestore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// CASE-023
// ---------------------------------------------------------------------------
describe('CASE-023: open a saved room', () => {
  it('shows Max Size, Fields and User Inputs for the clicked room', async () => {
    await openRoom('Room 1')

    expect(maxSizeRow()).toHaveTextContent('Max Size: 30')
    expect(section('Fields')).toHaveTextContent('Section: BSIT 4C, Subject: Math')
    expect(section('User Inputs')).toHaveTextContent('First Name, Last Name')
  })

  it('is read-only: no text boxes and no Save Customization button', async () => {
    await openRoom('Room 1')

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Customization' })).not.toBeInTheDocument()
    expect(btn('Customize')).toBeInTheDocument()
    expect(btn('Delete')).toBeInTheDocument()
    expect(btn(/Share Screen/)).toBeInTheDocument()
  })

  it('opens the room that was clicked, not another one', async () => {
    await openRoom('Room 2')

    expect(maxSizeRow()).toHaveTextContent('Max Size: 10')
    expect(section('Fields')).toHaveTextContent('Section: BSCS 2A')
    expect(section('User Inputs')).toHaveTextContent('Student ID')
    expect(heading('Room 1')).not.toBeInTheDocument()
  })

  it('shows the defaults for settings that were never set', async () => {
    existingRooms = [{ id: 5, label: 'Room 5', roomSize: '', fields: [], userInputs: [] }]
    await openRoom('Room 5')

    expect(maxSizeRow()).toHaveTextContent('Max Size: Not Set (Default 50)')
    expect(section('Fields')).toHaveTextContent('Not Set (Default logs)')
    expect(section('User Inputs')).toHaveTextContent('Not Set (Default Enter Name)')
  })

  it('shows an empty field value as an em dash', async () => {
    existingRooms = [{ ...ROOM_1, fields: [{ name: 'Section', value: '' }] }]
    await openRoom('Room 1')

    expect(section('Fields')).toHaveTextContent('Section: —')
  })

  it('sends no request just by opening a room', async () => {
    await openRoom('Room 1')

    expect(putCalls()).toHaveLength(0)
    expect(deleteCalls()).toHaveLength(0)
    expect(roomConfigCalls()).toHaveLength(0)
  })

  it('closes with the close icon and leaves the Saved Rooms list intact', async () => {
    const { user } = await openRoom('Room 1')

    await user.click(btn('Close modal'))

    expect(heading('Room 1')).not.toBeInTheDocument()
    expect(screen.getByText('Room 1')).toBeInTheDocument()
    expect(screen.getByText('Room 2')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// CASE-024
// ---------------------------------------------------------------------------
describe('CASE-024: Customize', () => {
  it('opens the customize form pre-filled with the saved settings', async () => {
    const { user } = await openRoom('Room 1')

    await user.click(btn('Customize'))

    expect(await screen.findByRole('heading', { name: 'Customize Room 1' })).toBeInTheDocument()
    expect(roomSizeInput()).toHaveValue('30')
    expect(fieldNames()).toEqual(['Section', 'Subject'])
    expect(fieldValues()).toEqual(['BSIT 4C', 'Math'])
    expect(inputNames()).toEqual(['First Name', 'Last Name'])
  })

  it('swaps Customize/Delete for Save Customization and keeps Share Screen', async () => {
    const { user } = await openRoom('Room 1')

    await user.click(btn('Customize'))

    expect(btn('Save Customization')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Customize' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(btn(/Share Screen/)).toBeInTheDocument()
  })

  it('does not send any request when the form opens', async () => {
    const { user } = await openRoom('Room 1')

    await user.click(btn('Customize'))

    expect(putCalls()).toHaveLength(0)
    expect(callsTo('/rooms', 'POST')).toHaveLength(0)
  })

  it('discards unsaved edits when the overlay is closed and reopened', async () => {
    const { user } = await openRoom('Room 1')
    await user.click(btn('Customize'))
    await user.clear(roomSizeInput())
    await user.type(roomSizeInput(), '12')

    await user.click(btn('Close modal'))
    await user.click(screen.getByText('Room 1'))

    expect(await screen.findByRole('heading', { name: 'Room 1' })).toBeInTheDocument()
    expect(maxSizeRow()).toHaveTextContent('Max Size: 30')
    expect(putCalls()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// CASE-025 (the app uses window.confirm, which is mocked here)
// ---------------------------------------------------------------------------
describe('CASE-025: Delete', () => {
  it('asks for confirmation and sends nothing until it is given', async () => {
    confirmSpy.mockReturnValue(false)
    const { user } = await openRoom('Room 1')

    await user.click(btn('Delete'))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy).toHaveBeenCalledWith('Delete this room? This cannot be undone.')
    expect(deleteCalls()).toHaveLength(0)
  })

  it('Cancel keeps the room, the list entry and the overlay', async () => {
    confirmSpy.mockReturnValue(false)
    const { user } = await openRoom('Room 1')

    await user.click(btn('Delete'))

    expect(heading('Room 1')).toBeInTheDocument()
    expect(screen.getAllByText('Room 1').length).toBeGreaterThanOrEqual(1)
    expect(btn('Delete')).toBeInTheDocument()
  })

  it('OK sends DELETE /rooms/:id, closes the overlay and removes only that room', async () => {
    const { user } = await openRoom('Room 1')

    await user.click(btn('Delete'))

    await waitFor(() => expect(deleteCalls()).toHaveLength(1))
    expect(deleteCalls()[0][0]).toBe('/rooms/1')
    await waitFor(() => expect(heading('Room 1')).not.toBeInTheDocument())
    expect(screen.queryByText('Room 1')).not.toBeInTheDocument()
    expect(screen.getByText('Room 2')).toBeInTheDocument()
  })

  it('shows the empty state after the last room is deleted', async () => {
    existingRooms = [ROOM_1]
    const { user } = await openRoom('Room 1')

    await user.click(btn('Delete'))

    expect(
      await screen.findByText('No saved rooms yet. Press Add Room to create one.')
    ).toBeInTheDocument()
  })

  it('treats a 404 as already deleted', async () => {
    handlers.del = () => ({ ok: false, status: 404, json: async () => ({}) })
    const { user } = await openRoom('Room 1')

    await user.click(btn('Delete'))

    await waitFor(() => expect(heading('Room 1')).not.toBeInTheDocument())
    expect(screen.queryByText('Room 1')).not.toBeInTheDocument()
  })

  it('keeps the room and shows an error when the server fails', async () => {
    handlers.del = () => ({ ok: false, status: 500, json: async () => ({}) })
    const { user } = await openRoom('Room 1')

    await user.click(btn('Delete'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the room.')
    expect(heading('Room 1')).toBeInTheDocument()
  })

  it('keeps the room and shows an error when the server is unreachable', async () => {
    handlers.del = () => {
      throw new TypeError('Failed to fetch')
    }
    const { user } = await openRoom('Room 1')

    await user.click(btn('Delete'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
    expect(heading('Room 1')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// CASE-026
// ---------------------------------------------------------------------------
describe('CASE-026: Share Screen from a room', () => {
  it("posts the room's settings to /room-config", async () => {
    const { user } = await openRoom('Room 1')

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(roomConfigCalls()).toHaveLength(1))
    const [url, opts] = roomConfigCalls()[0]
    expect(url).toBe('/room-config')
    expect(opts.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(lastBody(roomConfigCalls())).toEqual({
      user_inputs: ['First Name', 'Last Name'],
      fields: [
        { name: 'Section', value: 'BSIT 4C' },
        { name: 'Subject', value: 'Math' },
      ],
      room_size: 30,
    })
  })

  it('hands the room to onShareScreen after the config was sent, then closes the overlay', async () => {
    const { user, onShareScreen } = await openRoom('Room 1')

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(onShareScreen).toHaveBeenCalledTimes(1))
    expect(onShareScreen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, label: 'Room 1', roomSize: '30' })
    )
    const cfgIdx = fetchMock.mock.calls.findIndex(([u, o]) => u === '/room-config' && o?.method === 'POST')
    expect(fetchMock.mock.invocationCallOrder[cfgIdx]).toBeLessThan(
      onShareScreen.mock.invocationCallOrder[0]
    )
    await waitFor(() => expect(heading('Room 1')).not.toBeInTheDocument())
  })

  it('drops blank inputs and unnamed fields, trims values, and defaults the size to 50', async () => {
    existingRooms = [
      {
        id: 7,
        label: 'Room 7',
        roomSize: '',
        fields: [
          { name: 'Section', value: ' BSIT ' },
          { name: '   ', value: 'ignored' },
        ],
        userInputs: ['First Name', ' ', ''],
      },
    ]
    const { user } = await openRoom('Room 7')

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(roomConfigCalls()).toHaveLength(1))
    expect(lastBody(roomConfigCalls())).toEqual({
      user_inputs: ['First Name'],
      fields: [{ name: 'Section', value: 'BSIT' }],
      room_size: 50,
    })
  })

  it('uses the customized values after a save', async () => {
    const { user, onShareScreen } = await openRoom('Room 1')
    await user.click(btn('Customize'))
    const value = screen.getAllByPlaceholderText('Value')[0]
    await user.clear(value)
    await user.type(value, 'BSIT 4D')
    await user.click(btn('Save Customization'))
    await waitFor(() => expect(putCalls()).toHaveLength(1))
    await screen.findByText('Section: BSIT 4D, Subject: Math')

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(roomConfigCalls()).toHaveLength(1))
    expect(lastBody(roomConfigCalls()).fields[0]).toEqual({ name: 'Section', value: 'BSIT 4D' })
    expect(onShareScreen).toHaveBeenCalledTimes(1)
  })

  it('refuses to share while the form is still being customized', async () => {
    const { user, onShareScreen } = await openRoom('Room 1')
    await user.click(btn('Customize'))

    await user.click(btn(/Share Screen/))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Save your customization before sharing.'
    )
    expect(roomConfigCalls()).toHaveLength(0)
    expect(onShareScreen).not.toHaveBeenCalled()
    expect(heading('Customize Room 1')).toBeInTheDocument()
  })

  it('stays on the overlay and starts nothing when /room-config rejects the settings', async () => {
    handlers.roomConfig = () => ({ ok: false, status: 400, json: async () => ({}) })
    const { user, onShareScreen } = await openRoom('Room 1')

    await user.click(btn(/Share Screen/))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not send viewer fields to the server.'
    )
    expect(onShareScreen).not.toHaveBeenCalled()
    expect(heading('Room 1')).toBeInTheDocument()
  })

  it('stays on the overlay and starts nothing when the server is unreachable', async () => {
    handlers.roomConfig = () => {
      throw new TypeError('Failed to fetch')
    }
    const { user, onShareScreen } = await openRoom('Room 1')

    await user.click(btn(/Share Screen/))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not send viewer fields to the server.'
    )
    expect(onShareScreen).not.toHaveBeenCalled()
    expect(heading('Room 1')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// CASE-027 (written to the appendix: "Host remains on the overlay")
// ---------------------------------------------------------------------------
describe('CASE-027: cancel the screen-share dialog', () => {
  it('calls onShareScreen exactly once and creates no session by itself', async () => {
    // The browser dialog belongs to PresenterApp. Rooms only hands the room over.
    const { user, onShareScreen } = await openRoom('Room 1')

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(onShareScreen).toHaveBeenCalledTimes(1))
    expect(callsTo('/rooms', 'POST')).toHaveLength(0)
    expect(putCalls()).toHaveLength(0)
  })

  // DEFECT vs appendix. Rooms.handleShareScreen closes the overlay *before* it calls
  // onShareScreen and never looks at the result, so a cancelled dialog leaves the host on
  // the splash screen with the overlay gone. The appendix expects the overlay to remain.
  // Fix: in Rooms.jsx use
  //     const started = await onShareScreen(selectedRoom)
  //     if (started !== false) setIsModalOpen(false)
  // and make PresenterApp.startSharing return false when the dialog is denied or cancelled.
  // When that is done, this it.fails will start failing; change it to a plain it.
  it.fails('keeps the room overlay open when the share dialog is cancelled', async () => {
    const onShareScreen = vi.fn().mockResolvedValue(false) // false = cancelled / denied
    const { user } = await openRoom('Room 1', { onShareScreen })

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(onShareScreen).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByRole('heading', { name: 'Room 1' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// CASE-028
// ---------------------------------------------------------------------------
describe('CASE-028: Saved Rooms with no rooms', () => {
  it('shows the empty-state message', async () => {
    existingRooms = []
    await renderRooms()

    expect(
      await screen.findByText('No saved rooms yet. Press Add Room to create one.')
    ).toBeInTheDocument()
  })

  it('still offers Add Room, which opens the customize form', async () => {
    existingRooms = []
    const { user } = await renderRooms()
    await screen.findByText(/No saved rooms yet/)

    await user.click(btn(/^Add Room/))

    expect(await screen.findByText('Customize New Room')).toBeInTheDocument()
  })

  it('does not show the message while rooms are still loading', async () => {
    handlers.list = () => new Promise(() => { })
    await renderRooms()
    await waitFor(() => expect(loadLogs).toHaveBeenCalled())

    expect(screen.queryByText(/No saved rooms yet/)).not.toBeInTheDocument()
  })

  it('shows an error, not the empty message, when the list cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { })
    handlers.list = () => ({ ok: false, status: 500, json: async () => ({}) })
    await renderRooms()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved rooms.')
    expect(screen.queryByText(/No saved rooms yet/)).not.toBeInTheDocument()
  })

  it('treats a non-array response as no rooms', async () => {
    handlers.list = () => ({ ok: true, json: async () => ({ unexpected: true }) })
    await renderRooms()

    expect(await screen.findByText(/No saved rooms yet/)).toBeInTheDocument()
  })

  it('does not show the message when rooms exist', async () => {
    await renderRooms()
    await screen.findByText('Room 1')

    expect(screen.queryByText(/No saved rooms yet/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// CASE-029
// ---------------------------------------------------------------------------
describe('CASE-029: add a field and save', () => {
  it('saves the new field with POST /rooms and shows it in the details', async () => {
    existingRooms = []
    const { user } = await openNewRoom()

    await user.click(btn('Add Field'))
    const names = screen.getAllByPlaceholderText('Field Name')
    expect(names).toHaveLength(4)
    await user.type(names[3], 'Instructor')
    await user.type(screen.getAllByPlaceholderText('Value')[3], 'Cruz')
    await user.click(btn('Save Customization'))

    await waitFor(() => expect(callsTo('/rooms', 'POST')).toHaveLength(1))
    expect(lastBody(callsTo('/rooms', 'POST')).fields).toEqual([
      { name: 'Section', value: '' },
      { name: 'Subject', value: '' },
      { name: 'EDP Code', value: '' },
      { name: 'Instructor', value: 'Cruz' },
    ])
    expect(await screen.findByText(/Instructor: Cruz/)).toBeInTheDocument()
    expect(screen.getAllByText('Room 3').length).toBeGreaterThanOrEqual(2) // list entry + overlay heading
  })

  it('sends the new field to /room-config when the room is shared', async () => {
    existingRooms = []
    const { user, onShareScreen } = await openNewRoom()
    await user.click(btn('Add Field'))
    await user.type(screen.getAllByPlaceholderText('Field Name')[3], 'Instructor')
    await user.type(screen.getAllByPlaceholderText('Value')[3], 'Cruz')
    await user.click(btn('Save Customization'))
    await screen.findByText(/Instructor: Cruz/)

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(roomConfigCalls()).toHaveLength(1))
    expect(lastBody(roomConfigCalls()).fields).toContainEqual({ name: 'Instructor', value: 'Cruz' })
    expect(onShareScreen).toHaveBeenCalledTimes(1)
  })

  it('sends a newly added User Input to /room-config, which is what the join form reads', async () => {
    existingRooms = []
    const { user } = await openNewRoom()
    await user.click(btn('User Inputs'))
    const inputs = screen.getAllByPlaceholderText('Input Name')
    expect(inputs).toHaveLength(3)
    await user.type(inputs[2], 'Student ID')
    await user.click(btn('Save Customization'))
    await screen.findByText(/First Name, Last Name, Student ID/)

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(roomConfigCalls()).toHaveLength(1))
    expect(lastBody(roomConfigCalls()).user_inputs).toEqual(['First Name', 'Last Name', 'Student ID'])
  })

  it('updates an existing room with PUT when a field is added', async () => {
    const { user } = await openRoom('Room 1')
    await user.click(btn('Customize'))
    await user.click(btn('Add Field'))
    await user.type(screen.getAllByPlaceholderText('Field Name')[2], 'Instructor')

    await user.click(btn('Save Customization'))

    await waitFor(() => expect(putCalls()).toHaveLength(1))
    expect(putCalls()[0][0]).toBe('/rooms/1')
    expect(lastBody(putCalls()).fields).toEqual([
      { name: 'Section', value: 'BSIT 4C' },
      { name: 'Subject', value: 'Math' },
      { name: 'Instructor', value: '' },
    ])
  })
})

// ---------------------------------------------------------------------------
// CASE-030
// ---------------------------------------------------------------------------
describe('CASE-030: remove a field and save', () => {
  it('saves without the removed field and hides it in the details', async () => {
    const { user } = await openRoom('Room 1')
    await user.click(btn('Customize'))

    await user.click(removeIn(fieldCard(1)))
    expect(fieldNames()).toEqual(['Section'])
    await user.click(btn('Save Customization'))

    await waitFor(() => expect(putCalls()).toHaveLength(1))
    expect(putCalls()[0][0]).toBe('/rooms/1')
    expect(lastBody(putCalls()).fields).toEqual([{ name: 'Section', value: 'BSIT 4C' }])
    expect(await screen.findByText('Section: BSIT 4C')).toBeInTheDocument()
    expect(screen.queryByText(/Subject/)).not.toBeInTheDocument()
  })

  it('does not send the removed field to /room-config when the room is shared', async () => {
    const { user } = await openRoom('Room 1')
    await user.click(btn('Customize'))
    await user.click(removeIn(fieldCard(1)))
    await user.click(btn('Save Customization'))
    await screen.findByText('Section: BSIT 4C')

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(roomConfigCalls()).toHaveLength(1))
    expect(lastBody(roomConfigCalls()).fields).toEqual([{ name: 'Section', value: 'BSIT 4C' }])
  })

  it('does not send a removed User Input to /room-config, which is what the join form reads', async () => {
    const { user } = await openRoom('Room 1')
    await user.click(btn('Customize'))
    await user.click(removeIn(inputCard(1)))
    expect(inputNames()).toEqual(['First Name'])
    await user.click(btn('Save Customization'))
    await screen.findByText(/^First Name$/)

    await user.click(btn(/Share Screen/))

    await waitFor(() => expect(roomConfigCalls()).toHaveLength(1))
    expect(lastBody(roomConfigCalls()).user_inputs).toEqual(['First Name'])
  })

  it('shows the default text when every field is removed and saved', async () => {
    const { user } = await openRoom('Room 1')
    await user.click(btn('Customize'))
    await user.click(removeIn(fieldCard(1)))
    await user.click(removeIn(fieldCard(0)))

    await user.click(btn('Save Customization'))

    await waitFor(() => expect(putCalls()).toHaveLength(1))
    expect(lastBody(putCalls()).fields).toEqual([])
    expect(await screen.findByText('Not Set (Default logs)')).toBeInTheDocument()
  })
})