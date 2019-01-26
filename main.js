/*
 * Copyright (c) 2019  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK.
 *
 *   This work is licensed under the
 *       Creative Commons Attribution 4.0 International License.
 *   To view a copy of this license, visit
 *       <http://creativecommons.org/licenses/by/4.0>.
 *   or send a letter to Creative Commons, PO Box 1866,
 *   Mountain View, CA 94042, USA.
 *
 */

import Flash from "flash";
import MDNS from "mdns";
import Timer from "timer";
import {Server} from "http";

function restart() @ "xs_restart";		// N.B. restart does not occur immediately. this function returns.


/*
	build, install, and launch host app:
		cd $MODDAB:E/examples/experimental/runmod
		mcconfig -d -m -p esp ssid=“579 9th - slow” password=kinomakinoma

	build and install helloworld or httpget mod
		cd $MODDABLE/examples/experimental/runmod/mods/helloworld
		xsc ./mod.js -d -e -o ./build
		xsl -a -b ./build -o ./build -r mod ./build/mod.xsb
		curl -T ./build/mod.xsa http://runmod.local/mod/install
		curl http://runmod.local/mod/uninstall

	build and install ping mod
		cd $MODDABLE/examples/experimental/runmod/mods/ping
		xsc ./mod.js -d -e -o ./build
		xsc $MODDABLE/modules/network/ping/ping.js -d -e -o ./build
		xsl -a -b ./build -o ./build -r mod ./build/mod.xsb ./build/ping.xsb
		curl http://runmod.local/mod/uninstall
 */

class ModServer extends Server {
	callback(message, value, etc) {
		switch (message) {
			case 2:								// request status received
				if (value === "/mod/install") {
					this.flash = new Flash("xs_stage");
					this.position = 0;
					this.flash.erase(0);		//@@
				}
				else if (value === "/mod/uninstall") {
					const flash = new Flash("xs_stage");
					flash.write(0, 16, new ArrayBuffer(16));
					trace("uninstalled mod");
					this.server.restart();
				}
				break;

			case 4:								// prepare for request body
				return true;					// provide request body in fragments

			case 5:								// request body fragment
				if (this.flash) {
					let buffer = this.read(ArrayBuffer);
					trace(`received ${buffer.byteLength} bytes of mod\n`)
					this.flash.write(this.position, buffer.byteLength, buffer);
					this.position += buffer.byteLength;
				}
				break;

			case 6:								// request body received
				if (this.flash) {
					trace("installed mod\n");
					this.server.restart();
				}
				break;
		}
	}
	restart() {
		Timer.set(() => {
			trace("restarting\n");
			this.close();
			restart();
		}, 5000);
	}
}

export default function() {
	new MDNS({hostName: "runmod"});
	new ModServer;

	try {
		require("mod");
		trace("mod loaded\n");
	}
	catch {
		trace("exception loading mod\n");
	}
}
