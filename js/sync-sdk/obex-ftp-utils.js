var OBEXFtpUtils = (function() {

  /**
   * Takes a number and returns an array of length two.
   *
   * @param {Number} length
   *
   * @return {Array} array
   */
  function lengthToArray(length) {
    var array = []
    array.push(length >> 8 & 0xFF)
    array.push(length & 0xFF)
    return array
  }

  /**
   * Takes an array of length two and returns the numerical value.
   *
   * @param {ArrayBuffer} array
   *
   * @return {Number} length
   */
  function arrayToLength(array) {
    var arrayView = new Uint8Array(array)
    return ((arrayView[0] << 8) + arrayView[1])
  }

  /**
   * Parses an xml array and returns the associated OBEX Folder Listing object.
   *
   * @param {Uint8Array} array
   *
   * @return {Object}
   */
  function parseXMLArray(array) {
    var folderListingString = String.fromCharCode.apply(null, array)
    var parser = new DOMParser()
    var doc = parser.parseFromString(folderListingString,
      'application/xml')

    var folderListing = {
      'folders': [],
      'files': []
    }

    // Get the folders.
    var folderElements = doc.getElementsByTagName('folder')
    for (var i = 0; i < folderElements.length; i++) {
      var folderElement = folderElements[i]
      var name = folderElement.getAttribute('name')
      var modified = folderElement.getAttribute('modified')
      folderListing.folders.push({
        name: name,
        modified: modified
      })
    }

    // Get the files.
    var fileElements = doc.getElementsByTagName('file')
    for (var i = 0; i < fileElements.length; i++) {
      var fileElement = fileElements[i]
      var name = fileElement.getAttribute('name')
      var modified = fileElement.getAttribute('modified')
			var size = fileElement.getAttribute('size')
      folderListing.files.push({
        name: name,
        modified: modified,
				size: size
      })
    }

    return folderListing
  }

  /**
   * Create an OBEX array for the supplied string. Used with NAME headers.
   *
   * @param {String} string
   *
   * @return {Array} array
   */
  function stringToArray(string) {
    var tmpString = new String(string + '\0')
    var array = new Uint8Array(tmpString.length * 2)
    for (var i = 0; i < array.length; i++) {
      if (i % 2 == 0) {
        array[i] = 0x00
      } else {
        array[i] = tmpString.charCodeAt(i / 2)
      }
    }

    return array
  }

  return {
    lengthToArray: lengthToArray,
    arrayToLength: arrayToLength,
    parseXMLArray: parseXMLArray,
    stringToArray: stringToArray
  }

})()
