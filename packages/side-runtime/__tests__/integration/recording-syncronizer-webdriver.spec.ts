// Licensed to the Software Freedom Conservancy (SFC) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The SFC licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { promisify } from 'util'
import { createHeadlessChrome } from '@seleniumhq/webdriver-testkit'
import { createStaticSite } from '@seleniumhq/side-testkit'
import Playback from '../../src/playback'
import Variables from '../../src/variables'
import WebDriverExecutor from '../../src/webdriver'
import createRecorderSyncronizerForWebdriverExecutor from '../../src/recording-syncronizer-webdriver'
import { AddressInfo } from 'net'
import { WindowFnInput } from '../../src/recording-syncronizer'

jest.setTimeout(30000)

describe('recording syncronizer webdriver', () => {
  const app = createStaticSite()
  let port, close, driver, executor, variables
  beforeAll(async () => {
    await new Promise((res) => {
      const server = app.listen(() => {
        port = (server.address() as AddressInfo).port
        close = promisify(server.close.bind(server))
        res(null)
      })
    })
  })
  afterEach(() => {
    executor.hooks = undefined
  })
  afterAll(async () => {
    await close()
  })
  beforeAll(async () => {
    variables = new Variables()
    driver = await createHeadlessChrome()
    executor = new WebDriverExecutor({ driver, implicitWait: 50 })
  })
  afterAll(async () => {
    await driver.quit()
  })
  afterEach(async () => {
    try {
      await driver.actions({ bridge: true }).clear()
    } catch (err) {
      // chromedriver doesn't support clear()
    }
  })

  it('should syncronize the current window with the recorder through hooks', async () => {
    const test = {
      id: '1',
      name: 'test',
      commands: [
        {
          id: 'a',
          command: 'open',
          target: '/windows.html',
          value: '',
        },
        {
          id: 'b',
          command: 'storeWindowHandle',
          target: 'current',
          value: '',
        },
      ],
    }
    await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
    const {
      hooks: { onStoreWindowHandle, onWindowAppeared, onWindowSwitched },
    } = createRecorderSyncronizerForWebdriverExecutor({
      executor,
      logger: console,
      sessionId: 'default',
    })
    const playback = new Playback({
      executor,
      variables,
      baseUrl: `http://localhost:${port}/`,
    } as unknown as any)
    // eslint-disable-next-line require-atomic-updates
    executor.hooks = {
      onStoreWindowHandle: async (input: WindowFnInput) => {
        await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
        return onStoreWindowHandle(input)
      },
      onWindowAppeared,
      onWindowSwitched: async (input: WindowFnInput) => {
        await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
        return onWindowSwitched(input)
      },
    }
    await (
      await playback.play(test)
    )()

    const { handleCalls } = await getPageScriptCalls(executor.driver)

    expect(handleCalls.length).toBe(1)
    expect(handleCalls[0].sessionId).toBe('default')
    expect(handleCalls[0].windowHandle).toBe('current')
  })

  it('should syncronize a new window with the recorder through hooks', async () => {
    const test = {
      id: '1',
      name: 'test',
      commands: [
        {
          id: 'a',
          command: 'open',
          target: '/windows.html',
          value: '',
        },
        {
          id: 'b',
          command: 'click',
          target: 'css=a',
          value: '',
          opensWindow: true,
          windowHandleName: 'new',
          windowTimeout: 200,
        },
        {
          id: 'c',
          command: 'selectWindow',
          target: 'handle=${new}',
          value: '',
        },
      ],
    }
    await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
    const {
      hooks: { onWindowAppeared, onWindowSwitched },
    } = createRecorderSyncronizerForWebdriverExecutor({
      executor,
      logger: console,
      sessionId: 'default',
    })
    const playback = new Playback({
      executor,
      variables,
      baseUrl: `http://localhost:${port}/`,
    } as unknown as any)
    // eslint-disable-next-line require-atomic-updates
    executor.hooks = {
      onWindowAppeared,
      onWindowSwitched: async (input: WindowFnInput) => {
        await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
        return onWindowSwitched(input)
      },
    }
    await (
      await playback.play(test)
    )()

    const { handleCalls } = await getPageScriptCalls(executor.driver)

    expect(handleCalls.length).toBe(1)
    expect(handleCalls[0].sessionId).toBe('default')
    expect(handleCalls[0].windowHandle).toBe('new')
  })

  it('should syncronize a new window with the recorder manually', async () => {
    const test = {
      id: '1',
      name: 'test',
      commands: [
        {
          id: 'a',
          command: 'open',
          target: '/windows.html',
          value: '',
        },
        {
          id: 'b',
          command: 'click',
          target: 'css=a',
          value: '',
          opensWindow: true,
          windowHandleName: 'new',
          windowTimeout: 200,
        },
      ],
    }
    await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
    const {
      hooks: { onWindowAppeared, onWindowSwitched },
      syncAllPendingWindows,
    } = createRecorderSyncronizerForWebdriverExecutor({
      executor,
      logger: console,
      sessionId: 'default',
    })
    const playback = new Playback({
      baseUrl: `http://localhost:${port}/`,
      executor,
      variables,
    } as unknown as any)
    // eslint-disable-next-line require-atomic-updates
    executor.hooks = {
      onWindowAppeared,
      onWindowSwitched: async (input: WindowFnInput) => {
        await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
        return onWindowSwitched(input)
      },
    }
    await (
      await playback.play(test)
    )()

    await executor.driver.switchTo().window(variables.get('new'))
    await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
    let { handleCalls } = await getPageScriptCalls(executor.driver)
    expect(handleCalls.length).toBe(0)

    await syncAllPendingWindows()

    await executor.driver.switchTo().window(variables.get('new'))
    handleCalls = (await getPageScriptCalls(executor.driver)).handleCalls

    expect(handleCalls.length).toBe(1)
    expect(handleCalls[0].sessionId).toBe('default')
    expect(handleCalls[0].windowHandle).toBe('new')
  })

  it('should syncronize a new window with the recorder through hooks', async () => {
    const test = {
      id: '1',
      name: 'test',
      commands: [
        {
          id: 'a',
          command: 'open',
          target: '/windows.html',
          value: '',
        },
      ],
    }
    await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
    const {
      hooks: { onWindowAppeared, onWindowSwitched },
    } = createRecorderSyncronizerForWebdriverExecutor({
      executor,
      logger: console,
      sessionId: 'default',
    })
    const playback = new Playback({
      baseUrl: `http://localhost:${port}/`,
      executor,
      variables,
    } as unknown as any)
    // eslint-disable-next-line require-atomic-updates
    executor.hooks = {
      onWindowAppeared,
      onWindowSwitched: async (input: WindowFnInput) => {
        await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)
        return onWindowSwitched(input)
      },
    }
    await (
      await playback.play(test)
    )()
    await executor.driver.executeScript(PAGE_SCRIPT_MOCK_JS)

    const { contextCalls } = await getPageScriptCalls(executor.driver)

    expect(contextCalls.length).toBe(1)
    expect(contextCalls[0].sessionId).toBe('default')
  })
})

async function getPageScriptCalls(driver) {
  return await driver.executeScript(
    'return {handleCalls: window.__side.handleCalls, contextCalls: window.__side.contextCalls}'
  )
}

const PAGE_SCRIPT_MOCK_JS = `window.__side = {
handleCalls: [],
contextCalls: [],
setWindowHandle: async (handle, sessionId) => {
window.__side.handleCalls.push({windowHandle: handle, sessionId})
return Promise.resolve()
},
setActiveContext: async sessionId => {
window.__side.contextCalls.push({sessionId})
return Promise.resolve()
},
}`
