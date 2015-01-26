/*****************************************************************************
 Copyright © 2015 Kent Displays, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

var SyncStreamingManager = (function() {
  var instance = null
  var USB_PRODUCT_ID = 0x0100
  var USB_VENDOR_ID = 0x2914
  var BLUETOOTH_PRODUCT_ID = 0x0100
  var BLUETOOTH_VENDOR_ID = 0x00F3
  var CAPTURE_USAGE_PAGE = 0xFF00
  var CAPTURE_USAGE = 0x0000

  // revealing module pattern that handles initialization of our new module
  function initializeNewModule() {

    // Public

    /**
     * Possible states of the manager.
     */
    var states = {
      DISCONNECTED: 0,
      DISCONNECTING: 1,
      CONNECTING: 2,
      CONNECTED: 3
    }

    /**
     * Modes the sync can be put into for different uses.
     * None: Device will not send input reports.
     * Digitizer: Device will send digitizer input reports.
     * Capture: Device will send capture input reports.
     * File: Device will send capture input reports only when a file has
     * completed save.
     */
    var modes = {
      NONE: 0x01,
      DIGITIZER: 0x03,
      CAPTURE: 0x04,
      FILE: 0x05
    }

    /**
     * Returns the current state of the manager.
     */
    function getState() {
      return state
    }

    /**
     * Erases the display of the sync.
     */
    function erase() {
      var arrayBuffer = new ArrayBuffer(3)
      var array = new Uint8Array(arrayBuffer)
      array[0] = 4
      array[1] = 0
      array[2] = 1

      chrome.hid.sendFeatureReport(hidConnectionId, 4, arrayBuffer,
        function() {

        })
    }

    /**
     * Sets the current mode of the sync. Refers to modes.
     *
     * @param {integer} mode
     */
    function setMode(mode) {
      var arrayBuffer = new ArrayBuffer(3)
      var array = new Uint8Array(arrayBuffer)
      array[0] = 0x05
      array[1] = 0x00
      array[2] = mode

      chrome.hid.sendFeatureReport(hidConnectionId, 5, arrayBuffer,
        function() {})
    }

    /**
     * Adds an observer to listen for changes in states and reports.
     */
    function addObserver(observer) {
      observers.push(observer)
    }

    /**
     * Removes an observer that was listening.
     */
    function removeObserver(observer) {
      for (var i = 0, len = observers.length; i < len; i++) {
        if (observers[i] === observer) {
          observers.splice(i, 1)
          console.log('removed existing observer')
          return true
        }
      }
      return false
    }

    /**
     * Return the list of available devices.
     *
     * @return devices
     */
    function getDevices() {
      return _hidDevices.slice()
    }

    /**
     * Connect to the supplied device. If connection fails, manager is put back
     * into disconnected state.
     *
     * @param {int} deviceId
     */
    function connect(deviceId) {
      updateState(states.CONNECTING)
      chrome.hid.connect(deviceId, function(connection) {
        if (connection !== undefined) {
          updateState(states.CONNECTED)
          hidConnectionId = connection.connectionId

          // Set the mode for the Sync.
          setMode(modes.CAPTURE)

          // Start polling for any reports coming from the device.
          pollInputReports()
        } else {
          var errorMessage = chrome.runtime.lastError.message
          console.log(errorMessage)
          updateState(states.DISCONNECTED)
        }
      })
    }

    /**
     * Disconnect from the device.
     *
     * @param {int} deviceId
     */
    function disconnect(deviceId) {
      updateState(states.DISCONNECTING)
      chrome.hid.disconnect(deviceId, function(connection) {
        updateState(states.DISCONNECTED)
        hidConnectionId = undefined
      })
    }

    // Private
    var _apiAvailable = true
    var state = states.DISCONNECTED
    var hidConnectionId = undefined
    var _hidDevices = []
    var observers = []
    var syncFilter = new SyncFilter()

    function pollDevices() {
      var filters = [{
        vendorId: USB_VENDOR_ID,
        productId: USB_PRODUCT_ID,
        usagePage: CAPTURE_USAGE_PAGE,
        usage: CAPTURE_USAGE
      }, {
        vendorId: BLUETOOTH_VENDOR_ID,
        productId: BLUETOOTH_PRODUCT_ID,
        usagePage: CAPTURE_USAGE_PAGE,
        usage: CAPTURE_USAGE
      }]
      chrome.hid.getDevices({
        filters: filters
      }, function(devices) {
        var oldDevices = _hidDevices
        _hidDevices = devices

        // Compare the arrays to see if there are any updates.
        // TODO

        if (_hidDevices.length === 0) {
          hidConnectionId = undefined
          updateState(states.DISCONNECTED)
        }

        // Notify observer of updated devices.
        // TODO only do this when it actually changes.
        for (var index in observers) {
          var observer = observers[index]
          observer.updatedDevices()
        }

        setTimeout(pollDevices, 1000)
      })
    }

    /**
     * Updates the current state of the manager. Notifies observers as well.
     *
     * @param {integer} newState
     */
    function updateState(newState) {
      if (newState === state) return

      // Notify observers and update state.
      var oldState = state
      state = newState
      for (var index in observers) {
        var observer = observers[index]
        observer.stateChanged(oldState, state)
      }
    }

    /**
     * Poll for input reports coming from the Sync. Stops polling once the
     * connect is broken.
     */
    function pollInputReports() {
      if (state !== states.CONNECTED) return
      if (hidConnectionId === undefined) return

      chrome.hid.receive(hidConnectionId, function(reportId, data) {
        var captureReport = new SyncCaptureReport(data)

        // Send the observers the raw capture report and also filtered paths.
        for (var index in observers) {
          var observer = observers[index]
          observer.receivedSyncCaptureReport(captureReport)

          var paths = syncFilter.filterReport(captureReport)
          if (paths && paths.length) {
            observer.receivedPaths(paths)
          }
        }

        setTimeout(pollInputReports, 0)
      })
    }

    // Initialize
    pollDevices()

    return {
      getState: getState,
      getDevices: getDevices,
      states: states,
      modes: modes,
      setMode: setMode,
      erase: erase,
      addObserver: addObserver,
      removeObserver: removeObserver,
      connect: connect,
      disconnect: disconnect
    }
  }

  // handles the prevention of additional instantiations
  function getInstance() {
    // Check to see if the API is available before retrieving an instance.
    console.assert(_apiAvailable,
      'API is not available for this platform')

    if (!instance) {
      instance = new initializeNewModule()
    }
    return instance
  }

  // Check to see if the API is available by checking the platform and Chrome
  // version.
  var _apiAvailable = true
  chrome.runtime.getPlatformInfo(function(info) {
    // Currently, there is a "bug" with Chrome and allowing access to HID
    // devices that are registered as input devices.
    // Chromium issue:
    // https://code.google.com/p/chromium/issues/detail?id=443602
    if (info.os === 'cros') {
      _apiAvailable = false
    }
  })
  var appVersion = navigator.appVersion
  var chromeIndex = appVersion.indexOf('Chrome/')
  var chromeVersion = appVersion.slice(chromeIndex + 7, appVersion.indexOf(
    '.', chromeIndex)).valueOf()
  if (chromeVersion < 39) {
    _apiAvailable = false
  }

  var MAX_X = 20280.0
  var MAX_Y = 13942.0

  return {
    getInstance: getInstance,
    MAX_X: MAX_X,
    MAX_Y: MAX_Y
  }

})()
