/**
 * Listens for the app launching then creates the window.
 *
 * @see http://developer.chrome.com/apps/app.runtime.html
 * @see http://developer.chrome.com/apps/app.window.html
 */
chrome.app.runtime.onLaunched.addListener(function(launchData) {

  // Center window on screen.
  var screenWidth = screen.availWidth
  var screenHeight = screen.availHeight
  var width = 740
  var height = 640

  chrome.app.window.create('build.html', {
    id: "syncMainWindow",
    innerBounds: {
      minWidth: width,
      maxWidth: width,
      minHeight: height,
      maxHeight: height,
      left: Math.round((screenWidth-width)/2),
      top: Math.round((screenHeight-height)/2)
    },
    outerBounds: {
    },
    resizable:false
  })
})
