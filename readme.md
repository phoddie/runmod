# Building and Installing JavaScript Mods
#### Copyright 2019, Moddable Tech Inc.
#### Updated May 29, 2019

This project is a simple example of how to install and run mods (e.g. JavaScript modules) on a ESP8266 and ESP32 microcontrollers using the [Moddable SDK](https://github.com/Moddable-OpenSource/moddable). The project has two parts: the host application and the mods.

> **Note**: This document discusses experimental features of the Moddable SDK. The intended audience is developers of tools interested in exploring the potential of we browser-hosted tools for JavaScript on microcontrollers. It describes how to deploy pre-compiled JavaScript modules to a microcontroller and how to communicate with a microcontroller for debugging. 

The host application is the base firmware for the microcontroller. It is the built-in software that defines the behavior of the device and is available for mods to use. When writing JavaScript for a web page, the browser is the host. When writing JavaScript for a server, Node.js is the host. The `runmod` host contains the XS JavaScript virtual machine, an HTTP client and server, a WebSocket client and server, and the device firmware for the ESP8266, including Wi-Fi networking. The host is approximately 700 KB, leaving about 350 KB of space for mods.

The JavaScript source code of mods is compiled to byte-code on a development machine, not the microcontroller. The XS Compiler (xsc) and XS Linker (xsl)  compile and link the modules to be installed into an XS Archive file, which can contain one or more modules. The archive is uploaded to the microcontroller over HTTP. Once on the microcontroller, the archive is automatically remapped to match the symbol table of the host.

> Note: The computer portions of this project are intended for use on macOS. It should be possible to use it on Windows and Linux as well, with small changes. The microcontroller portions are for the ESP8266. ESP32 currently works for debugging but not commands -- this will be addressed shortly.

This example concisely demonstrates how to build, install, and run mods. It is not intended to be production code. Please learn from this project. Please do not ship it.

This document assumes the `runmod` directory is located in the Moddable SDK at the following path `$MODDABLE/examples/experimental/runmod`. You may put it elsewhere, but you will need to change the paths.

The motivation for creating this project is a [question](https://github.com/Moddable-OpenSource/moddable/issues/116) asked by [FWeinb](https://github.com/FWeinb). Thank you. 

## Host
To build, install, and launch the `runmod` application on an ESP8266 or ESP32, follow the usual steps for the [network examples](https://github.com/Moddable-OpenSource/moddable/tree/public/examples#wi-fi-configuration) in the Moddable SDK.

```
cd $MODDABLE/examples/experimental/runmod
mcconfig -d -m -p esp ssid=“MY_WIFI” password="MY_WIFI_PASSWORD"
```

If everything goes well, in the xsbug debugger you will see the Wi-Fi connection being established:

	Wi-Fi connected to "MY_WIFI"
	IP address 192.168.1.24

Next you'll see an exception in the xsbug debugger telling you there's no mod installed yet. That's true. Just press the Run button to continue execution.

	/moddable/examples/experimental/runmod/main.js (80) # Break: require: module "mod" not found!

Finally, the microcontroller will claim the mDNS name `runmod` on the local network. 

	probe 1
	probe 2
	probe 3
	probe claimed runmod

At this point, the host is ready to receive a mod. The host is available on the local network at the IP address shown as well as using the mDNS name `runmod.local`.

There is one important detail to be aware of. The `manifest.json` of `runmod` has a special define to enable mod support:

	"defines": {
		"XS_MODS": 1
	},

Because of this, you must do a clean build for `runmod`. An easy way to do that is to manually delete `$MODDABLE/build/tmp/esp` and `$MODDABLE/build/bin/esp`.

## Mods
This project contains three sample mods - hello world, http get, and ping. Each illustrates a different capability. The process for building and installing each of them is the same.

- `helloworld` -- traces "hello world" to the xsbug console and then traces the numbers from 1 to 10 using a `for` loop.
- `httpget` -- uses an HTTP GET to retrieve the home page of `wwww.example.com` and trace it to the xsbug console.
- `ping` -- implements a simple network ping client, continuously pinging `www.moddable.com` and tracing the responses to the xsbug console.

### Building
To build the `helloworld` mod, run the following commands:

	cd $MODDABLE/examples/experimental/runmod/mods/helloworld
	mkdir -p build
	xsc ./mod.js -d -e -o ./build
	xsl -a -b ./build -o ./build -r mod ./build/mod.xsb

This compiles the script and creates an archive in `helloworld/build/mod.xsa`.

The `httpget` mod is built the same way, just change the `cd` path to `$MODDABLE/examples/experimental/runmod/mods/httpget`.

The `helloworld` and `httpget` mods each consist of a single module named `mod`.  The `helloworld` mod is self contained and so does not import any modules from the host; the `httpget` mod imports the `http` module from the host. The `ping` mod has two modules -- the  main `mod` module  and the `ping` network protocol module. The `ping` protocol is included in the Moddable SDK. However, it is not built into the `runmod` host. Therefore, the `ping` mod must include the `ping` module in its archive. To do that requires building both modules independently using `xsc` and linking them together using `xsl`:

	cd $MODDABLE/examples/experimental/runmod/mods/ping
	mkdir -p build
	mkdir -p build/network
	xsc ./mod.js -d -e -o ./build
	xsc $MODDABLE/modules/network/ping/ping.js -d -e -o ./build/network
	xsl -a -b ./build -o ./build -r mod ./build/mod.xsb ./build/network/ping.xsb

<!--
### Install
A mod is installed to `runmod` using an HTTP PUT. This project uses the `curl` command line tool for this. The mod is contained in an XS Archive, which is a single file with a `.xsa` extension. It is uploaded as follows:

	curl -T ./build/mod.xsa http://runmod.local/mod/install

If you don't have mDNS on your development machine, use the IP address instead:

	curl -T ./build/mod.xsa http://192.168.1.24/mod/install

Once the mod is installed, the microcontroller restarts. On restart, the mod is prepared for execution and then the `runmod` starts. Instead of the exception before ("Break: require: module "mod" not found!), you should see the mod begin to execute followed by "mod loaded" in the xsbug console.

### Uninstall
A mod is uninstalled with HTTP GET. Here's the curl command:

	curl http://runmod.local/mod/uninstall

Following the uninstall, the microcontroller restarts.

### Restart
Because mods are ECMAScript modules, they are only loaded once into a virtual machine. To re-run the top-level code in the mod, restart the JavaScript VM. 

	curl http://runmod.local/mod/restart
-->

### Execution Environment
Because the mod is run as a dynamically loaded module on a microcontroller, the environment is constrained in various ways. The constrained speed and available RAM are well known challenges of embedded development. This section describes other details to be aware of.

#### Language Features
The XS JavaScript engine implements the JavaScript 2018 specification with a [very high degree of conformance](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/xs/XS%20Conformance.md). However, to fit the engine into the 1 MB of flash available on the ESP8266 together with the networking firmware while leaving space free for mods, some JavaScript features are removed. Invoking those features generates an exception. These are the features that are unavailable:

- Async functions
- Atomics
- eval
- Generators
- Promises
- Proxy
- RegExp
- SharedArrayBuffer

The choice of the JavaScript languages features to include and exclude is made by the developer of the host. The `runmod` manifest defines the features to be removed. To change the available language features, change the manifest.

> Note: Microcontrollers able to address a larger flash address space, such as the ESP32, may include more of the JavaScript language. For consistency, `runmod` provides the same features on all microcontrollers.

#### Symbols
Each unique property (variable) name in JavaScript must be tracked by the JavaScript engine. This is required to support various features of the language. The symbols used by the host are stored in flash. Each symbol used by the mod that is not also used by the host requires some RAM. The host is configured at build time to support a fixed number of symbols in RAM. When this limit is exceeded, an exception is generated. `runmod` is configured to support up to 256 unique symbols in the mod.

	"creation": {
		"keys": {
			"available": 256,
		},
	},

In practice, this is sufficient for most mods. If you need more, increase the number and rebuild `runmod`.

You can see the number of keys used while `runmod` is executing by looking at the "Keys used" area of the Instrumentation panel in xsbug.

#### Host / Built-in Modules
The host itself is built using JavaScript modules. Those modules are available to mods. The following modules from the Moddable SDK are built into the `runmod` host:

- dns
- dns/parser
- dns/serializer
- http
- mdns
- net
- sntp
- socket
- time
- timer
- wifi

The `manifest.json` of `runmod` controls which modules are built-in.

Modules that are built into the host are usually configured in the manifest to preload during the build. By preloading the modules, they use less RAM and load instantly. Modules contained in a mod, however, cannot be preloaded. Therefore, modules that are expected to be used by most mods should be built into the host, rather than delivered as part of the mod.

#### Native Code
Mods are JavaScript code, by definition. There is no native code in a mod. The XS JavaScript engine does support including native code in modules built into the host.

## Communicating with `runmod`
The `runmod` app supports two communication transports: Wi-Fi and USB. The two transports are provide the same functionality, though the details of how messages are formatted differ.

There are two kinds of messages. All debugging communication (e.g. the xsbug protocol) is purely text based. All commands (e.g. install, restart, etc) use a binary message format. This distinction between text and binary messages allows for simple routing of messages to either the debugging support in XS or the command handler of the host.

### Using Wi-Fi
The `runmod` app communicates over the network using the WebSocket protocol. The WebSocket protocol is used because:

- It is fully bi-directional, unlike HTTP.
- Web browsers have excellent support for WebSocket making it possible to implement development tools in the browser.

`runmod` hosts a WebSocket server on port 8080. Development tools, such as an IDE, connect to the WebSocket server. Only one development tool may connect to `runmod` at a time. The WebSocket connection is used to both (xsbug) and manage mods (install, uninstall, etc).

All debugging messages are sent as WebSocket text messages. All other messages (commands) are sent as WebSocket binary messages. The Debugging section below explains how to interact with the xsbug protocol; the Remote Commands section, how to send and receive command messages.
 
#### WebSocket Connection Design
The WebSocket protocol is the obvious candidate to use to carry the xsbug protocol between the host and the browser because it is already bi-directional. Additionally, the Moddable SDK has a WebSocket client and server. However, the Moddable SDK implementation of WebSocket is written entirely in JavaScript. It cannot be used while debugging as execution of scripts is suspended while stopped at a breakpoint. Reimplementing all of the WebSocket protocol in native code to be used by the debugger is possible, but tedious.

- `runmod` hosts a WebSocket server using the WebSocket JavaScript module from the Moddable SDK.
- The web browser connects to the WebSocket server at any time after the JavaScript virtual machine is running and Wi-Fi network connection has been established.
- The JavaScript WebSocket server establishes the WebSocket connection, including the upgrade from HTTP to WebSocket and sub-protocol negotiation.
- Once the handshake is complete, `runmod` detaches the network socket from the WebSocket connection and hands the native lwip socket off to the XS debugging support.
- The debugging implementation in XS operates as usual using the socket created by the WebSocket server, sending and receiving messages as if it is connected to xsbug.
- The debugging transport code in `xsPlatform.c` -- which already implements support for serial and socket based connection -- wraps outgoing messages in WebSocket text frames and removes the WebSocket framing information from incoming messages.

#### Implementation Notes

1. The WebSocket server in `runmod` is available at port 8080.
1. The WebSocket server uses a subprotocol of `x-xsbug`. Strictly speaking this is unnecessary, but it is done to be explicit about the kind of data being transported. Should the protocol changes in the future, this mechanism allows for protocol version negotiation.
1. Only one debugging connection may be active at a time. The Moddable SDK is configured to establish a host debugging connection over serial at start-up. To use mod debugging over WebSockets, there cannot be an active serial debugging connection. To ensure this, when a new incoming WebSocket connection arrives, any existing debugging connecting is closed.
1. The current implementation of WebSocket support in `xsPlatform.c` breaks support for host debugging directly to xsbug because it assumes the transport is always WebSocket. This needs to be made an option.
1. On a clean shut-down the server sends a WebSocket close message.

### Using USB
The `runmod` app communicates over USB using a serial connection. Because the ESP8266 and ESP32 do not have build-in USB support, a bridge chip is used, typically the CP2102. The DTR pin is used to reset the microcontroller. The ESP8266 communicates at 921600 baud; the ESP32, at 460800 baud.

When debugging over USB using a computer, the `serial2xsbug` command line tool serves as a bridge between USB and the network socket used by xsbug for communication. Each message sent begins with a XML processing instruction that indicates the JavaScript virtual machine associated with the message (either the machine that is sending the message or receiving it). This allows one USB connection to be used to debug multiple virtual machines running on a single microcontroller. The preamble for a text (debugging) message looks like this:

	<?xs.00321080?>

The preamble for a binary (command) message looks like this:

	<?xs#00321080?>

The numeric portion identifies the virtual machine. When the device reboots, it sends a processing instruction with 0 for the virtual machine to indicate that it has been reset:

	<?xs.00000000?>

When a virtual machines closes, it sends a preamble like this:

	<?xs-00321080?>

For text messages, the text immediately follows the preamble and terminals with a CR/LF pair. For binary messages, the preamble is followed by a 16-bit big-endian length and then the binary message itself.

#### Using WebUSB
The `runmod` app is compatible with [WebUSB](https://wicg.github.io/webusb/), available in the Chrome web browser. WebUSB operates without a driver. If you have a driver installed to work with you development board, WebUSB will not be able to connect. You will need to uninstall or disable the driver first. On macOS, the following commands disable and enable the Silicon Labs driver.

```
sudo kextunload -b com.silabs.driver.CP210xVCPDriver

sudo kextload -b com.silabs.driver.CP210xVCPDriver
```

### To Build
The experimental support for WebSocket debugging and binary commands is not yet part of the Moddable SDK. To try it, it is necessary to manually patch the build. The files to replace are in [`runmod/patches` directory](https://github.com/phoddie/runmod/tree/master/patches/).

- `$MODDABLE/xs/platforms/esp/xsPlatform.h`
- `$MODDABLE/xs/platforms/esp/xsPlatform.c`

## Debugging
The mods are built with debugging enabled (the `-d` option passed to `xsc`). If the host is connected to xsbug using a serial connection, the mod may be debugged using xsbug. For example, use xsbug to set a breakpoint on a line of source code or add a `debugger` statement to your mod's source code.

### Host Debugging
"Host debugging" is when the debugging connection is established at the time the JavaScript virtual machine is created. Debugging begins at the first line of JavaScript source code that XS executes.

Host debugging of embedded devices using the Moddable SDK usually runs over a serial connection because serial is fast, reliable, and supported on nearly every microcontroller. Although seldom used, the debugging connection may also run over a network socket. In this case, the host must know the IP address of the computer running xsbug so that it can initiate a connection to the debug server running in xsbug.

### Mod Debugging
This document introduces another approach to debugging, "mod debugging." Because a mod is not the first script a host executes, there is no need to connect to the debugger immediately. Further, the purpose of `runmod` is to be a host that works with only a browser-based IDE. "mod debugging" supports the equivalent of xsbug debugging in the web browser. 

## Remote Commands
Commands are sent to `runmod` over a WebSocket using a simple binary message format. Either side of the connection -- `runmod` or the development tool -- may send messages as it is a peer-to-peer protocol, not client-server.

Remote Commands may be sent whether or on JavaScript is being executed, including when stopped at a breakpoint. When a command is received by the microcontroller execution of JavaScript by XS is suspended, if it is not already, in the receiving virtual machine. This allows several remote commands to be sent while execution is suspended. Execution resumes by sending a Go command on the xsbug protocol (e.g. `doGo` in the example below). 

### Binary Message Format
All Command messages use the binary WebSocket message format.

- Fragmentation is not supported. Each message must be self-contained.
- There is no maximum message size. However, the message received must fit into the free RAM of the microcontroller. A safe maximum message size is 1024 bytes, though many devices can handle much more.

All messages are organized in the same format:

- One byte command code
- Two byte message ID. Set this to 0 if no reply is needed. Set it any value to receive a reply. The reply will use the same message ID.
- The payload follows. This may be zero or more bytes.

There is no length stored in the command itself as the length is part of the WebSocket message framing.

> Note: for messages with no payload, the two byte message ID is optional. If not present, no reply is sent.

Replies are optional so that there is no unnecessary network traffic on requests where the initiator does not want the reply. Replies contain a unique message ID so multiple requests may be pipelined rather than having to wait for a response after sending each one. This should help to speed installs of large mods, for example. 

### Commands
Commands ID values are stored as a one byte value. The same Command IDs are used for sending and receiving. All multi-byte integer values are transmitted in network byte order (e.g. big-endian).

- 0 - **reserved**. It is an error to send a command with this ID.
- 1 - **restart** (no payload). Closes the debugging connection (e.g. WebSocket connection) and restarts the target device.
- 2 - **uninstall mod** (no payload). Uninstalls the current mod. Restart is required for this to take effect. It is not necessary to uninstall prior to installing a mod.
- 3 - **install mod data**. Because mods are often bigger than 1 KB, they must be fragmented when installed. The fragments start at offset 0 and increase. There should be no gaps. The first four bytes of the payload are the offset into the mod data stored, the remaining payload bytes are mod binary data.
- 4 - **set preference**. The payload is 3 zero-terminated (C) strings: preference domain, key, and value. 
- 5 - **reply**. The first two bytes of the payload are the message ID that this reply corresponds to. The next two bytes are the result code (0 for no error). Any additional data is specific to the command code of the requesting message.
- 6 - **get preference**. The payload is 2 zero-terminated (C) strings: preference domain and value. The preference value is returned in a reply message as a zero-terminated (C) string
- 7 - **reserved**
- 8 - **set baud**. The payload is a 4-byte big endian value with the desired baud rate. The reply, if requested, is sent before the microcontroller changes the baud rate.
- 9 - **set time**. The payload is one, two, or three 4-byte big endian values. The first value is the UTC time in seconds, the second is the time zone offset without daylight savings time applied, and the third is the current daylight savings time offset. The first parameter works on ESP8266 and ESP32. The remaining parameters are currently only supported on ESP8266.
- 10 - **load module**. The payload is a single zero terminated (C) string. The string is a module specifier for a module to load. The load module command allows a tool to trigger execution of a module's body independently of the host. If the specified module is already loaded, this command has no effect. Note that the module is not loaded immediately upon receipt of the command, but when execution returns  out to the main event loop (similar to a Promise).

### Preferences
The `runmod` application uses the preferences feature of the Moddable SDK to configure certain options.

#### When a mod runs
By default, the install mod is run immediately on booting the microcontroller. The mod can be configured to run immediately after a debugger connection is established or never. The choice is configured by setting the `config` domain and `when` key to `boot`, `debug` or `never`.

**Note**: When running over USB, `debug` option is behaves the same as `never` because the USB debugging connection is established before the virtual machine is launched.

#### Device Name
The name of the device may be changed from `runmod` by setting the preference in `config` domain with the `name` key.

 > Note: `runmod` does not perform validation checks on the name provided. It must be a valid mDNS name, less than 32 characters. Using all lower-case letters is recommended.

## Example from Browser
To try out the mod debugging and remote commands from the browser, [a small test](https://github.com/phoddie/runmod/tree/master/html/) is provided in the repository. It connects to `runmod` over WebSockets, sets a breakpoint, and traces messages to the console. It is not a useful example, it is just a starting point.

The example defines the `XsbugConnection` class which implements all the features in common between WebSocket and USB transport. The `XsbugConnection` class is subclassed by `XsbugWebSocket` and `XsbugUSB` to implement the transport specific details of managing the connection as well as sending and receiving messages. Each debugging message in the protocol is an XML document. Each command message in the protocol is a binary block of data. The `XsbugConnection` classes convert incoming messages to JavaScript objects and generates outgoing XML messages in response to JavaScript function calls. 

The example contains two pre-compiled mods - `helloworld` and `httpget`. Ten seconds after establishing a connection to `runmod` on the microcontroller, it installs `helloworld` and restarts.

	setTimeout(function() {
		xsb.doInstall(helloWorldXSA, function() {
			console.log("INSTALL COMPLETE. RESTART.");
			xsb.doRestart();
		});
	}, 10 * 1000);

You can modify the example to install `httpget` instead by changing `helloWorldXSA` to `httpGetXSA`.

#### Connecting
To establish a connection with WebSocket, pass the URI to the `XsbugWebSocket` constructor:

	let xsb = new XsbugWebSocket("ws://runmod.local:8080");

To establish a connection with WebUSB, pass the baud rate to the `XsbugUSB` constructor:

	let xsb = new XsbugUSB({baud: 921600});
	
When a new USB connection is established, the microcontroller is reset to begin a fresh debugging session.

>**Note**: The WebUSB security model requires USB connections to be initiated by a user interaction with a web page served over the network. WebUSB connections cannot be established from web pages loaded from a local file.

Once a connection is established, the USB and WebSocket connections operate in the same way. The WebSocket connection has the potential to be higher bandwidth, but is also higher latency.

### Disconnecting
An active connection is closed by calling `disconnect`:

	xsb.disconnect();

For WebSocket connections, this closes the WebSocket instance. For USB connections, this releases the USB port. Disconnecting does not stop the currently running program or restart the microcontroller.

#### Receiving messages
The `XsbugConnection` instance provides callback functions for each message type sent by xsbug. To receive a message, provide the corresponding callback:

	xsb.onLog = function(msg) {
		console.log(msg.log)
	}

The following callbacks are available:

- `onBreak` -- a breakpoint was hit - either a breakpoint that was set, a debugger statement, or an exception
- `onInstrumentationConfigure` -- the names and labels for all instrumentation fields
- `onInstrumentationSamples` -- the current values for all instrumentation fields
- `onLocal` -- one local stack frame
- `onLog` -- a log message, such as generated by a call to the global `trace` function
- `onLogin` -- the first message sent when the connection is established
- `onClose` -- the connection was closed by the microcontroller (for example, prior to restart)
- `onError` -- the connection is no longer usable due to an error

#### Sending messages
The `XsbugConnection` instance provides functions to send each type of request supported by the XS debugging implementation.

- `doClearBreakpoint(path, line)` -- removes a breakpoint
- `doGo()` -- resumes execution from a breakpoint
- `doSetBreakpoint(path, line)` -- sets a breakpoint
- `doSelect(value)` -- selects a local stack frame. The contents of the stack frame are sent immediately and the `onLocal` callback is invoked with the result.
- `doSetAllBreakpoints(breakpoints, exceptions)` -- set multiple breakpoints. This is usually sent when the `onLogin` is received. Execution begins when this is received by XS. The `exceptions` argument is optional and defaults to true, which causes XS to break in the debugger on JavaScript exceptions.
- `doStep` -- execute until the next line of source code
- `doStepInside` -- execute and break inside the next function called
- `doStepOutside` -- execute and break when returning from the current function call.
- `doToggle` -- request that the given object toggle its state for reporting its contents. This is equivalent to clicking the turn down arrow in xsbug that appears to the left of objects.

The `XsbugConnection` instance provides functions to send Commands to the microcontroller.

- `doGetPreference(domain, key, callback)` -- Retrieves the value of a preference as a string. The callback function is invoked with the result.
- `doLoadModule(name[, callback])` -- Loads the module with the module specifier `name`. Roughly equivalent to `require(name)`.
- `doRestart()` -- Restart the microcontroller. The WebSocket connection, if one is active, will be closed.
- `doUninstall([callback])` -- Uninstall the current mod. A restart is necessary after this for the change to take effect. Optional callback is invoked with result code from microcontroller.
- `doInstall(data [, callback])` -- Install a new mod. A restart is necessary after installation for the change to take effect. The `data` argument must be an instance of an `ArrayBuffer`. The implementation of `doInstall` breaks the data into fragments to transmit, and waits for an acknowledgement from the microcontroller before sending the next block. Flow control is necessary to avoid buffer overruns when communicating over USB.
- `doSetPreference(domain, key, value)` -- Sets the value of a preference to a string.
- `doSetBaud(baud[, callback])` -- Changes the baud rate of the active serial connection (meaningless when using a WebSocket connection).

> Note: `XsbugConnection` implements a general purpose mechanism to deliver responses to Commands, the `pending` list. At this time, only the `doGetPreference`, `doInstall`, and `doUninstall` commands use it.

#### Exploring the xsbug Protocol
The xsbug protocol is undocumented. Some experimentation will be needed to use it. The [source code of xsbug](https://github.com/Moddable-OpenSource/moddable/tree/public/tools/xsbug) is available, which provides a working example. Running xsbug locally with the simulator together with Wireshark is a good way to see how user interface features correspond to protocol messages.

The protocol is quite simple. It relies on the debugger application to do much of the work. The protocol is designed to be as minimal as practical so it can fit comfortably inside a microcontroller as part of the XS engine.

#### Putting It Together
The image below shows the example application running in the Chrome web browser. The messages sent between the browser and the microcontroller are displayed in the console.

![xsbug protocol hosted in Chrome](images/wsxsbug.png)