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
import { DB, DIC, runAs, getTheme, getThemeWords, getRandom,
    ROBOT_CATCH_RATE, ROBOT_TYPE_COEF, KOR_GROUP, WPE_CHECK } from './_common.js';

let robotTimers = {};
const INIT_SOUNDS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export function getTitle () {
    let R = new Tail();
    let my = this;

    my.game.done = [];
    setTimeout(function () {
        R.go("①②③④⑤⑥⑦⑧⑨⑩");
    }, 500);
    return R;
}
export function roundReady () {
    let my = this;
    let ijl = my.opts.injpick.length;

    clearTimeout(my.game.qTimer);
    clearTimeout(my.game.hintTimer);
    clearTimeout(my.game.hintTimer2);
    my.game.themeBonus = 0.3 * Math.log(0.6 * ijl + 1);
    my.game.winner = [];
    my.game.giveup = [];
    my.game.round++;
    my.game.roundTime = my.time * 1000;
    if (my.game.round <= my.round) {
        my.game.theme = getTheme.call(my);
        let words = getThemeWords.call(my, my.game.theme);
        let $ans;
        let minlen = my.opts.no2 ? 3 : 2;
        do {
            $ans = getRandom(words);
        } while ($ans._id.length < minlen || my.game.done.includes($ans._id));
        if (!my.game.done) return;

        // $ans가 null이면 골치아프다...
        my.game.late = false;
        my.game.answer = $ans || {};
        my.game.done.push($ans._id);
        $ans.mean = ($ans.mean.length > 5) ? $ans.mean : getConsonants($ans._id, Math.round($ans._id.length / 2));
        my.game.hint = getHint.call(my, $ans);
        my.byMaster('roundReady', {
            round: my.game.round,
            theme: my.game.theme
        }, true);
        setTimeout(runAs, 2400, my, my.turnStart);
    } else {
        my.roundEnd();
    }
}
export function turnStart () {
    let my = this;
    let i;

    if (!my.game.answer) return;

    my.game.conso = getConsonants(my.game.answer._id, 1);
    my.game.roundAt = (new Date()).getTime();
    my.game.meaned = 0;
    my.game.primary = 0;
    my.game.qTimer = setTimeout(runAs, my.game.roundTime, my, my.turnEnd);
    my.game.hintTimer = setTimeout(function () {
        turnHint.call(my);
    }, my.game.roundTime * 0.333);
    my.game.hintTimer2 = setTimeout(function () {
        turnHint.call(my);
    }, my.game.roundTime * 0.667);
    my.byMaster('turnStart', {
        char: my.game.conso,
        roundTime: my.game.roundTime
    }, true);

    for (i in my.game.robots) {
        my.readyRobot(my.game.robots[i]);
    }
}

function turnHint() {
    let my = this;

    my.byMaster('turnHint', {
        hint: my.game.hint[my.game.meaned++]
    }, true);
}

