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

/**
 * Construct an OBEX FTP request from a request code.
 *
 * @param {Number} code
 */
var OBEXFtpRequest = function(code) {
  this.code = code
  this.headers = {}
  this.flags = OBEXFtpRequest.flags.DEFAULT
  this.constants = undefined
  this.length = 1
  this.data = undefined
}

/**
 * Request codes to be used when constructing a request.
 */
OBEXFtpRequest.codes = {
  CONNECT: 0x80,
  DISCONNECT: 0x81,
  PUT: 0x82,
  GET: 0x83,
  SET_PATH: 0x85,
  SESSION: 0x87,
  ABORT: 0xFF
}

/**
 * Flags.
 */
OBEXFtpRequest.flags = {
  DEFAULT: 0x00,
  BACKUP: 0x01,
  DONT_CREATE_FOLDER: 0x02
}

/** @type {Number} Implemented OBEX version. */
OBEXFtpRequest.VERSION = 0x10

/** @type {Number} Default constant. */
OBEXFtpRequest.DEFAULT_CONSTANT = 0x00

/** @type {Array} Maximum receiving packet size. */
OBEXFtpRequest.MAXIUMUM_SIZE = [0xFF, 0xDC]

/**
 * Calculates the length and resulting data.
 */
OBEXFtpRequest.prototype._updateData = function() {
  // Reset length
  this.length = 0

  // Add one for the operation code
  if (this.code) this.length += 1

  // Add two for the length of the packet
  this.length += 2

  // If the request code is CONNECT add 1 for version number, 1 for flags
  // and 2 for maximum packet size.
  if (this.code == OBEXFtpRequest.codes.CONNECT) this.length += 4

  // If the operation code is set path then add 1 for flags and 1 for
  // constants.
  if (this.code == OBEXFtpRequest.codes.SET_PATH) this.length += 2

  // Add the length of all the headers
  for (var index in this.headers) {
    var header = this.headers[index]
    this.length += header.length
  }

  // Create the data.
  this.data = new Uint8Array(this.length)

  // Add the request code.
  this.data[0] = this.code

  // Add the length of the request.
  var lengthArray = OBEXFtpUtils.lengthToArray(this.length)
  this.data[1] = lengthArray[0]
  this.data[2] = lengthArray[1]

  var index = 3

  // Add version number, flags and maximum packet size for CONNECT.
  if (this.code == OBEXFtpRequest.codes.CONNECT) {
    this.data[3] = OBEXFtpRequest.VERSION
    this.data[4] = OBEXFtpRequest.flags.DEFAULT
    this.data.set(OBEXFtpRequest.MAXIUMUM_SIZE, 5)
    index += 4
  } else if (this.code == OBEXFtpRequest.codes.SET_PATH) {
    this.data[3] = this.flags
    this.data[4] = this.constants
    index += 2
  }

  // Add all the header data.
  for (var key in this.headers) {
    var header = this.headers[key]
    this.data.set(header.data, index)
    index += header.data.length
  }
}

/**
 * Adds a OBEXFtpHeader to the response.
 *
 * @param {OBEXFtpHeader} header
 */
OBEXFtpRequest.prototype.addHeader = function(header) {
  this.headers[header.id] = header
  this._updateData()
}

OBEXFtpRequest.prototype.setFlags = function(flags) {
  this.flags = flags
  this._updateData()
}
