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

var SyncFileTransferManager = (function(window, undefined) {

  var instance = null

  /** @type {String} Bluetooth Profile UUID for OBEX Bluetooth FTP. */
  var BLUETOOTH_FTP_UUID = "00001106-0000-1000-8000-00805f9b34fb"

  /** @type {Array} OBEX FTP UUID for connecting. */
  var OBEX_FTP_UUID = [0xF9, 0xEC, 0x7B, 0xC4, 0x95, 0x3C, 0x11, 0xD2, 0x98,
    0x4E, 0x52, 0x54, 0x00, 0xDC, 0x9E, 0x09
  ]

  /** @type {Array} MIME type for folder listing (x-bluetooth/folder-listing") */
  var FOLDER_LISTING_TYPE = [0x78, 0x2D, 0x6F, 0x62, 0x65,
    0x78, 0x2F, 0x66, 0x6F, 0x6C, 0x64, 0x65, 0x72,
    0x2D, 0x6C, 0x69, 0x73, 0x74, 0x69, 0x6E, 0x67,
    0x00
  ]

  // revealing module pattern that handles initialization of our new module
  function initializeNewModule() {

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
     * Returns the current state of the manager.
     */
    function getState() {
      return _state
    }

    /**
     * Adds an observer to listen for changes in states and reports.
     */
    function addObserver(observer) {
      _observers.push(observer)
    }

    /**
     * Removes an observer that was listening.
     */
    function removeObserver(observer) {
      for (var i = 0, len = _observers.length; i < len; i++) {
        if (_observers[i] === observer) {
          _observers.splice(i, 1)
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
      return _bluetoothDevices.slice()
    }

    /**
     * Connect to the supplied device.
     *
     * @param {String} deviceAddress
     */
    function connect(deviceAddress) {
      console.assert(deviceAddress, 'device address must be valid')
      console.assert(_state === states.DISCONNECTED,
        'can only connect when not connected')

      _updateState(states.CONNECTING)
      chrome.bluetoothSocket.create(function(createInfo) {
        _bluetoothConnectionId = createInfo.socketId
        chrome.bluetoothSocket.connect(createInfo.socketId,
          deviceAddress,
          BLUETOOTH_FTP_UUID, _connectedCallback)
      })
    }

    /**
     * Disconnect from the supplied device.
     *
     * @param {String} deviceAddress
     */
    function disconnect(deviceAddress) {
      console.assert(deviceAddress, 'device address must be valid')
      console.assert(_state === states.CONNECTED,
        'can only disconnect when connected')

      _updateState(states.DISCONNECTING)
      _disconnectFromFtp(_bluetoothConnectionId)
    }

    /**
     * Request to list the current folder.
     *
     * @param {String} deviceAddress
     */
    function listFolder(deviceAddress) {
      console.assert(deviceAddress, 'device address must be valid')
      console.assert(_state === states.CONNECTED,
        'can only list folder when connected')

      var request = new OBEXFtpRequest(OBEXFtpRequest.codes.GET)
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.CONNECTION,
        body: _ftpConnectionId
      }))
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.NAME
      }))
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.TYPE,
        body: FOLDER_LISTING_TYPE
      }))

      _sendRequest(request, _bluetoothConnectionId)
    }

    /**
     * Request to change the current folder with a name of the folder.
     *
     * @param {String} deviceAddress
     * @param {String} name Name of the folder. If it is a blank string it will
     *                      change to the root folder. If it is '..' it will
     *                      change to the parent folder.
     */
    function changeFolder(deviceAddress, name) {
      console.assert(deviceAddress, 'device address must be valid')
      console.assert(name !== undefined, 'name must be valid')
      console.assert(_state === states.CONNECTED,
        'can only list folder when connected')

      var request = new OBEXFtpRequest(OBEXFtpRequest.codes.SET_PATH)
      request.constants = OBEXFtpRequest.DEFAULT_CONSTANT
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.CONNECTION,
        body: _ftpConnectionId
      }))
      if (name === '..') {
        request.setFlags(OBEXFtpRequest.flags.BACKUP | OBEXFtpRequest.flags
          .DONT_CREATE_FOLDER)
      } else if (name === '') {
        request.setFlags(OBEXFtpRequest.flags.DONT_CREATE_FOLDER)
        request.addHeader(new OBEXFtpHeader({
          id: OBEXFtpHeader.ids.NAME
        }))
      } else {
        request.setFlags(OBEXFtpRequest.flags.DONT_CREATE_FOLDER)
        request.addHeader(new OBEXFtpHeader({
          id: OBEXFtpHeader.ids.NAME,
          name: name
        }))
      }

      _sendRequest(request, _bluetoothConnectionId)
    }

    /**
     * Request a file with the supplied name.
     *
     * @param {String} deviceAddress
     * @param {[type]} name          Name of the file.
     */
    function getFile(deviceAddress, name) {
      console.assert(deviceAddress, 'device address must be valid')
      console.assert(name !== undefined, 'name must be valid')
      console.assert(_state === states.CONNECTED,
        'can only get file when connected')

      var request = new OBEXFtpRequest(OBEXFtpRequest.codes.GET)
      request.constants = OBEXFtpRequest.DEFAULT_CONSTANT
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.CONNECTION,
        body: _ftpConnectionId
      }))
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.NAME,
        name: name
      }))

      _sendRequest(request, _bluetoothConnectionId)
    }

		/**
     * Request delete file with the supplied name.
     *
     * @param {String} deviceAddress
     * @param {[type]} name          Name of the file.
     */
    function deleteFile(deviceAddress, name) {
      console.assert(deviceAddress, 'device address must be valid')
      console.assert(name !== undefined, 'name must be valid')
      console.assert(_state === states.CONNECTED,
        'can only get file when connected')

      var request = new OBEXFtpRequest(OBEXFtpRequest.codes.PUT)
      request.constants = OBEXFtpRequest.DEFAULT_CONSTANT
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.CONNECTION,
        body: _ftpConnectionId
      }))
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.NAME,
        name: name
      }))

      _sendRequest(request, _bluetoothConnectionId)
    }

    var _state = states.DISCONNECTED
    var _bluetoothConnectionId = undefined
    var _observers = []
    var _adapterIsOn = false
    var _bluetoothDevices = []
    var _ftpConnectionId = undefined
    var _lastRequest = undefined
    var _tempFolderListingArray = undefined
    var _currentFolderListing = undefined
    var _tempFile = undefined

    function _findDevices() {
      chrome.bluetooth.getDevices(function(devices) {
        for (var index in devices) {
          var device = devices[index]
            // Connect to a device if not connected already.
          if (_isValidDevice(device)) {
            _bluetoothDevices.push(device)
          }
        }

        // Notify observer of updated devices.
        // TODO only do this when it actually changes.
        for (var index in _observers) {
          var observer = _observers[index]
          observer.updatedDevices()
        }
      })
    }

    function _connectToFtp(connectionId) {
      // Create a connect request.
      var request = new OBEXFtpRequest(OBEXFtpRequest.codes.CONNECT)
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.TARGET,
        body: OBEX_FTP_UUID
      }))

      _sendRequest(request, connectionId)
    }

    function _disconnectFromFtp(connectionId) {
      // Create a disconnect request.
      var request = new OBEXFtpRequest(OBEXFtpRequest.codes.DISCONNECT)
      request.addHeader(new OBEXFtpHeader({
        id: OBEXFtpHeader.ids.CONNECTION,
        body: _ftpConnectionId
      }))

      _sendRequest(request, connectionId)
    }

    function _sendRequest(request, connectionId) {
      _lastRequest = request
      chrome.bluetoothSocket.send(connectionId, request.data.buffer,
        function(
          bytesSent) {
          if (chrome.runtime.lastError) {
            console.log('sending a connect request failed: ' +
              chrome.runtime
              .lastError.message)
            _lastRequest = undefined
          }
        })
    }

    function _closeSocket(connectionId) {
      chrome.bluetoothSocket.close(connectionId, function() {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError.message)
        }
        _updateState(states.DISCONNECTED)
        _ftpConnectionId = undefined
        _bluetoothConnectionId = undefined
      })
    }

    /*
		  BLUETOOTH SOCKET CALLBACKS.
		 */

    function _connectedCallback() {
      if (chrome.runtime.lastError) {
        console.log("Connection failed: " + chrome.runtime.lastError.message)
        _updateState(states.DISCONNECTED)
        _bluetoothConnectionId = undefined
      } else {
        // Connect to FTP.
        _connectToFtp(_bluetoothConnectionId)
      }
    }

    function _receiveErrorCallback(info) {
      if (info.error === 'disconnected') {
        _updateState(states.DISCONNECTED)
        _bluetoothConnectionId = undefined
      }

      console.log('received error callback: ' + info.error)
    }

    function _receiveCallback(info) {
      console.assert(_lastRequest, 'receiving response with no request')

      var response = new OBEXFtpResponse(new Uint8Array(info.data))
      var request = _lastRequest
      _lastRequest = undefined

      switch (response.code) {
        case OBEXFtpResponse.codes.SUCCESS:
          if (request.code == OBEXFtpRequest.codes.CONNECT) {
            _updateState(states.CONNECTED)
            _ftpConnectionId = response.headers[OBEXFtpHeader.ids.CONNECTION]
              .body
          } else if (request.code == OBEXFtpRequest.codes.DISCONNECT) {
            _closeSocket(_bluetoothConnectionId)
          } else if (request.code == OBEXFtpRequest.codes.SET_PATH) {
            // Notifiy observer.
            for (var index in _observers) {
              var observer = _observers[index]
              observer.changedFolder()
            }
          } else if (request.code == OBEXFtpRequest.codes.GET) {
            // Pull out the data from the response.
            var endOfBodyHeader = response.headers[OBEXFtpHeader.ids.END_OF_BODY]
            if (!endOfBodyHeader) {
              // TODO handle error
              _tempFolderListingArray = undefined
              _tempFile = undefined
              break
            }
            var data = endOfBodyHeader.body

            // Requested folder.
            if (request.headers[OBEXFtpHeader.ids.TYPE]) {
              if (_tempFolderListingArray === undefined) {
                _tempFolderListingArray = new Uint8Array(data)
              } else {
                var tmp = new Uint8Array(_tempFolderListingArray.length +
                  data.length)
                tmp.set(_tempFolderListingArray, 0)
                tmp.set(data, _tempFolderListingArray.length)
                _tempFolderListingArray = tmp
              }

              // Turn the byte array into a valid folder listing object.
              var _currentFolderListing = OBEXFtpUtils.parseXMLArray(
                _tempFolderListingArray)
              _tempFolderListingArray = undefined

              // Notifiy observer.
              for (var index in _observers) {
                var observer = _observers[index]
                observer.listedFolder(_.clone(_currentFolderListing))
              }
            }

            // Requested file.
            else {
              if (_tempFile === undefined) {
                _tempFile = new Uint8Array(data)
              } else {
                var tmp = new Uint8Array(_tempFile.length + data.length)
                tmp.set(_tempFile, 0)
                tmp.set(data, _tempFile.length)
                _tempFile = tmp
              }

							// Notifiy observer.
              for (var index in _observers) {
                var observer = _observers[index]
                observer.gotFile(_tempFile.subarray(0, _tempFile.length))
              }

							_tempFile = undefined
            }
          } else if (request.code == OBEXFtpRequest.codes.PUT) {
						var name = request.headers[OBEXFtpHeader.ids.NAME].name

						// Notifiy observer.
						for (var index in _observers) {
							var observer = _observers[index]
							observer.deletedFile(name)
						}
					}
          break
        case OBEXFtpResponse.codes.CONTINUE:
          if (request.code == OBEXFtpRequest.codes.GET) {
            // Pull out the data from the response.
            var bodyHeader = response.headers[OBEXFtpHeader.ids.BODY]
            if (!bodyHeader) {
              // TODO handle error
              _tempFolderListingArray = undefined
              _tempFile = undefined
              break
            }
            var data = bodyHeader.body

            // Requested folder.
            if (request.headers[OBEXFtpHeader.ids.TYPE]) {
              if (_tempFolderListingArray === undefined) {
                _tempFolderListingArray = new Uint8Array(data)
              } else {
                var tmp = new Uint8Array(_tempFolderListingArray.length +
                  data.length)
                tmp.set(_tempFolderListingArray, 0)
                tmp.set(data, _tempFolderListingArray.length)
                _tempFolderListingArray = tmp
              }
            }

            // Requested file.
            else {
              if (_tempFile === undefined) {
                _tempFile = new Uint8Array(data)
              } else {
                var tmp = new Uint8Array(_tempFile.length + data.length)
                tmp.set(_tempFile, 0)
                tmp.set(data, _tempFile.length)
                _tempFile = tmp
              }
            }

            // Send the next request to continue to get all the data or folder listing.
            _sendRequest(request, _bluetoothConnectionId)
          }
          break
        case OBEXFtpResponse.codes.SERVICE_UNAVAILABLE:
          console.log('service unavailable')
          break
        case OBEXFtpResponse.codes.FORBIDDEN:
          console.log('forbidden')
          break
        case OBEXFtpResponse.codes.NOT_FOUND:
          console.log('not found')
          break
        default:
          console.log('code not handled: ' + response.code)
      }
    }

    /**
     * Updates the current state of the manager. Notifies observers as well.
     *
     * @param {Number} newState
     */
    function _updateState(newState) {
      if (newState === _state) return

      // Notify observers and update state.
      var oldState = _state
      _state = newState
      for (var index in _observers) {
        var observer = _observers[index]
        observer.stateChanged(oldState, _state)
      }
    }

    /**
     * Checks to see if the passed device is a valid Boogie Board Sync.
     *
     * @param {BluetoothDeviceInfo} device
     *
     * @return {Boolean}
     */
    function _isValidDevice(device) {
      if (device === undefined) return false

      for (var index in device.uuids) {
        var uuid = device.uuids[index]

        if (uuid === BLUETOOTH_FTP_UUID && device.name === 'Sync') {
          return true
        }
      }

      return false
    }

    /*
		  BLUETOOTH CALLBACKS.
		 */

    function _adapterStateChanged(adapter) {
      if (adapter.powered != _adapterIsOn) {
        _adapterIsOn = adapter.powered
        if (_adapterIsOn) {
          _findDevices()
        }
      }
    }

    function _getAdapterState() {
      chrome.bluetooth.getAdapterState(function(adapter) {
        _adapterIsOn = adapter.powered
        if (_adapterIsOn) {
          _findDevices()
        }
      })
    }

    function _deviceAdded(device) {
      if (_isValidDevice(device)) {
        _bluetoothDevices.push(device)

        // Notify observer of updated devices.
        for (var index in _observers) {
          var observer = _observers[index]
          observer.updatedDevices()
        }
      }
    }

    function _deviceChanged(device) {
      if (_isValidDevice(device)) {
        if (_bluetoothDevices.indexOf(device) === -1) {
          _bluetoothDevices.push(device)

          // Notify observer of updated devices.
          for (var index in _observers) {
            var observer = _observers[index]
            observer.updatedDevices()
          }
        }
      }
    }

    function _deviceRemoved(device) {
      var index = _bluetoothDevices.indexOf(device)
      if (index > -1) {
        _bluetoothDevices.splice(index, 1)

        // Notify observer of updated devices.
        for (var index in _observers) {
          var observer = _observers[index]
          observer.updatedDevices()
        }
      }
    }

    chrome.bluetooth.onAdapterStateChanged.addListener(
      _adapterStateChanged)
    chrome.bluetooth.onDeviceAdded.addListener(_deviceAdded)
    chrome.bluetooth.onDeviceChanged.addListener(_deviceChanged)
    chrome.bluetooth.onDeviceRemoved.addListener(_deviceRemoved)

    chrome.bluetoothSocket.onReceiveError.removeListener(
      _receiveErrorCallback)
    chrome.bluetoothSocket.onReceive.addListener(_receiveCallback)

    // Initialize.
    _getAdapterState()

    return {
      getDevices: getDevices,
      connect: connect,
      disconnect: disconnect,
      getState: getState,
      states: states,
      addObserver: addObserver,
      removeObserver: removeObserver,
      listFolder: listFolder,
      changeFolder: changeFolder,
      getFile: getFile,
			deleteFile: deleteFile
    }
  }

  // handles the prevention of additional instantiations
  function getInstance() {
    if (!instance) {
      instance = new initializeNewModule()
    }
    return instance
  }

  return {
    getInstance: getInstance
  }

})(window)
