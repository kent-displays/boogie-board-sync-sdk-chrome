# [Boogie Board Sync](http://www.myboogieboard.com/products/boogie-board-sync-9.html) SDK for Chrome

The software development kit provides a library for communicating with a Boogie Board Sync on the Chrome platform. This library allows developers to view, modify and retrieve aspects of the file system on the Sync. It also allows developers to retrieve real-time information including drawn paths, current position of the stylus and button presses.

This SDK uses the [```chrome.hid```](https://developer.chrome.com/apps/hid), [```chrome.bluetooth```](https://developer.chrome.com/apps/bluetooth) and [```chrome.bluetoothSocket```](https://developer.chrome.com/apps/bluetoothSocket) APIs provided by Google in Chrome.

__Note: Using this SDK only works in Chrome either as an [app](https://developer.chrome.com/apps/about_apps) or [extension](https://developer.chrome.com/extensions/index).__

- [Installing](#installing)
- [Sample App](#example-app)
- [Structure](#structure)
- [Limitations](#limitations)
- [Questions?](#questions)
- [License](#license)

## Installing

1. You can install the SDK by including the JavaScript files in the ```js/sync-sdk```.
2. Inside of your Chrome app or extension, the ```manifest.json``` file must include the following:

  ```
  "permissions" : [
  "hid",
  {
    "usbDevices": [ { "vendorId": 10516, "productId": 256 }, { "vendorId": 243, "productId": 256 } ]
  }
  ],
  "bluetooth" : {
    "uuids": [ "d6a56f80-88f8-11e3-baa8-0800200c9a66", "d6a56f81-88f8-11e3-baa8-0800200c9a66", "1106", "1124" ],
    "socket": true
  }
  ```

## Example App

If you would like to run/edit the included example app, first install all the node modules with npm. If you don't have npm follow the instructions [here](http://blog.npmjs.org/post/85484771375/how-to-install-npm).

```
npm install
```

Install [Grunt](http://gruntjs.com/) globally and run the associated task with the project. This task makes all the code CSP compliant more info [here](https://developer.chrome.com/extensions/contentSecurityPolicy).

```
npm install -g grunt-cli
grunt
```

Then, load the app by following [these instructions](https://developer.chrome.com/apps/first_app#load) from inside of Chrome.

## Structure

This is a quick overview on how the entire library and API are structured for use. __Highly recommend reading this before starting.__

For in depth use, check out the polymer elements of the example project located under the ```elements``` folder.

### SyncFileTransferManager

Facilitates the communication with a Boogie Board Sync through a file transfer protocol based on OBEX File Transfer. The use of this client allows for files to be downloaded, deleted, traversed and listed on a Sync. The connection must first be made to the file transfer server before executing any other requests.

### SyncStreamingManager

Facilitates communication with a Boogie Board Sync through a custom data capture protocol based on HID. The use of this client allows for real time information including drawn paths, button pushes and position of the stylus.

### Observer

This SDK uses the Obsever design pattern to inform the developer when calls to the Boogie Board Sync complete or a state change occurs.  Background about the design pattern can be found [here](https://carldanley.com/js-observer-pattern/).

## Limitations

- Chrome >=37 is required for ```SyncFileTransferManager```
- ```SyncFileTransferManager``` only works with Bluetooth connection
- Chrome >=39 is required for ```SyncStreamingManager```
- The ```SyncStreamingManager``` does not work on Chrome OS. This is due to the ```chrome.hid``` API not giving proper access to input devices. [Chromium Issue](https://code.google.com/p/chromium/issues/detail?id=443602)
- The ```SyncStreamingManager``` does not work on OS X when there is an Apple Magic Mouse connected. [Chromium Issue](https://code.google.com/p/chromium/issues/detail?id=452172)

## Questions?

For questions or comments email or contact us on Twitter

- [cfullmer@kentdisplays.com](mailto:cfullmer@kentdisplays.com)
- [@camdenfullmer](http://twitter.com/camdenfullmer)

## License

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
