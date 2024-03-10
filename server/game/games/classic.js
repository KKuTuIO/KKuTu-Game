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

import { Tail, all as LizardAll } from '../../sub/lizard.js';
import * as IOLog from '../../sub/KKuTuIOLog.js';
import { DB, DIC, runAs, shuffle, getMission, getChar, getSubChar, getPenalty,
    getRandom, getManner, getWordList, getPreScore, getRandomChar,
    ROBOT_START_DELAY, ROBOT_HIT_LIMIT, ROBOT_LENGTH_LIMIT,
    ROBOT_THINK_COEF, ROBOT_TYPE_COEF, EXAMPLE_TITLE, GAME_TYPE,
    KOR_GROUP, ENG_ID, JPN_ID, KOR_FLAG, KOR_STRICT } from './_common.js';

let WISH_WORD_CACHE = {'ko': {}, 'en': {}};

export function getTitle () {
    let R = new Tail();
    let my = this;
    let l = my.rule;
    let EXAMPLE;
    let eng, ja;

    if (!l) {
        R.go("undefinedd");
        return R;
    }
    if (!l.lang) {
        R.go("undefinedd");
        return R;
    }
    EXAMPLE = EXAMPLE_TITLE[l.lang];
    my.game.dic = {};

    switch (GAME_TYPE[my.mode]) {
        case 'EKT':
        case 'ESH':
        case 'EAP':
            eng = "^" + String.fromCharCode(97 + Math.floor(Math.random() * 26));
            break;
        case 'KKT':
            my.game.wordLength = 3;
        case 'KSH':
        case 'KAP':
            ja = 44032 + 588 * Math.floor(Math.random() * 18);
            eng = "^[\\u" + ja.toString(16) + "-\\u" + (ja + 587).toString(16) + "]";
            break;
        case 'JSH':
        case 'JAP':
            ja = 12353 + 2 * Math.floor(Math.random() * 39);
            eng = "^[\\u" + ja.toString(16) + "-\\u" + (ja + 1).toString(16) + "]";
    }

    function tryTitle(h) {
        if (h > 50) {
            R.go(EXAMPLE);
            return;
        }
        let titleFilter;
        switch (l.lang) {
            case 'ko':
                titleFilter = ['type', KOR_GROUP];
                break;
            case 'en':
                titleFilter = ['_id', ENG_ID];
                break;
            case 'ja':
                titleFilter = ['_id', JPN_ID];
                break;
        }
        DB.kkutu[l.lang].find(
            ['_id', new RegExp(eng + ".{" + Math.max(1, my.round - 1) + "}$")],
            // [ 'hit', { '$lte': h } ],
            titleFilter,
            // '$where', eng+"this._id.length == " + Math.max(2, my.round) + " && this.hit <= " + h
        ).limit(20).on(function ($md) {
            let list;

            if ($md.length) {
                list = shuffle($md);
                checkTitle(list.shift()._id).then(onChecked);

                function onChecked(v) {
                    if (v) R.go(v);
                    else if (list.length) checkTitle(list.shift()._id).then(onChecked);
                    else R.go(EXAMPLE);
                }
            } else {
                tryTitle(h + 10);
            }
        });
    }

    function checkTitle(title) {
        let R = new Tail();
        let i;
        let len, count;

        /* 부하가 너무 걸린다면 주석을 풀자.
        R.go(true);
        return R;
        */
        if (title == null) {
            R.go(EXAMPLE);
        } else {
            len = title.length;
            for (i = 0; i < len; i++) {
                count = getWordList.call(my, title[i], getSubChar.call(my, title[i]), true).length;
                if (!count) {
                    R.go(EXAMPLE);
                    return R;
                }
            }
            R.go(title);
        }
        return R;
    }

    tryTitle(10);
    return R;
}
export function roundReady () {
    let my = this;
    if (!my.game.title) return;

    clearTimeout(my.game.turnTimer);
    my.game.round++;
    my.game.roundTime = my.time * 1000;
    if (my.game.round <= my.round) {
        let o;
        let isFirstRound = my.game.round == 1;
        my.game.char = my.game.title[my.game.round - 1];
        my.game.subChar = getSubChar.call(my, my.game.char);
        my.game.chain = [];
        my.game.manner = {};
        my.game.manner_alt = {};
        if (my.opts.mission) my.game.mission = getMission(my.rule.lang, my.opts.tactical);
        if (my.opts.sami) my.game.wordLength = 2;
        if (my.opts.item) {
            if (isFirstRound) {
                my.game.item = {};
                my.game.used = {};
                my.game.rev = false;
                my.game.ilock = false;
            }
            for (o of my.game.seq) {
                let t = o.robot ? o.id : o;
                my.game.item[t] = [0, 0, 0, 0, 0];
                my.game.used[t] = 0;
                my.game.ilock = false;
            }
        }

        my.byMaster('roundReady', {
            round: my.game.round,
            char: my.game.char,
            subChar: my.game.subChar,
            mission: my.game.mission
        }, true);
        my.game.turnTimer = setTimeout(runAs, 2400, my, my.turnStart);
    } else {
        my.roundEnd();
    }
}
export function turnStart (force) {
    let my = this;
    let speed;
    let si;

    if (!my.game.chain) return;
    my.game.roundTime = Math.min(my.game.roundTime, Math.max(10000, 150000 - my.game.chain.length * 1500));
    speed = my.getTurnSpeed(my.game.roundTime);
    clearTimeout(my.game.turnTimer);
    clearTimeout(my.game.robotTimer);
    my.game.late = false;
    my.game.turnTime = 15000 - 1400 * speed;
    my.game.turnAt = (new Date()).getTime();
    if (my.opts.sami) my.game.wordLength = (my.game.wordLength == 3) ? 2 : 3;
    if (my.opts.mission && my.opts.randmission) my.game.mission = getMission(my.rule.lang, my.opts.tactical);
    my.game.random = false;
    my.game.ilock = false;

    my.byMaster('turnStart', {
        turn: my.game.turn,
        char: my.game.char,
        subChar: my.game.subChar,
        speed: speed,
        roundTime: my.game.roundTime,
        turnTime: my.game.turnTime,
        mission: my.game.mission,
        wordLength: my.game.wordLength,
        seq: force ? my.game.seq : undefined
    }, true);
    my.game.turnTimer = setTimeout(runAs, Math.min(my.game.roundTime, my.game.turnTime + 100), my, my.turnEnd);
    if (si = my.game.seq[my.game.turn]) if (si.robot) {
        my.readyRobot(si);
    }
}
export function turnEnd () {
    let my = this;
    let target;
    let score;

    if (!my.game.seq) return;
    target = DIC[my.game.seq[my.game.turn]] || my.game.seq[my.game.turn];

    if (my.game.loading) {
        my.game.turnTimer = setTimeout(runAs, 100, my, my.turnEnd);
        return;
    }
    my.game.late = true;

    let WL = getWordList.call(my, my.game.char, my.game.subChar);
    if (target) if (target.game) {
        if (!getManner.call(my, my.game.char, my.game.subChar) && (my.opts.safe || my.opts.gentle)) {
            score = 0; // 특수규칙 "안전" - 기능 변경됐지만 일부 허점이 있을 수 있음을 감안하여 코드 유지
        } else {
            score = getPenalty(my.game.chain, target.game.score);
        }
        target.game.score += score;
    }
    /**
     * TODO: 공격 성공 시 점수 보너스
     * 바로 전 사람은 공격 성공 시

    else {
        let mannerBonus = (10 - getManner.call(my, my.game.char, my.game.subChar));
        if(mannerBonus < 0) mannerBonus = 0;

        score = mannerBonus * 10;
    }
     **/

    my.byMaster('turnEnd', {
        ok: false,
        target: target ? target.id : null,
        score: score,
        hint: getRandom(WL)
    }, true);

    my.game._rrt = setTimeout(runAs, 3000, my, my.roundReady);
    clearTimeout(my.game.robotTimer);
}
export function submit (client, text) {
    let score, l, t;
    let my = this;
    let tv = (new Date()).getTime();
    let mgt = my.game.seq[my.game.turn];

    if (!mgt) return;
    if (!mgt.robot) if (mgt != client.id) return;
    if (!my.game.char) return;

    let match = isChainable(text, my.mode, my.game.char, my.game.subChar);
    if (!match) return client.chat(text);
    if (my.game.chain.indexOf(text) != -1) return client.publish('turnError', {code: 409, value: text}, true);

    l = my.rule.lang;
    my.game.loading = true;

    function onDB($doc) {
        if (!my.game.chain) return;
        let preChar;
        if (my.game.random) {
            preChar = getRandomChar.call(my, text)
        } else {
            preChar = getChar.call(my, text);
        }
        if (!preChar) return;
        let preSubChar = getSubChar.call(my, preChar);
        let firstMove = my.game.chain.length < 1;
        let mode = GAME_TYPE[my.mode];

        function preApproved() {
            function approved() {
                if (my.game.late) return;
                if (!my.game.chain) return;
                if (!my.game.dic) return;

                my.game.loading = false;
                my.game.late = true;
                clearTimeout(my.game.turnTimer);
                t = tv - my.game.turnAt;
                score = my.getScore(text, t);
                my.game.dic[text] = (my.game.dic[text] || 0) + 1;
                my.game.chain.push(text);
                my.game.roundTime -= t;
                my.game.char = preChar;
                my.game.subChar = preSubChar;
                client.game.score += score;
                client.publish('turnEnd', {
                    ok: true,
                    value: text,
                    mean: $doc.mean,
                    theme: $doc.theme,
                    wc: $doc.type,
                    score: score,
                    bonus: (my.game.mission === true) ? score - my.getScore(text, t, true) : 0,
                    baby: $doc.baby
                }, true);
                if (my.game.mission === true) {
                    my.game.mission = getMission(my.rule.lang, my.opts.tactical);
                }
                setTimeout(runAs, my.game.turnTime / 6, my, my.turnNext);
                if (!client.robot) {
                    client.invokeWordPiece(text, 1);
                    if (client.game.wpe !== undefined && $doc && my.wpeCheck(my.rule.lang, $doc.theme))
                        client.invokeEventPiece(text, 1);
                    DB.kkutu[l].update(['_id', text]).set(['hit', $doc.hit + 1]).on();
                }
                let theme = $doc.theme.split(',');
                if (($doc.flag & 2) && theme && !theme.includes('hbw')) return; // 어인정 단어 계산 안함
                if (match == preChar || match == preSubChar) return; // 돌림글자 계산 안함
                let currManner = my.game.manner;
                if (my.game.wordLength && my.game.wordLength == 2) currManner = my.game.manner_alt;
                if (!currManner.hasOwnProperty(match)) getManner.call(my, match);
                currManner[match]--;

            }

            let deniedWith = 0;
            do {
                if (firstMove && text.length > 30) {
                    deniedWith = 410;
                    break;
                }

                if (firstMove || my.opts.manner) {
                    let initCount = getWordList.call(my, preChar, preSubChar).length;
                    if (!initCount) {
                        deniedWith = firstMove ? 402 : 403;
                        break;
                    }
                }

                if (my.opts.safe) {
                    let count = getManner.call(my, preChar, preSubChar);
                    if (!count) {
                        deniedWith = 408;
                        break;
                    }
                }
            } while (false);

            if (deniedWith) {
                denied(deniedWith);
                if (client.robot) {
                    my.readyRobot(client);
                }
            }
            else approved();
        }

        function denied(code) {
            my.game.loading = false;
            client.publish('turnError', {code: code || 404, value: text}, true);
        }

        if ($doc) {
            let theme = $doc.theme.split(',');
            if (!my.opts.injeong && ($doc.flag & KOR_FLAG.INJEONG)) denied();
            else if (mode != "KKT" && ($doc.flag & KOR_FLAG.KUNG)) denied();
            else if (my.opts.strict && (!$doc.type.match(KOR_STRICT) || $doc.flag >= 4)) denied(406);
            else if (my.opts.loanword && ($doc.flag & KOR_FLAG.LOANWORD)) denied(405);
            else if (my.opts.safe && theme && theme.includes("SBW")) denied(411);
            else preApproved();
        } else {
            denied();
        }
    }

    function isChainable() {
        let type = GAME_TYPE[my.mode];
        let char = my.game.char, subChar = my.game.subChar;
        let l = char.length;

        if (!text) return false;
        if (text.length <= l) return false;
        if (my.game.wordLength && text.length != my.game.wordLength) return false;
        if (type == "KAP" || type == "EAP" || type == "JAP") {
            if (text.slice(-1) == char) return char;
            if (text.slice(-1) == subChar) return subChar;
            return false;
        }
        switch (l) {
            case 1:
                if (text[0] == char) return char;
                if (text[0] == subChar) return subChar;
            case 2:
                if (text.substr(0, 2) == char) return char;
            case 3:
                if (text.substr(0, 3) == char) return char;
                if (text.substr(0, 2) == char.slice(1)) return char.slice(1);
            default:
                return false;
        }
    }

    if (DB.SUBMIT_WORD_CACHE[l].hasOwnProperty(text)) {
        onDB(DB.SUBMIT_WORD_CACHE[l][text]);
    } else {
        onDB(null);
    }
}

