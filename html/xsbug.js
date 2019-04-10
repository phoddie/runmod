class XsbugConnection extends WebSocket {
	constructor(uri) {
		super(uri, "x-xsbug");

		super.onopen = this.onopen;
		super.onclose = this.onclose;
		super.onerror = this.onerror;
		super.onmessage = this.onmessage;
	}
	onopen() {
		console.log("WS OPEN");
	}
	onclose() {
		console.log("WS CLOSE");
	}
	onerror() {
		console.log("WS ERROR");
	}
	onmessage(event) {
		console.log("WS RECEIVE " + event.data);

		const msg = new XsbugMessage((new DOMParser).parseFromString(event.data, "application/xml"));
		if (msg.break)
			this.onBreak(msg);
		else if (msg.login)
			this.onLogin(msg);
		else if (msg.instruments)
			this.onInstrumentationConfigure(msg);
		else if (msg.local)
			this.onLocal(msg);
		else if (msg.log)
			this.onLog(msg);
		else if (msg.samples)
			this.onInstrumentationSamples(msg);
		else
			debugger;		// unhandled
	}
	send(data) {
		console.log("WS SEND " + data);
		return super.send(data);
	}
	// transmit message
	doClearBreakpoint(path, line) {
		this.sendCommand(`<clear-breakpoint path="${path}" line="${line}"/>`);
	}
	doGo() {
		this.sendCommand("<go/>");
	}
	doSetBreakpoint(path, line) {
		this.sendCommand(`<set-breakpoint path="${path}" line="${line}"/>`);
	}
	doSelect(value) {
		this.sendCommand(`<select id="${value}"/>`);
	}
	doSetAllBreakpoints(breakpoints = [], exceptions = true, start = false) {
		breakpoints = breakpoints.map(b => `<breakpoint path="${b.path}" line="${b.line}"/>`);
		if (exceptions)
			breakpoints.unshift('<breakpoint path="exceptions" line="0"/>')
		if (start)
			breakpoints.unshift('<breakpoint path="start" line="0"/>')
		this.sendCommand(`<set-all-breakpoints>${breakpoints.join("")}</set-all-breakpoints>`);
	}
	doStep() {
		this.sendCommand("<step/>");
	}
	doStepInside() {
		this.sendCommand("<step-inside/>");
	}
	doStepOutside() {
		this.sendCommand("<step-outside/>");
	}
	doToggle(value) {
		this.sendCommand(`<toggle id="${value}"/>`);
	}
	// receive messages
	onBreak(msg) {}
	onLogin(msg) {}
	onInstrumentationConfigure(msg) {}
	onInstrumentationSamples(msg) {}
	onLocal(msg) {}
	onLog(msg) {}

	// helpers
	sendCommand(msg) {
		this.send(XsbugConnection.crlf + msg + XsbugConnection.crlf);
	}
}
XsbugConnection.crlf = String.fromCharCode(13) + String.fromCharCode(10);

class XsbugMessage {
	constructor(xml) {
		xml = xml.documentElement;
		if ("xsbug" !== xml.nodeName)
			throw new Error("not xsbug xml");
		for (let node = xml.firstChild; node; node = node.nextSibling) {
			XsbugMessage[node.nodeName](this, node);
		}
		return;
	}

	// node parsers
	static login(message, node) {
		message.login = {
			name: node.attributes.name.value,
			value: node.attributes.value.value,
		};
	}
	static samples(message, node) {
		message.samples = node.textContent.split(",").map(value => parseInt(value));
	}
	static frames(message, node) {
		message.frames = [];
		for (node = node.firstChild; node; node = node.nextSibling)
			message.frames.push(XsbugMessage.oneFrame(node));
	}
	static local(message, node) {
		const local = XsbugMessage.oneFrame(node);
		local.properties = [];
		for (node = node.firstChild; node; node = node.nextSibling)
			local.properties.push(XsbugMessage.oneProperty(node));
		message.local = local;
	}
	static global(message, node) {
		message.global = [];
		for (node = node.firstChild; node; node = node.nextSibling)
			message.global.push(XsbugMessage.oneProperty(node));
		message.global.sort((a, b) => a.name.localeCompare(b.name));
	}
	static grammar(message, node) {
		message.module = [];
		for (node = node.firstChild; node; node = node.nextSibling)
			message.module.push(XsbugMessage.oneProperty(node));

		message.module.sort((a, b) => a.name.localeCompare(b.name));
	}
	static break(message, node) {
		message.break = {
			path: node.attributes.path.value,
			line: parseInt(node.attributes.line.value),
			message: node.textContent,
		};
	}
	static log(message, node) {
		message.log = node.textContent;
	}
	static instruments(message, node) {
		message.instruments = [];
		for (node = node.firstChild; node; node = node.nextSibling) {
			message.instruments.push({
				name: node.attributes.name.value,
				value: node.attributes.value.value,
			});
		}
	}

	// helpers
	static oneFrame(node) {
		const frame = {
			name: node.attributes.name.value,
			value: node.attributes.value.value,
		};
		if (node.attributes.path) {
			frame.path = node.attributes.path.value;
			frame.line = parseInt(node.attributes.line.value);
		}
		return frame;
	}
	static oneProperty(node) {
		const flags = node.attributes.flags.value;
		const property = {
			name: node.attributes.name.value,
			flags: {
				value: flags,
				delete: flags.indexOf("C") < 0,
				enum: flags.indexOf("E") < 0,
				set: flags.indexOf("W") < 0,
			},
		};
		if (node.attributes.value)
			property.value = node.attributes.value.value;

		if (node.firstChild) {
			property.property = [];
			for (let p = node.firstChild; p; p = p.nextSibling)
				property.property.push(XsbugMessage.oneProperty(p))
			property.property.sort((a, b) => a.name.localeCompare(b.name));
		}

		return property;
	}
}

let xsb = new XsbugConnection("ws://runmod.local:8080");
xsb.onLogin = function(msg) {
	this.doSetAllBreakpoints([{path: "/Users/hoddie/Projects/moddable/examples/network/websocket/websocketserver/main.js", line: 51}]);
	this.doStep();
}
xsb.onBreak = function(msg) {
	this.doGo();
}
