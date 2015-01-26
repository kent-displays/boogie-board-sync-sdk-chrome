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

var SyncCaptureReport = (function(window, undefined) {
	/**
	 * Construct a capture report from the array buffer.
	 *
	 * @param {ArrayBuffer} data
	 */
	function SyncCaptureReport(data) {

		var array = new Uint8Array(data)
		var x = array[0] + (array[1] << 8)
		var y = array[2] + (array[3] << 8)
		var pressure = array[4] + (array[5] << 8)
		var flags = array[6]

		function getX() {
			return x
		}

		function getY() {
			return y
		}

		function getPressure() {
			return pressure
		}

		function getFlags() {
			return flags
		}

		return {
			getX: getX,
			getY: getY,
			getPressure: getPressure,
			getFlags: getFlags
		}
	}

	return SyncCaptureReport

})(window)