export function useItem (client, id) {
    let my = this;
    if (id < 0 || id > 5) return; // 없는 아이템
    if (my.game.late) return;
    let mgt = my.game.seq[my.game.turn];
    let uid = mgt.robot ? mgt.id : mgt;
    let firstMove = my.game.chain.length < 1;
    let isTurnEnd = true;
    let denied = false;

    if (!mgt) return;
    if (uid != client.id) return;
    if (my.game.ilock) return client.publish('turnError', {code: 420}, true); // 아이템 연속사용
    if (firstMove) return client.publish('turnError', {code: 421}, true); // 첫 턴
    if (my.game.used[uid] >= 5 || my.game.item[uid][id] >= 2) return client.publish('turnError', {code: 429}, true); // 횟수 초과

    switch (id) {
        case 0: // 넘기기 - 다음 사람으로 턴으로 넘김
            break;
        case 1: // 건너뛰기 - 다음 사람의 턴을 넘김
            my.game.queue = 1;
            break;
        case 2: // 뒤로 - 턴 순서를 반대로 만듦
            my.game.rev = !my.game.rev;
            break;
        case 3: // 제시어 변경 - 랜덤 제시어로 변경 (단, 쿵쿵따는 가운데 글자로 바꿈)
            isTurnEnd = true;
            let newChar;
            if (GAME_TYPE[my.mode] == 'KKT') {
                // 쿵쿵따 전용처리
                let chainlen = my.game.chain.length;
                if (!chainlen) {
                    denied = true;
                    break;
                }
                let lastword = my.game.chain[chainlen - 1];
                newChar = lastword.charAt(lastword.length - 2); // 3글자면 2번째, 2글자면 1번째 글자로 제시어 변경

                let count = getWordList.call(my, newChar, getSubChar.call(my, newChar), true).length;
                if (count < 5) denied = true;
            } else {
                newChar = getRandomChar.call(this);
            }
            if (!newChar) denied = true;

            if (!denied) {
                my.game.char = newChar;
                my.game.subChar = getSubChar.call(my, newChar)
                my.game.queue = -1;
            }
            break;
        case 4: // 한번 더 - 단어를 한번 더 입력함
            isTurnEnd = false;
            my.game.queue = -1;
            break;
        case 5: // 무작위 - 무작위 글자를 넘겨줍니다. 쿵쿵따에서는 가운데 글자로 넘겨줍니다.
            isTurnEnd = false;
            my.game.random = true;
    }
    if (denied) {
        return client.publish('turnError', {code: 420}, true);
    }
    my.game.used[uid]++;
    my.game.item[uid][id]++;
    my.game.ilock = true;
    client.publish('useItem', {
        item: id,
        isEnd: isTurnEnd
    }, true);
    // 아이템 사용으로 턴이 종료됨 or 턴을 다시 시작해야함
    if (isTurnEnd) {
        my.game.late = true;
        setTimeout(runAs, my.game.turnTime / 6, my, my.turnNext);
    }
}

