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

#include "xsmc.h"
#include "xsesp.h"

void xs_restart(xsMachine *the)
{
#if ESP32
	esp_restart();
#else
 	system_restart();
#endif
}

extern void fxConnectTo(xsMachine *the, void *pcb);
extern void *modSocketGetLWIP(xsMachine *the, xsSlot *slot);
extern void espDescribeInstrumentation(xsMachine *the);

void xs_debug(xsMachine *the)
{
#ifdef mxDebug
	if (fxIsConnected(the)) {
		xsTrace("closing debugger connection\n");
		fxDisconnect(the);
	}

	if (xsmcArgc) {
		fxConnectTo(the, modSocketGetLWIP(the, &xsArg(0)));
		fxLogin(the);
		espDescribeInstrumentation(the);
	}

	xsmcSetBoolean(xsResult, fxIsConnected(the));
#else
	xsUnknownError("debugging disabled");
#endif
}
