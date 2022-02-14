import { CommandTypes } from '@seleniumhq/side-model/dist/Commands'
import badIndex from 'api/constants/badIndex'
import loadingID from 'api/constants/loadingID'
import { CommandsStateShape } from './command'

/**
 * State data is the data from the active IDE sessio that will not be persisted.
 * Playback state, breakpoints, status, whatever is from within a session
 */

export interface StateShape {
  activeCommandID: string
  activeSuiteID: string
  activeTestID: string
  breakpoints: string[]
  commands: CommandTypes
  status: 'idle' | 'paused' | 'playing' | 'recording'
  playback: {
    commands: CommandsStateShape;
    currentIndex: number
    currentTestIndex: number
    stopIndex: number
    tests: string[]
  }
}

export type Shape = StateShape
const action: StateShape = {
  activeCommandID: loadingID,
  activeSuiteID: loadingID,
  activeTestID: loadingID,
  breakpoints: [],
  commands: {},
  status: 'idle',
  playback: {
    commands: {},
    currentIndex: badIndex,
    currentTestIndex: 0,
    stopIndex: badIndex,
    tests: [],
  },
}

export default action