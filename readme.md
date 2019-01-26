# runmod
#### Copyright 2019, Moddable Tech Inc.
#### Updated January 26, 2019

This project is a simple example of how to install and run mods (e.g. JavaScript modules) on a microcontroller using the Moddable SDK. The project is in two parts, the host application and the mods.

The host application is the base firmware for the microcontroller. It is the "built-in" software that the mods can use. When writing JavaScript for a web page, the browser is the host. When writing JavaScript for a server, Node.js is the host. The `runmod` host contains the XS JavaScript virtual machine, the HTTP server used to upload the mods, and the device firmware for the ESP8266, including Wi-Fi networking. The host is approximately 650 KB, leaving about 375 KB of space for mods.

The JavaScript source code of the mods to be installed are compiled to byte-code on another device, not the microcontroller. The XS Compiler (xsc) and XS Linker (xsl) are used to compile and link the modules to be installed into an XS Archive file, which can contain one or more modules. The archive is uploaded to the microcontroller over HTTP. Once on the microcontroller, the archive is remapped to match the symbol table of the host.

> Note: This computer portions of this project are intended to use on macOS. It should be possible to use it on Windows and macOS as well, with small changes. The microcontroller portions are for for the ESP8266, and with some changes will work on ESP32 as well.

This example is intended to concisely demonstrate how to build, install, and run mods. It is not intended to be production code. Please learn from this project. Please do not ship it.

This readme assumes that the runmod directory is located in the Moddable SDK at the following path `$MODDABLE/examples/experimental/runmod`. You may put it elsewhere, but you will need to change the paths.

## Host
To build, install, and launch the `runmod` application on the ESP8266, follow the usual steps for the network examples in the Moddable SDK.

	cd $MODDABLE/examples/experimental/runmod
	mcconfig -d -m -p esp ssid=“MY_WIFI” password="MY_WIFI_PASSWORD"

If everything goes well, in the xsbug debugger you will see the Wi-Fi connection being established:

	Wi-Fi connected to "MY_WIFI"
	IP address 192.168.1.24

Next you'll see an exception in the xsbug debugger telling you there's no mod installed yet. That's true. Just press go to continue execution.

	/moddable/examples/experimental/runmod/main.js (80) # Break: require: module "mod" not found!

Finally, the ESP8266 will claim the mDNS name `runmod` on the local network. 

	probe 1
	probe 2
	probe 3
	probe claimed runmod

At this point, the host is ready to receive a mod. The host is available on the local network at the IP address shown as well as using the mDNS name `runmod.local`.

There is one important detail to be aware of. The `manifest.json` of `runmod` has a special define to enable mod support:

	"defines": {
		"XS_MODS": 1
	},

Because of this, you must do a clean build for runmod. An easy way to do that is to manually delete `$MODDABLE/build/tmp/esp` and `$MODDABLE/build/bin/esp`.

## Mods
This project contains three sample mods - hello world, http get, and ping. Each illustrates a different capability. The process for building and installing them is the same.

- `helloworld` -- traces "hello world" to the xsbug console and then traces the numbers from 1 to 10 using a `for` loop.
- `httpget` -- uses an HTTP GET to retrieve the home page of `wwww.example.com` and trace it to the xsbug console.
- `ping` -- implements a simple network ping client, continuously pinging `www.moddable.com` and tracing the responses to the xsbug console.

### Building
To build the `helloworld` mod, run the following commands:

	cd $MODDABLE/examples/experimental/runmod/mods/helloworld
	xsc ./mod.js -d -e -o ./build
	xsl -a -b ./build -o ./build -r mod ./build/mod.xsb

This compiles the script and creates an archive in `helloworld/build/mod.xsa`.

The `httpget` mod is built the same way, just change the `cd` path to `$MODDABLE/examples/experimental/runmod/mods/httpget`.

The `helloworld` and `httpget` mods each consist of a single module. The `ping` mod has two modules. The first is the main mod code, the second is the `ping` network protocol module. The `ping` protocol is part of the Moddable SDK. Since it is not part of the `runmod` host, the `ping` mod includes it in its archive. That requires building both modules independently using `xsc` and then using `xsl` to link them together:

	cd $MODDABLE/examples/experimental/runmod/mods/ping
	xsc ./mod.js -d -e -o ./build
	xsc $MODDABLE/modules/network/ping/ping.js -d -e -o ./build
	xsl -a -b ./build -o ./build -r mod ./build/mod.xsb ./build/ping.xsb

### Installing
A mod is installed to `runmod` using an HTTP PUT. This project uses the `curl` command line tool for this. The mod is contained in an XS Archive, which is a single file. It is uploaded as follows:

	curl -T ./build/mod.xsa http://runmod.local/mod/install

If you don't have mDNS on your development machine, use the IP address instead:

	curl -T ./build/mod.xsa http://192.168.1.24/mod/install

Once the mod is installed, the ESP8266 waits five seconds and then restarts. On restart, the mod is prepared for execution and then the `runmod` starts. The Instead of the exception before ("Break: require: module "mod" not found!), you should see the mod begin to execute followed by "mod loaded" in the xsbug console.

### Uninstalling
A mod is uninstalled with an HTTP GET. Here's the curl command:

	curl http://runmod.local/mod/uninstall

Following the uninstall, the ESP8266 waits five seconds and restarts.

### Execution environment
Because the mod is run on as a dynamically loaded module on a microcontroller, the environment is quite constrained. This section describes some details to be aware of.

#### Language features
The XS JavaScript engine implements the JavaScript 2018 specification with a very high degree of conformance. However, to fit the engine into the 1 MB of flash together with the networking firmware and still have room for mods, some JavaScript features are removed. Invoking the features generates an exception. These are the features that are unavailable:

- Atomics
- RegExp
- eval
- Promises
- Async function
- Generators
- Proxy
- SharedArrayBuffer

The choice of the JavaScript languages features to make available is made by the author of the host. The `runmod` manifest defines the features to be removed. To change the available language features, change the manifest.

#### Symbols
Each unique property (variable) name in JavaScript must be tracked by the JavaScript engine. This is required to support certain features of the language. The symbols used by the host are stored in flash. Symbols used by the mod which are not also used by the host require some memory. The host is configured to support a certain number of symbols in the mod. If this is exceeded, an exception is generated. `runmod` is configured to support up to 256 unique symbols in the mod.

	"creation": {
		"keys": {
			"available": 256,
		},
	},

In practice, this is sufficient for most mods. If you need more, increase the number and rebuild `runmod`.

You can see the number of keys used while `runmod` is executing by looking at the "Keys used" area of the Instruments panel in xsbug.

#### Host / Built-in modules
The host itself is built using JavaScript modules. Those modules are available to mods. The following modules from the Moddable SDK are built-into the `runmod` host:

- dns
- dns/parser
- dns/serialiser
- flash
- http
- mdns
- net
- sntp
- socket
- tme
- timer
- wifi

The `manifest.json` of `runmod` controls which modules are built-in.

Modules that are built into the host, are typically preloaded during the build process. The preload process means that the modules use less RAM and load instantly. Mods cannot be preloaded. Therefore, modules that are expected to be used by most mods should be built into the host, rather than delivered as part of the mod.
