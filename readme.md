# Building and Installing JavaScript Mods
#### Copyright 2019, Moddable Tech Inc.
#### Updated January 26, 2019

This project is a simple example of how to install and run mods (e.g. JavaScript modules) on a microcontroller using the [Moddable SDK](https://github.com/Moddable-OpenSource/moddable). The project has two parts: the host application and the mods.

The host application is the base firmware for the microcontroller. It is the built-in software that defines the behavior of the device and is available for mods can use. When writing JavaScript for a web page, the browser is the host. When writing JavaScript for a server, Node.js is the host. The `runmod` host contains the XS JavaScript virtual machine, the HTTP server used to upload the mods, and the device firmware for the ESP8266, including Wi-Fi networking. The host is approximately 650 KB, leaving about 375 KB of space for mods.

The JavaScript source code of mods is compiled to byte-code on a development machine, not the microcontroller. The XS Compiler (xsc) and XS Linker (xsl)  compile and link the modules to be installed into an XS Archive file, which can contain one or more modules. The archive is uploaded to the microcontroller over HTTP. Once on the microcontroller, the archive is automatically remapped to match the symbol table of the host.

> Note: The computer portions of this project are intended for use on macOS. It should be possible to use it on Windows and Linux as well, with small changes. The microcontroller portions are for for the ESP8266, and with some changes will work on ESP32 as well.

This example concisely demonstrate how to build, install, and run mods. It is not intended to be production code. Please learn from this project. Please do not ship it.

This document assumes the `runmod` directory is located in the Moddable SDK at the following path `$MODDABLE/examples/experimental/runmod`. You may put it elsewhere, but you will need to change the paths.

The motivation for creating this project is a [question](https://github.com/Moddable-OpenSource/moddable/issues/116) asked by [FWeinb](https://github.com/FWeinb). Thank you. 

## Host
To build, install, and launch the `runmod` application on the ESP8266, follow the usual steps for the [network examples](https://github.com/Moddable-OpenSource/moddable/tree/public/examples#wi-fi-configuration) in the Moddable SDK.

```
cd $MODDABLE/examples/experimental/runmod
mcconfig -d -m -p esp ssid=“MY_WIFI” password="MY_WIFI_PASSWORD"
```

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
	xsc ./mod.js -d -e -o ./build
	xsc $MODDABLE/modules/network/ping/ping.js -d -e -o ./build
	xsl -a -b ./build -o ./build -r mod ./build/mod.xsb ./build/ping.xsb

### Installing
A mod is installed to `runmod` using an HTTP PUT. This project uses the `curl` command line tool for this. The mod is contained in an XS Archive, which is a single file with a `.xsa` extension. It is uploaded as follows:

	curl -T ./build/mod.xsa http://runmod.local/mod/install

If you don't have mDNS on your development machine, use the IP address instead:

	curl -T ./build/mod.xsa http://192.168.1.24/mod/install

Once the mod is installed, the ESP8266 waits five seconds and then restarts. On restart, the mod is prepared for execution and then the `runmod` starts. Instead of the exception before ("Break: require: module "mod" not found!), you should see the mod begin to execute followed by "mod loaded" in the xsbug console.

### Uninstalling
A mod is uninstalled with HTTP GET. Here's the curl command:

	curl http://runmod.local/mod/uninstall

Following the uninstall, the ESP8266 waits five seconds and restarts.

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

#### Symbols
Each unique property (variable) name in JavaScript must be tracked by the JavaScript engine. This is required to support various features of the language. The symbols used by the host are stored in flash. Each symbols used by the mod that are not also used by the host require some RAM. The host is configured to support a certain number of symbols in RAM. When this limit is exceeded, an exception is generated. `runmod` is configured to support up to 256 unique symbols in the mod.

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

Modules that are built into the host are usually configured in the manifest to preload during the build. By preloading the modules, they use less RAM and load instantly. Modules contained in a mod, however, cannot be preloaded. Therefore, modules that are expected to be used by most mods should be built into the host, rather than delivered as part of the mod.

#### Debugging
The mods are built with debugging enabled (the `-d` option passed to `xsc`). If the host is connected to xsbug using a serial connection, the mod may be debugged using xsbug. For example, use xsbug to set a break point on a line of source code or add a `debugger` statement to your mod's source code.

#### Native Code
Mods are JavaScript code, by definition. There is no native code in a mod. The XS JavaScript engine supports calling including native code for modules that are built into the host. For example, `runmod` includes a `restart` function to restart the ESP8266.
