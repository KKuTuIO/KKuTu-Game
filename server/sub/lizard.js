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

export function all (tails) {
    let R = new Tail([]);
    let left = tails.length;
    let i;

    if (left == 0) R.go(true);
    else for (i in tails) {
        if (tails[i]) tails[i].then(onEnded, Number(i));
        else left--;
    }

    function onEnded(data, __i) {
        R.returns[__i] = data;
        if (--left == 0) R.go(R.returns);
    }

    return R;
}

export function Tail (res) {
    let callback, value = undefined;
    let _i;

    this.returns = res;
    this.go = function (data) {
        if (callback) callback(data, _i);
        else value = data;
    };
    this.then = function (cb, __i) {
        _i = __i;

        if (value === undefined) callback = cb;
        else cb(value, __i);
    };
}