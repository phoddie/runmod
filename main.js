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

import Net from "net";
import MDNS from "mdns";
import {Server} from "websocket"
import Preference from "preference";

class ModDevServer extends Server {
	callback(message, value) {
		if (Server.handshake === message) {
			ModDevServer.debug(this.detach());
			ModDevServer.runMod("debug");
		}
		else if (Server.subprotocol === message)
			return "x-xsbug";
	}
	static runMod(when) {
		if (when && (when !== (Preference.get("config", "when") || "boot")))
			return;

		try {
			require("mod");
		}
		catch {
			trace("exception loading mod\n");
		}
	}
	static debug(socket) @ "xs_debug";		// hand-off native socket to debugger
}
Object.freeze(ModDevServer.prototype);

export default function() {
	trace(`host ready on serial\n`);

	if (Net.get("IP")) {
		const hostName = Preference.get("config", "name") || "runmod";
		new ModDevServer({port: 8080});
		new MDNS({hostName}, function(message, value) {
			if ((1 === message) && value)
				trace(`host ready at ws://${hostName}.local:8080\n`);
		});
	}

	ModDevServer.runMod("boot")
}