export function getScore (text, delay, ignoreMission) {
    let my = this;
    let tr = 1 - delay / my.game.turnTime;
    let score, arr;

    if (!text || !my.game.chain || !my.game.dic) return 0;
    score = getPreScore(text, my.game.chain, tr);

    if (my.game.dic[text]) score *= 15 / (my.game.dic[text] + 15);
    if (!ignoreMission) if (arr = text.match(new RegExp(my.game.mission, "g"))) {
        score += score * 0.5 * arr.length;
        my.game.mission = true;
    }
    return Math.round(score);
}
export function readyRobot (robot) {
    let my = this;
    let level = robot.level;
    let delay = ROBOT_START_DELAY[level];
    let ended = {};
    let word, text, i, c;
    let lmax;
    let mode = GAME_TYPE[my.mode];
    let isRev = mode == "KAP" || mode == "EAP" || mode == "JAP";
    let list = getWordList.call(my, my.game.char, my.game.subChar, true)
    if (list && list.length) {
        let highestHit = 0;
        for (word of list) {
            if (highestHit < word.hit) highestHit = word.hit;
            if (ROBOT_HIT_LIMIT[level] >= highestHit) break;
        }
        if (ROBOT_HIT_LIMIT[level] > highestHit) denied();
        else {
            if (level >= 3 && (!my.game.chain || !my.game.chain.length)) {
                let longestLen = 0;
                for (word of list) {
                    if (!word || !word._id) continue;
                    if (longestLen < word._id.length) longestLen = word._id.length
                    if (longestLen >= 8) break;
                }
                if (longestLen < 8 && my.game.turnTime >= 2300) {
                    for (word of list) {
                        if (!word || !word._id) continue;
                        c = word._id.charAt(isRev ? 0 : (word._id.length - 1));
                        if (!ended.hasOwnProperty(c)) ended[c] = [];
                        ended[c].push(word);
                    }
                    getWishList(Object.keys(ended)).then(function (key) {
                        let v = ended[key];

                        if (!v) denied();
                        else pickList(v);
                    });
                } else {
                    pickList(list);
                }
            } else pickList(list);
        }
    } else denied();

    function denied() {
        text = isRev ? `T.T ...${my.game.char}` : `${my.game.char}... T.T`;
        after();
    }

    function pickList(list) {
        let target;
        let diff;
        let firstMove = my.game.chain.length < 1;
        if (list) {
            for (word of list) {
                if (my.game.wordLength && word._id.length != my.game.wordLength) continue; // 단어 길이 불일치
                if (word._id.length > ROBOT_LENGTH_LIMIT[level]) continue;
                if (ROBOT_HIT_LIMIT[level] > word.hit) continue;
                if (my.game.chain.includes(word._id)) continue;
                if (!target || target._id.length <= word._id.length) {
                    if (firstMove && word._id.length > 20) continue;
                    if (target) diff = target._id.length - word._id.length;
                    else diff = 99;
                    if (diff == 0) {
                        // 같은 길이의 단어면 1/16으로 단어를 바꿈
                        if (Math.random() * 16 >= 1)
                            continue;
                    } else if (diff <= 5) {
                        // 단어 길이 차가 적으면 1/(8-차이)로 단어 변경 안함
                        if (Math.random() * (8 - diff) < 1)
                            continue;
                    }
                    target = word;
                    // 1/16으로 더 긴 단어를 찾지 않고 그대로 입력
                    if (Math.random() * 16 < 1) break;
                }
            }
        }
        if (target) {
            text = target._id;
            delay += 500 * ROBOT_THINK_COEF[level] * Math.random() / Math.log(1.1 + target.hit);
            after();
        } else denied();
    }

    function after() {
        delay += text.length * ROBOT_TYPE_COEF[level];
        // robot._done.push(text);
        setTimeout(runAs, delay, my, my.turnRobot, robot, text);
    }

    function getWishList(list) {
        let R = new Tail();
        let wz = [];
        let res;

        for (i in list) wz.push(getWish(list[i]));
        LizardAll(wz).then(function ($res) {
            if (!my.game.chain) return;
            $res.sort(function (a, b) {
                return a.length - b.length;
            });

            if (my.opts.manner || !my.game.chain.length) {
                while (res = $res.shift()) if (res.length) break;
            } else res = $res.shift();
            R.go(res ? res.char : null);
        });
        return R;
    }

    function getWish(char) {
        let R = new Tail();
        let len, list;

        if (WISH_WORD_CACHE[my.rule.lang].hasOwnProperty(char)) {
            R.go({char: char, length: WISH_WORD_CACHE[my.rule.lang][char]});
        } else {
            list = getWordList.call(my, char, true);
            len = list.length > 10 ? 10 : list.legnth;
            WISH_WORD_CACHE[my.rule.lang][char] = len;
            R.go({char: char, length: len});
        }
        /* 이중처리..?
        DB.kkutu[my.rule.lang].find(['_id', new RegExp(isRev ? `.${char}$` : `^${char}.`)]).limit(10).on(function ($res) {
            R.go({char: char, length: $res.length});
        });
        */
        return R;
    }
}