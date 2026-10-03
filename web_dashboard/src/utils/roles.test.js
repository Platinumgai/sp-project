import { describe, it, expect } from 'vitest'
import {
  canViewOperations,
  canIssueCommands,
  canViewRoster,
  canViewStations,
  canViewAudit,
  canViewSettings,
  canEditSettings,
  isConstable,
} from './roles.js'

describe('canViewOperations (devices/alerts/recordings/commands domain)', () => {
  it('allows admin, control_room, station, constable', () => {
    expect(canViewOperations('admin')).toBe(true)
    expect(canViewOperations('control_room')).toBe(true)
    expect(canViewOperations('station')).toBe(true)
    expect(canViewOperations('constable')).toBe(true)
  })

  it('denies citizen -- matches require_role() exclusion in devices.py/commands.py/recordings.py/alerts.py', () => {
    expect(canViewOperations('citizen')).toBe(false)
  })

  it('denies unknown/undefined roles rather than defaulting to allow', () => {
    expect(canViewOperations(undefined)).toBe(false)
    expect(canViewOperations('not_a_real_role')).toBe(false)
  })
})

describe('canIssueCommands (remote control authorization)', () => {
  it('allows admin, control_room, station -- matches _authorize_command_issue in commands.py', () => {
    expect(canIssueCommands('admin')).toBe(true)
    expect(canIssueCommands('control_room')).toBe(true)
    expect(canIssueCommands('station')).toBe(true)
  })

  it('denies constable -- a constable never issues commands to their own device, only acknowledges/reports results', () => {
    expect(canIssueCommands('constable')).toBe(false)
  })

  it('denies citizen', () => {
    expect(canIssueCommands('citizen')).toBe(false)
  })
})

describe('isConstable', () => {
  it('is true only for the exact constable role string', () => {
    expect(isConstable('constable')).toBe(true)
    expect(isConstable('admin')).toBe(false)
    expect(isConstable(undefined)).toBe(false)
  })
})

describe('legacy-domain role gates remain intact (regression guard)', () => {
  it('canViewRoster / canViewStations / canViewAudit exclude constable and citizen', () => {
    for (const fn of [canViewRoster, canViewStations, canViewAudit]) {
      expect(fn('admin')).toBe(true)
      expect(fn('constable')).toBe(false)
      expect(fn('citizen')).toBe(false)
    }
  })

  it('canEditSettings is admin-only; canViewSettings additionally allows control_room', () => {
    expect(canEditSettings('admin')).toBe(true)
    expect(canEditSettings('control_room')).toBe(false)
    expect(canViewSettings('control_room')).toBe(true)
    expect(canViewSettings('station')).toBe(false)
  })
})