export function turnEnd () {
    let my = this;

    if (my.game.answer) {
        my.game.late = true;
        my.byMaster('turnEnd', {
            answer: my.game.answer ? my.game.answer._id : ""
        });
    }
    my.game._rrt = setTimeout(runAs, 2500, my, my.roundReady);
}
export function submit (client, text) {
    let my = this;
    let score, t, i;
    let $ans = my.game.answer;
    let now = (new Date()).getTime();
    let play = (my.game.seq ? my.game.seq.includes(client.id) : false) || client.robot;
    let gu = my.game.giveup ? my.game.giveup.includes(client.id) : true;

    if (!my.game.winner) return;
    if (my.game.winner.indexOf(client.id) == -1
        && text == $ans._id
        && play && !gu
    ) {
        t = now - my.game.roundAt;
        if (my.game.primary == 0) if (my.game.roundTime - t > 10000) { // 가장 먼저 맞힌 시점에서 10초 이내에 맞히면 점수 약간 획득
            clearTimeout(my.game.qTimer);
            my.game.qTimer = setTimeout(runAs, 10000, my, my.turnEnd);
            for (i in my.game.robots) {
                if (my.game.roundTime > my.game.robots[i]._delay) {
                    clearTimeout(my.game.robots[i]._timer);
                    if (client != my.game.robots[i]) if (Math.random() < ROBOT_CATCH_RATE[my.game.robots[i].level])
                        my.game.robots[i]._timer = setTimeout(runAs, ROBOT_TYPE_COEF[my.game.robots[i].level] * 2, my, my.turnRobot, my.game.robots[i], text);
                }
            }
        }
        clearTimeout(my.game.hintTimer);
        score = my.getScore(text, t);
        my.game.primary++;
        my.game.winner.push(client.id);
        client.game.score += score;
        client.publish('turnEnd', {
            target: client.id,
            ok: true,
            value: text,
            score: score,
            bonus: 0
        }, true);
        client.invokeWordPiece(text, 0.9);
        if (client.game.wpe !== undefined && WPE_CHECK(my.rule.lang, $ans.theme))
            client.invokeEventPiece(text, 0.9);
        while (my.game.meaned < my.game.hint.length) {
            turnHint.call(my);
        }
    } else if (play && !gu && (text == "gg" || text == "ㅈㅈ")) {
        my.game.giveup.push(client.id);
        client.publish('turnEnd', {
            target: client.id,
            giveup: true
        }, true);
    } else {
        client.chat(text);
    }
    if (play) if (my.game.primary + my.game.giveup.length >= my.game.seq.length) {
        clearTimeout(my.game.hintTimer);
        clearTimeout(my.game.hintTimer2);
        clearTimeout(my.game.qTimer);
        my.turnEnd();
    }
}
export function getScore (text, delay) {
    let my = this;
    let rank = my.game.hum - my.game.primary + 3;
    let tr = 1 - delay / my.game.roundTime;
    let score = 6 * Math.pow(rank, 1.4) * (0.5 + 0.5 * tr);

    return Math.round(score * my.game.themeBonus);
}
export function readyRobot (robot) {
    let my = this;
    let level = robot.level;
    let delay, text;
    let i;

    if (!my.game.answer) return;
    clearTimeout(robot._timer);
    robot._delay = 99999999;
    for (i = 0; i < 2; i++) {
        if (Math.random() < ROBOT_CATCH_RATE[level]) {
            text = my.game.answer._id;
            delay = my.game.roundTime / 3 * i + text.length * ROBOT_TYPE_COEF[level] * 2;
            robot._timer = setTimeout(runAs, delay, my, my.turnRobot, robot, text);
            robot._delay = delay;
            break;
        }
    }
}

function getConsonants(word, lucky) {
    let R = "";
    let i, len = word.length;
    let c;
    let rv = [];

    lucky = lucky || 0;
    while (lucky > 0) {
        c = Math.floor(Math.random() * len);
        if (rv.includes(c)) continue;
        rv.push(c);
        lucky--;
    }
    for (i = 0; i < len; i++) {
        c = word.charCodeAt(i) - 44032;

        if (c < 0 || rv.includes(i)) {
            R += word.charAt(i);
            continue;
        } else c = Math.floor(c / 588);
        R += INIT_SOUNDS[c];
    }
    return R;
}

function getHint($ans) {
    let my = this;
    let R = [];
    let h1;
    let h2;
    let c = 0
    if ($ans.mean.replace(/＂\d+＂|［\d+］|（\d+）|\s/g,"").length) {
        h1 = $ans.mean.replace(new RegExp($ans._id, "g"), "★");
        if (my.opts.antisynonym) h1 = h1.replace(/([=≒])[^＂［（]+/g,'$1 ☆');
    } else {
        do {
            h1 = getConsonants($ans._id, Math.ceil($ans._id.length / 3));
        } while ($ans._id.length > 4 && h1 == my.game.conso && c++ < 20);
    }
    R.push(h1);
    c = 0;
    do {
        h2 = getConsonants($ans._id, Math.ceil($ans._id.length / 2));
    } while ($ans._id.length > 3 && (h1 == h2 || h2 == my.game.conso) && c++ < 20);
    R.push(h2);

    return R;
}

function getAnswer(theme, nomean) {
    let my = this;
    let R = new Tail();
    let args = [['_id', {$nin: my.game.done}]];

    args.push(['theme', new RegExp("(,|^)(" + theme + ")(,|$)")]);
    args.push(['type', KOR_GROUP]);
    args.push(['flag', {$lte: 7}]);
    DB.kkutu['ko'].find.apply(my, args).on(function ($res) {
        if (!$res) return R.go(null);
        let pick;
        let len = $res.length;

        if (!len) return R.go(null);
        let minlen = my.opts.no2 ? 3 : 2;
        do {
            pick = Math.floor(Math.random() * len);
            if ($res[pick]._id.length >= minlen && ($res[pick]._id.length < 26 || my.opts.nolimit)) {
                return R.go($res[pick]);
            }
            $res.splice(pick, 1);
            len--;
        } while (len > 0);
        R.go(null);
    });
    return R;
}