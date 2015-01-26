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

var SyncFilter = (function(window, undefined) {

	function SyncFilter() {

		var states = {
			NO_POINTS: 0,
			ONE_POINT: 1,
			MULTIPLE_POINTS: 2
		}

		var state = states.NO_POINTS
		var TSW_FLAG = 0x01
		var RDY_FLAG = 0x01 << 2
		var DISTANCE_THRESHOLD_SQUARED = (10 * 10)
		var filter = new DynamicFilter()
		var oldLineWidth = -1.0
		var lastReport

		/**
		 * Filters sync capture reports and returns an array of paths.
		 *
		 * @param {SyncCaptureReport} report
		 *
		 * @return {Array}
		 */
		function filterReport(report) {
			var lineWidth
			var distSquared
			var velAvg, pressAvg
			var i
			var paths = []

			switch (state) {
				case states.NO_POINTS:
					if ((report.getFlags() & (RDY_FLAG + TSW_FLAG)) == (RDY_FLAG +
							TSW_FLAG)) {
						// Have first point.
						state = states.ONE_POINT

						// Init the dynamic filter.
						setFilterPosition(filter, report)

						//Reset file for line width.
						resetLineWidthFilter()
					}
					break
				case states.ONE_POINT:
					if ((report.getFlags() & (RDY_FLAG + TSW_FLAG)) == (RDY_FLAG +
							TSW_FLAG)) {
						// Apply filter and get distance**2 of filtered position from last rendered position.
						distSquared = applyFilter(filter, report)

						// Render new position to PDF if sufficiently far from last rendered position.
						if (distSquared >= DISTANCE_THRESHOLD_SQUARED) {
							state = states.MULTIPLE_POINTS

							// Compute/draw the first segment of the trace to PDF.
							velAvg = Math.sqrt(distSquared) / filter.time
							pressAvg = (filter.last.pressure + filter.current.pressure) / 2
							lineWidth = computeLineWidth(velAvg, pressAvg);

							paths.push(createPathWithLineWidth(lineWidth))

							// Reset "last" point for filter.
							setLastFilter(filter)
						}
					} else {
						// Set up the state for the single point.
						state = states.NO_POINTS
						velAvg = -1.0
						pressAvg = filter.current.pressure
						lineWidth = computeLineWidth(velAvg, pressAvg)

						// Add path.
						paths.push(createPathWithLineWidth(lineWidth))
					}
					break
				case states.MULTIPLE_POINTS:
					if ((report.getFlags() & (RDY_FLAG + TSW_FLAG)) == (RDY_FLAG +
							TSW_FLAG)) {
						// Apply filter and get distance**2 of filtered position from last rendered position.
						distSquared = applyFilter(filter, report)

						// Render new position to PDF if sufficiently far from last rendered position.
						if (distSquared >= DISTANCE_THRESHOLD_SQUARED) {
							state = states.MULTIPLE_POINTS

							// Compute/draw the first segment of the trace to PDF.
							velAvg = Math.sqrt(distSquared) / filter.time
							pressAvg = (filter.last.pressure + filter.current.pressure) / 2
							lineWidth = computeLineWidth(velAvg, pressAvg);

							paths.push(createPathWithLineWidth(lineWidth))

							// Reset "last" point for filter.
							setLastFilter(filter)
						}
					} else {
						state = states.NO_POINTS

						// Will use fixed (current) velocity to compute line width during final convergence
						// to prevent artificial blobbing at the end of traces (due to artificial slowdown
						// induced by repeating final digitizer coordinate).
						velAvg = Math.sqrt(filter.velocity.x * filter.velocity.x + filter.velocity
							.y * filter.velocity.y);

						// Provide filter final coordinate multiple times to converge on pen up point.
						for (var i = 0; i < 4; i++) {
							// Apply filter and get distance**2 of filtered position from last rendered position.
							distSquared = applyFilter(filter, lastReport)

							// Render new position to PDF if sufficiently far from last rendered position.
							if (distSquared >= DISTANCE_THRESHOLD_SQUARED) {
								// Compute line width.
								pressAvg = (filter.last.pressure + filter.current.pressure) / 2
								lineWidth = computeLineWidth(velAvg, pressAvg)

								paths.push(createPathWithLineWidth(lineWidth))

								// Reset "last" point for filter.
								setLastFilter(filter)
							}
						}
					}
					break
			}

			// Store coordinate for finalizing trace at pen up.
			lastReport = report
			return paths
		}

		/**
		 * Clears line width filter for start of a new trace.
		 */
		function resetLineWidthFilter() {
			oldLineWidth = -1.0
		}

		/**
		 * Initializes a provided dynamic filter with the first point in a trace.
		 *
		 * @param {Filter} filter
		 * @param {SyncCaptureReport} report
		 */
		function setFilterPosition(filter, report) {
			filter.last.x = filter.current.x = report.getX()
			filter.last.y = filter.current.y = report.getY()
			filter.last.pressure = filter.current.pressure = report.getPressure()
			filter.velocity.x = filter.velocity.y = filter.velocity.pressure = 0
			filter.time = 0;
		}

		/**
		 * Notifies a provided dynamic filter that a new segment has been drawn.
		 *
		 * @param {Filter} filter
		 */
		function setLastFilter(filter) {
			filter.last.x = filter.current.x;
			filter.last.y = filter.current.y;
			filter.last.pressure = filter.current.pressure;
			filter.time = 0;
		}

		// Dynamic filter Proportional and Derivative controller gains
		// (includes effects of mass and sample time (K*T/mass)).
		var KPP = 1229 // 1229/8192 = 0.1500 ~0.15f
		var KDD = 4915 // 4915/8192 = 0.6000 ~0.6f

		/**
		 * Updates dynamic filter state based on new reference coordinate.
		 *
		 * @param {Filter} filter
		 * @param {SyncCaptureReport} report
		 *
		 * @return dist_sq
		 */
		function applyFilter(filter, report) {
			var ax, ay, ap
			var dist_sq

			// Update delta time (samples) since last segment drawn (threshold met).
			if (filter.time < 255)
				filter.time++

				// Calculate 8192 (= 2^13) x acceleration.
				ax = KPP * (report.getX() - filter.current.x) - KDD * filter.velocity.x
			ay = KPP * (report.getY() - filter.current.y) - KDD * filter.velocity.y
			ap = KPP * (report.getPressure() - filter.current.pressure) - KDD *
				filter.velocity.pressure

			// Calculate new position.
			filter.current.x += filter.velocity.x
			filter.current.y += filter.velocity.y
			filter.current.pressure += filter.velocity.pressure

			// Calculate new velocity.
			filter.velocity.x = ((filter.velocity.x << 13) + ax) >> 13
			filter.velocity.y = ((filter.velocity.y << 13) + ay) >> 13
			filter.velocity.pressure = ((filter.velocity.pressure << 13) + ap) >> 13

			// Calculate squared distance of current point from "last" point.
			dist_sq = ((filter.current.x - filter.last.x) * (filter.current.x -
				filter.last.x) + (filter.current.y - filter.last.y) * (filter.current
				.y - filter.last.y))

			return dist_sq
		}

		/**
		 * Convert stylus pressure/speed into a line width value expressed in digitizer units. If vel < 0, the stylus was lifted after a single contact
		 * point.
		 *
		 * @param vel        velocity expressed in digitizer units per sample interval
		 * @param pressure   digitizer pressure reading
		 *
		 * @return lineWidth
		 */
		function computeLineWidth(vel, pressure) {
			var i, j
			var dist
			var lwa, lwb, lw

			// Compute distance btw. successive samples in digitizer units.
			if (vel < 0) dist = velocityToDistance(75.0) // Don't know real speed if only have one point => Assume a mid-level.
			else dist = vel

			// Saturate distance at range we have data for.
			if (dist < lineWidthMapArray[0].distance) dist = lineWidthMapArray[0].distance
			else if (dist > lineWidthMapArray[lineWidthMapArray.length - 1].distance)
				dist = lineWidthMapArray[lineWidthMapArray.length - 1].distance

			// Saturate pressure at range we have data for.
			if (pressure < mass[0]) pressure = mass[0]
			else if (pressure > mass[mass.length - 1]) pressure = mass[mass.length -
				1]

			// Find the indices for distance (velocity).
			for (var i = 1; i < lineWidthMapArray.length; i++) {
				if (dist <= lineWidthMapArray[i].distance) break
			}

			// Find the indices for mass (pressure).
			for (j = 1; i < mass.length; j++) {
				if (pressure <= mass[j]) break
			}

			// Interpolate based on mass (pressure) first.
			lwa = lineWidthMapArray[i - 1].lineWidth[j - 1] + (pressure - mass[j - 1]) *
				(lineWidthMapArray[i - 1].lineWidth[j] - lineWidthMapArray[i - 1].lineWidth[
					j - 1]) / (mass[j] - mass[j - 1])
			lwb = lineWidthMapArray[i].lineWidth[j - 1] + (pressure - mass[j - 1]) *
				(lineWidthMapArray[i].lineWidth[j] - lineWidthMapArray[i].lineWidth[j -
					1]) / (mass[j] - mass[j - 1])

			// Interpolate based on speed (distance) second.
			lw = lwa + (dist - lineWidthMapArray[i - 1].distance) * (lwb - lwa) / (
				lineWidthMapArray[i].distance - lineWidthMapArray[i - 1].distance)

			// Initialize filter if needed.
			// (The max value helps eliminate ink blobs at the start of traces due to impact pressures and/or low speeds.)
			if (oldLineWidth < 0) oldLineWidth = (lw > 45.0 ? 45.0 : lw)

			//  Filter A:  (LW changes too quickly for close samples and too slowly for far samples.)
			//  lw = (lw + 7*oldLW)/8;

			//  Filter B:
			//  if (dist <= oldLW)
			//    {
			//      lw = 0.1*lw + 0.9*oldLW;
			//    }
			//  else if (dist <= 5*oldLW)
			//    {
			//      float alpha = 0.1 + 0.9*(dist-oldLW)/(4*oldLW);
			//      lw = alpha*lw + (1 - alpha)*oldLW;
			//    }

			//  Filter C:  ** Seems to perform the best.
			lw = (2 * dist * lw + oldLineWidth * oldLineWidth) / (2 * dist +
				oldLineWidth)

			//  Filter D:
			//  lw = (2*dist + oldLW)/(2*dist + lw)*lw;

			// Remember last linewidth for filtering.
			oldLineWidth = lw

			// Store the line width.
			return lw
		}

		/**
		 * Creates a path object with the specified line width connected to the previous path.
		 *
		 * @param lineWidth
		 *
		 * @return path
		 */
		function createPathWithLineWidth(lineWidth) {
			var path = new SyncPath()
			path.moveTo(filter.last.x, filter.last.y)
			path.setLineWidth(lineWidth)
			path.lineTo(filter.current.x, filter.current.y)
			return path
		}

		// Digitizer resolution is 0.01 mm.
		var TICKS_PER_MM = 100
			// 144.425 samples per second
		var MS_PER_SAMPLE = 6.924
			// Assuming stylus held at 30 deg angle.
		var PEN_ANGLE_COS = 0.866
			// Scale factor for reported linewidth (to make recorded lines sharper than actual device).
		var SCALE = 0.75

		// Array of digitizer pressure readings for which line widths are provided.
		var mass = [massToPressure(10.0), massToPressure(25.0), massToPressure(
				50.0), massToPressure(100.0),
			massToPressure(150.0), massToPressure(200.0), massToPressure(250.0),
			massToPressure(300.0), massToPressure(350.0),
			massToPressure(400.0), massToPressure(450.0), massToPressure(500.0),
			massToPressure(550.0), massToPressure(600.0)
		]

		// Array of line widths vs. pressure at various velocities.
		var lineWidthMapArray = [
			//   v(mm/s)       10g*               25g*               50g               100g               150g               200g
			//     250g               300g               350g               400g               450g               500g               550g*
			//             600g*
			new LineWidthMap(velocityToDistance(1.0), [mmToDigitizer(0.720000),
				mmToDigitizer(0.800000),
				mmToDigitizer(0.908937), mmToDigitizer(1.108957), mmToDigitizer(
					1.266351), mmToDigitizer(1.388042),
				mmToDigitizer(1.462073), mmToDigitizer(1.540000), mmToDigitizer(
					1.618852), mmToDigitizer(1.701938),
				mmToDigitizer(1.793265), mmToDigitizer(1.860000), mmToDigitizer(
					1.920000), mmToDigitizer(1.954108)
			]),
			new LineWidthMap(velocityToDistance(5.0), [mmToDigitizer(0.490000),
				mmToDigitizer(0.530000),
				mmToDigitizer(0.614119), mmToDigitizer(0.758321), mmToDigitizer(
					0.868824), mmToDigitizer(0.910000),
				mmToDigitizer(0.942034), mmToDigitizer(1.000218), mmToDigitizer(
					1.047881), mmToDigitizer(1.083052),
				mmToDigitizer(1.155148), mmToDigitizer(1.196536), mmToDigitizer(
					1.250000), mmToDigitizer(1.286546)
			]),
			new LineWidthMap(velocityToDistance(30.0), [mmToDigitizer(0.300000),
				mmToDigitizer(0.340000),
				mmToDigitizer(0.387672), mmToDigitizer(0.493372), mmToDigitizer(
					0.565948), mmToDigitizer(0.620261),
				mmToDigitizer(0.673648), mmToDigitizer(0.710716), mmToDigitizer(
					0.746997), mmToDigitizer(0.777846),
				mmToDigitizer(0.815101), mmToDigitizer(0.837235), mmToDigitizer(
					0.880000), mmToDigitizer(0.926857)
			]),
			new LineWidthMap(velocityToDistance(75.0), [mmToDigitizer(0.290000),
				mmToDigitizer(0.295000),
				mmToDigitizer(0.320000), mmToDigitizer(0.374948), mmToDigitizer(
					0.422921), mmToDigitizer(0.473530),
				mmToDigitizer(0.508386), mmToDigitizer(0.541358), mmToDigitizer(
					0.577623), mmToDigitizer(0.600577),
				mmToDigitizer(0.621771), mmToDigitizer(0.651861), mmToDigitizer(
					0.670000), mmToDigitizer(0.690000)
			]),
			new LineWidthMap(velocityToDistance(100.0), [mmToDigitizer(0.280000),
				mmToDigitizer(0.290000),
				mmToDigitizer(0.302881), mmToDigitizer(0.338898), mmToDigitizer(
					0.387231), mmToDigitizer(0.433664),
				mmToDigitizer(0.452389), mmToDigitizer(0.482745), mmToDigitizer(
					0.516970), mmToDigitizer(0.534589),
				mmToDigitizer(0.557370), mmToDigitizer(0.581577), mmToDigitizer(
					0.610000), mmToDigitizer(0.620000)
			]),
			new LineWidthMap(velocityToDistance(180.0), [mmToDigitizer(0.250000),
				mmToDigitizer(0.260000),
				mmToDigitizer(0.280375), mmToDigitizer(0.311056), mmToDigitizer(
					0.362906), mmToDigitizer(0.390511),
				mmToDigitizer(0.414745), mmToDigitizer(0.436406), mmToDigitizer(
					0.463840), mmToDigitizer(0.478165),
				mmToDigitizer(0.501515), mmToDigitizer(0.521805), mmToDigitizer(
					0.540000), mmToDigitizer(0.550000)
			])
		]

		/**
		 * Convert from velocity in mm/s to distance (in digitizer units) between successive samples.
		 *
		 * @param velocity
		 * @return
		 */
		function velocityToDistance(velocity) {
			return ((velocity) * TICKS_PER_MM * MS_PER_SAMPLE / 1000)
		}

		/**
		 * Convert from line width expressed in mm to scaled line width expressed in digitizer units.
		 *
		 * @param mm
		 * @return
		 */
		function mmToDigitizer(mm) {
			return ((mm) * TICKS_PER_MM * SCALE)
		}

		/**
		 * Convert from mass in grams (normal to surface) to corresponding digitizer pressure reading (along stylus).
		 *
		 * @param mass
		 * @return
		 */
		function massToPressure(mass) {
			return ((mass) * PEN_ANGLE_COS * 1023.0 / 600.0 + 0.5)
		}

		function DynamicFilter() {
			this.last = new Coordinate()
			this.current = new Coordinate()
			this.velocity = new Coordinate()
			this.time = 0
		}

		function LineWidthMap(distance, lineWidth) {
			this.distance = distance // In digitizer units (speed ~ distance between consecutive points).
			this.lineWidth = lineWidth // In digitizer units.
		}

		function Coordinate() {
			this.x = 0
			this.y = 0
			this.pressure = 0
		}

		return {
			filterReport: filterReport
		}
	}

	return SyncFilter

})(window)
