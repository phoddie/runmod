# Moddable Tools in WebAssembly
#### Copyright 2019 Moddable Tech, Inc.
#### May 6, 2019

The XS compiler and linker together with the [Moddable SDK build tools](https://github.com/Moddable-OpenSource/moddable/tree/public/tools) are now available as an WebAssembly (wasm) build. The tools are implemented using a mix of C code and JavaScript. The JavaScript code is executed by the XS JavaScript engine, which is part of the wasm build.

> **Note**: These tools are experimental. Feedback and advice are welcome. This document is a brief introduction for those interested in trying out the tools in a wasm environment. It assumes the reader is familiar with XS, the Moddable SDK, and WebAssembly.

All tools are built into a single binary for convenience of working in the wasm runtime.

Normally apps using the Moddable SDK are built using the [`mcconfig` tool](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/tools/tools.md#mcconfig) which uses a JSON [application manifest](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/tools/manifest.md) to determine what to build. Moddable SDK apps contain both native code and JavaScript. Mods, on the other hand, contain only JavaScript code. A new tools, `mcrun`, is the equivalent of `mcconfig` for mods. It uses a subset of the same manifest format, which includes support for JavaScript modules and resources, but excludes all support related to building and configuring native code.

## Build Instructions

- Do a clean rebuild of the macOS tool chain

```
	cd $MODDABLE/build/makefiles/mac
	make
```

- Build the wasm tools. The wasm build assumes you have the wasm build tools installed (e.g. emscripten).

```
	cd $MODDABLE/build/makefiles/wasm
	make
```

- The output of the build includes release and debug versions of the tools. They are located in `$MODDABLE/build/bin/wasm/debug` and `$MODDABLE/build/bin/wasm/release`. There are two files, `tools.js` and `tools.wasm`.

- To test, copy [this HTML file](https://gist.github.com/phoddie/bade2f7e49f2e4da26877c8f8d380c79) to the same directory with `tools.js` and `tools.wasm` in `$MODDABLE/build/bin/wasm/debug`. Then start a web server:

```
	cd $MODDABLE/build/bin/wasm/debug
	python -m SimpleHTTPServer 8000
```

- In a browser go to `http://localhost:8000`. There is button to select a directory. Select for instance `runmod/mods/helloworld`.
The archive is built and downloaded.

> **Note**: The wasm tools are built for the `web` environment. To use them in a `worker` environment change the definition of `ENVIRONMENT` in [`build/makefiles/wasm/tools.mk`](https://github.com/Moddable-OpenSource/moddable/blob/public/build/makefiles/wasm/tools.mk#L220):

	-s ENVIRONMENT=worker\

## Executing `mcrun` in the Browser
If you look at the HTML file you will notice that most of the code is to upload the files in the tools file system and to download the archive from the tools file system. To build the archive, the script first calls `mcrun`:

	tools.callMain([ "mcrun", "-d", "/mc/manifest.json" ]);

That creates a `make.json` file, which is an array of commands to execute:

	let make = JSON.parse(tools.FS.readFile("/moddable/build/tmp/wasm/debug/mc/make.json", { encoding: 'utf8' }));
	for (let command of make) {
		tools.callMain(command);
	}

## Resources
Resources provide efficient access to data in the Moddable SDK. You can think of a resource as a read-only file. However, the Moddable SDK build tools may transform the original file into a format more suitable for use on the target microcontroller. For example, both images and audio are usually transcoded during the build.

The `mcrun` tool supports the same resource features as `mcconfig`. The `modballs` mod is a simple way to try that. To try it, you'll need add the Piu user interface framework and Commodetto graphics library to the `runmod` host. Modify its manifest to `manifest_piu` to the `include` array:

```
	"include": [
		"$(MODDABLE)/examples/manifest_base.json",
		"$(MODDABLE)/examples/manifest_net.json",
		"$(MODULES)/network/mdns/manifest.json",
		"$(MODULES)/files/preference/manifest.json",
		"$(MODDABLE)/examples/manifest_piu.json",
	],
```
Rebuild and redeploy the `runmod` host. Then you can build and run `modballs` as any other mod.
