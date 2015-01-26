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
 * Construct an OBEX FTP header with given arguments.
 *
 * @param {Object} args
 */
var OBEXFtpHeader = function(args) {
	console.assert(args.id, 'must supply id')

	this.id = args.id
	this.body = args.body
	this.name = args.name
	this.data = undefined

	// Normalize any passed body or name.
	if (this.body && typeof(this.body) === 'number') {
		this.body = [0x00, 0x00, 0x00, this.body]
	} else if (this.name && typeof(this.name) === 'string') {
		this.body = OBEXFtpUtils.stringToArray(this.name)
	}

	// This is needed so when all the lengths are added together the length
	// of the connection id is 5.
	if (this.id == OBEXFtpHeader.ids.CONNECTION) {
		this.length = 5
	} else {
		// Add 3 for id and 2 bytes for length
		this.length = 3
		if (this.body && this.body !== '') this.length += this.body.length
	}

	// Create the data.
	var index = 0
	this.data = new Uint8Array(this.length)
	this.data[0] = this.id
	index += 1

	// The CONNECTION id doesn't need a length, always the same size.
	if (this.id !== OBEXFtpHeader.ids.CONNECTION) {
		var lengthArray = OBEXFtpUtils.lengthToArray(this.length)
		this.data[1] = lengthArray[0]
		this.data[2] = lengthArray[1]
		index += 2
	}

	if (this.body !== undefined && this.body !== '') {
		this.data.set(this.body, index)
	}
}

/**
 * Ids to be used when constructing a header.
 */
OBEXFtpHeader.ids = {
	NAME: 0x01,
	DESCRIPTION: 0x05,
	TYPE: 0x42,
	TARGET: 0x46,
	BODY: 0x48,
	END_OF_BODY: 0x49,
	WHO: 0x4A,
	LENGTH: 0xC3,
	CONNECTION: 0xCB
}

OBEXFtpHeader.prototype = function() {
	return {}
}()
