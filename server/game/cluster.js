/**
 * Rule the words! KKuTu Online
 * Copyright (C) 2017 JJoriping(op@jjo.kr)
 * Copyright (C) 2017 KKuTuIO(admin@kkutu.io)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const serverNames = JSON.parse(readFileSync(`${__dirname}/../config/serverNames.json`, 'utf8'));
import Cluster from "cluster";
import { MAIN_PORTS } from '../config.js';
import * as IOLog from '../sub/KKuTuIOLog.js';

let SID = Number(process.argv[2]);
let CPU = Number(process.argv[3]); //await import("os").cpus().length;

const serverName = serverNames[SID];
global.serverName = serverName;
global.serverIdentity = 'none';

if (isNaN(SID)) {
    if (process.argv[2] == "test") {
        global.test = true;
        CPU = 1;
    } else {
        IOLog.emerg(`Invalid Server ID ${process.argv[2]}`);
        process.exit(1);
    }
}
if (isNaN(CPU)) {
    IOLog.emerg(`Invalid CPU Number ${process.argv[3]}`);
    process.exit(1);
}
if (Cluster.isMaster) {
    global.serverIdentity = 'master';

    let channels = {}, chan;
    let i;

    for (i = 0; i < CPU; i++) {
        chan = i + 1;
        channels[chan] = Cluster.fork({
            SERVER_NO_FORK: true,
            KKUTU_PORT: MAIN_PORTS[SID] + 416 + i,
            CHANNEL: chan
        });
    }
    Cluster.on('exit', function (w) {
        for (i in channels) {
            if (channels[i] == w) {
                chan = Number(i);
                break;
            }
        }
        IOLog.emerg(`Worker @${chan} ${w.process.pid} died`);
        channels[chan] = Cluster.fork({
            SERVER_NO_FORK: true,
            KKUTU_PORT: MAIN_PORTS[SID] + 416 + (chan - 1),
            CHANNEL: chan
        });
    });
    process.env['KKUTU_PORT'] = MAIN_PORTS[SID];
    const MASTER = await import("./master.js");
    MASTER.init(SID.toString(), channels);
} else {
    const channel = process.env['CHANNEL'];
    global.serverIdentity = `slave-${channel}`;

    const SLAVE = await import("./slave.js");
}