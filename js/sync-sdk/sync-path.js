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

var SyncPath = (function(window, undefined) {
	/**
	 * Construct a capture report from the array buffer.
	 *
	 * @param {ArrayBuffer} data
	 */
	function SyncPath() {

		var lineWidth
		var x1, x2, y1, y2

		function setLineWidth(width) {
			lineWidth = width
		}

		function moveTo(x, y) {
			x1 = x
			y1 = y
		}

		function lineTo(x, y) {
			x2 = x
			y2 = y
		}

		function getX1() {
			return x1
		}

		function getX2() {
			return x2
		}

		function getY1() {
			return y1
		}

		function getY2() {
			return y2
		}

		function getLineWidth() {
			return lineWidth
		}

		return {
			setLineWidth: setLineWidth,
			moveTo: moveTo,
			lineTo: lineTo,
			getX1: getX1,
			getY1: getY1,
			getX2: getX2,
			getY2: getY2,
			getLineWidth: getLineWidth
		}
	}

	return SyncPath

})(window)
