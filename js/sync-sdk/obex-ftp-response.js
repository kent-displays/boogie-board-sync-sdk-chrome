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
 * Construct an OBEX FTP response from an array.
 *
 * @param {ArrayBuffer} data
 */
var OBEXFtpResponse = function(data) {
	this.data = data
	this.code = undefined
	this.length = data.length
	this.headers = {}
	this.flags = undefined
	this.version = undefined
	this.flags = undefined
	this.maximumSize = undefined

	// Parse the data.
	this.code = data[0]
	this.length = OBEXFtpUtils.arrayToLength(data.subarray(1, 3))

	if (this.length == 3) return

	var index = 3
	while (index < data.length) {
		var headerId = data[index]
		var headerBody = undefined

		// Must differentiate between different headers that have a length attribute
		// and ones that do not. Also, have to look out for a connection response.
		if (headerId == OBEXFtpHeader.ids.CONNECTION || headerId == OBEXFtpHeader.ids
			.LENGTH) {
			headerBody = data.subarray(index + 1, index + 5)
			index += 5
		} else if (headerId > OBEXFtpHeader.ids.DESCRIPTION && headerId <
			OBEXFtpHeader.ids.TYPE) {
			this.version = data[index]
			this.flag = data[index + 1]
			this.maximumSize = OBEXFtpUtils.arrayToLength(data.subarray(index + 2, index +
				4))
			index += 4
			continue
		} else {
			var headerLength = OBEXFtpUtils.arrayToLength(data.subarray(index + 1, index +
				3))
			headerBody = data.subarray(index + 3, index + headerLength)
			index += headerLength
		}

		this.headers[headerId] = new OBEXFtpHeader({
			id: headerId,
			body: headerBody
		})
	}
}

/**
 * Response codes.
 */
OBEXFtpResponse.codes = {
	CONTINUE: 0x90,
	SUCCESS: 0xA0,
	CREATED: 0xA1,
	ACCEPTED: 0xA2,
	MULTIPLE_CHOICES: 0xB0,
	MOVED_PERMANENTLY: 0xB1,
	MOVED_TEMPORARILY: 0xB2,
	SEE_OTHER: 0xB3,
	NOT_MODIFIED: 0xB4,
	USE_PROXY: 0xB5,
	BAD_REQUEST: 0xC0,
	UNAUTHORIZED: 0xC1,
	FORBIDDEN: 0xC3,
	NOT_FOUND: 0xC4,
	METHOD_NOT_ALLOWED: 0xC5,
	NOT_ACCEPTABLE: 0xC6,
	PROXY_AUTHENTICATION_REQUIRED: 0xC7,
	REQUEST_TIME_OUT: 0xC8,
	CONFLICT: 0xC9,
	GONE: 0xCA,
	LENGTH_REQUIRED: 0xCB,
	PRECONDITION_FAILED: 0xCC,
	REQUEST_ENTITY_TOO_LARGE: 0xCD,
	REQUEST_URL_TOO_LARGE: 0xCE,
	UNSUPPORTED_MEDIA_TYPE: 0xCF,
	INTERNAL_SERVER_ERROR: 0xD0,
	NOT_IMPLEMENTED: 0xD1,
	BAD_GATEWAY: 0xD2,
	SERVICE_UNAVAILABLE: 0xD3,
	GATEWAY_TIMEOUT: 0xD4,
	HTTP_VERSION_NOT_SUPPORTED: 0xD5,
	DATABASE_FULL: 0xE0,
	DATABASE_LOCKED: 0xE1,
}
