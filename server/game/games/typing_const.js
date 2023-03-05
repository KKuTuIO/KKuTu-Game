/**
 * Rule the words! KKuTu Online
 * Copyright (C) 2017 JJoriping(op@jjo.kr)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { readFile } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

export let PROVERBS = {
    'ko': [],
    'en': []
};

readFile(`${__dirname}/../../data/proverbs.txt`, function (err, res) {
    if (err) throw Error(err.toString());
    let db = res.toString().split('~~~');

    db.forEach(function (item) {
        let lang = item.slice(0, 2);

        PROVERBS[lang] = item.slice(3).split('\n');
    });
});