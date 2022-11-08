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

import * as Const from '../../const.js';
import { Tail, all as LizardAll } from '../../sub/lizard.js';
let DB;
let DIC;
let ROOM;

export function init (_DB, _DIC, _ROOM) {
    DB = _DB;
    DIC = _DIC;
    ROOM = _ROOM;
}
export function getTitle () {
    let R = new Tail();
    let my = this;

    return R;
}
export function roundReady () {
    let my = this;

}
export function turnStart () {
    let my = this;

}
export function turnEnd () {
    let my = this;

}
export function submit (client, text, data) {
    let my = this;

}
export function getScore (text, delay) {
    let my = this;


    return 0;
}