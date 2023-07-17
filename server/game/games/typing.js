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

import { Tail } from '../../sub/lizard.js';
import { PROVERBS } from './typing_const.js';
import { DB, DIC, runAs, traverse } from './_common.js';

let LIST_LENGTH = 180;
let DOUBLE_VOWELS = [9, 10, 11, 14, 15, 16, 19];
let DOUBLE_TAILS = [3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18];

export function getTitle () {
    let R = new Tail();
    let my = this;
    let i, j;

    if (my.opts.proverb) pick(PROVERBS[my.rule.lang]);
    else DB.kkutu[my.rule.lang].find(['_id', /^.{2,5}$/], ['hit', {$gte: 50}]).usesub(10000).random().limit(512).on(function ($res) {
        pick($res.map(function (item) {
            return item._id;
        }));
    });

    function pick(list) {
        let data = [];
        let len = list.length;
        let arr;

        for (i = 0; i < my.round; i++) {
            arr = [];
            for (j = 0; j < LIST_LENGTH; j++) {
                arr.push(list[Math.floor(Math.random() * len)]);
            }
            data.push(arr);
        }
        my.game.lists = data;
        R.go("①②③④⑤⑥⑦⑧⑨⑩");
    }

    traverse.call(my, function (o) {
        o.game.spl = 0;
    });
    return R;
}
export function roundReady () {
    let my = this;
    let scores = {};

    if (!my.game.lists) return;

    my.game.round++;
    my.game.roundTime = my.time * 1000;
    if (my.game.round <= my.round) {
        my.game.clist = my.game.lists.shift();
        my.byMaster('roundReady', {
            round: my.game.round,
            list: my.game.clist
        }, true);
        setTimeout(runAs, 2400, my, my.turnStart);
    } else {
        traverse.call(my, function (o) {
            scores[o.id] = Math.round(o.game.spl / my.round);
        });
        my.roundEnd({scores: scores});
    }
}
export function turnStart () {
    let my = this;

    my.game.late = false;
    traverse.call(my, function (o) {
        o.game.miss = 0;
        o.game.index = 0;
        o.game.semi = 0;
    });
    my.game.qTimer = setTimeout(runAs, my.game.roundTime, my, my.turnEnd);
    my.byMaster('turnStart', {roundTime: my.game.roundTime}, true);
}
export function turnEnd () {
    let my = this;
    let spl = {};
    let sv;

    my.game.late = true;
    traverse.call(my, function (o) {
        sv = (o.game.semi + o.game.index - o.game.miss) / my.time * 60;
        spl[o.id] = Math.round(sv);
        o.game.spl += sv;
    });
    my.byMaster('turnEnd', {
        ok: false,
        speed: spl
    });
    my.game._rrt = setTimeout(runAs, (my.game.round == my.round) ? 3000 : 10000, my, my.roundReady);
}
export function submit (client, text) {
    let my = this;
    let score;

    if (!client.game) return;

    if (my.game.clist[client.game.index] == text) {
        score = my.getScore(text);

        client.game.semi += score;
        client.game.score += score;
        client.publish('turnEnd', {
            target: client.id,
            ok: true,
            value: text,
            score: score
        }, true);
        client.invokeWordPiece(text, 0.5);
        // 현재로썬 테마 검증이 불가능, 다른 이벤트 하기 전에 고치거나 비활성화
        if (client.game.wpe !== undefined && my.wpeCheck(my.rule.lang))
            client.invokeEventPiece(text, 0.5);
    } else {
        client.game.miss++;
        client.send('turnEnd', {error: true});
    }
    if (!my.game.clist[++client.game.index]) client.game.index = 0;
}
export function getScore (text) {
    let my = this;
    let i, len = text.length;
    let r = 0, s, t;

    switch (my.rule.lang) {
        case 'ko':
            for (i = 0; i < len; i++) {
                s = text.charCodeAt(i);
                if (s < 44032) {
                    r++;
                } else {
                    t = (s - 44032) % 28;
                    r += t ? 3 : 2;
                    if (DOUBLE_VOWELS.includes(Math.floor(((text.charCodeAt(i) - 44032) % 588) / 28))) r++;
                    if (DOUBLE_TAILS.includes(t)) r++;
                }
            }
            return r;
        case 'en':
            return len;
        default:
            return r;
    }
}