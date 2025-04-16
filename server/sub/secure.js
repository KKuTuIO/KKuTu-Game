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

import { WS_SSL_OPTIONS } from '../config.js';
import { readFileSync } from 'fs';

export default function () {
    const SSL_OPTIONS = WS_SSL_OPTIONS
    const options = {};

    if (SSL_OPTIONS.isPFX === true) {
        options.pfx = readFileSync(SSL_OPTIONS.PFX);
        options.passphrase = SSL_OPTIONS.PFXPass;
    } else {
        options.key = readFileSync(SSL_OPTIONS.PRIVKEY);
        options.cert = readFileSync(SSL_OPTIONS.CERT);
        if (SSL_OPTIONS.isCA === true) {
            options.ca = readFileSync(SSL_OPTIONS.CA);
        }
    }

    return options;
}