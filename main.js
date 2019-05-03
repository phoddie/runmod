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

import MDNS from "mdns";
import {Server} from "websocket"
import Preference from "preference";

class ModDevServer extends Server {
	constructor(dictionary) {
		super(dictionary);
		ModDevServer.runMod("boot")
	}
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
	const hostName = Preference.get("config", "name") || "runmod";
	new MDNS({hostName});
	new ModDevServer({port: 8080});

	trace(`host ready at ${hostName}.local\n`);
}
