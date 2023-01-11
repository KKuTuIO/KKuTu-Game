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
import { Tail } from '../../sub/lizard.js';
import MultiArray from 'multiarr';
export let DB;
export let DIC;

export const ROBOT_START_DELAY = [ 1200, 800, 500, 300, 150, 10 ];
export const ROBOT_TYPE_COEF = [ 1150, 750, 500, 300, 150, 5 ]; // 자음퀴즈는 두배로 사용
export const ROBOT_THINK_COEF = [ 4, 3, 2, 1, 0, 0 ];
export const ROBOT_HIT_LIMIT = [ 8, 6, 4, 2, 1, 0 ]; // 단어대결은 절반으로 사용
export const ROBOT_LENGTH_LIMIT = [ 3, 7, 11, 33, 66, 99 ];

// 십자말풀이, 해당 부분이 더미데이터라 제외함
// export const ROBOT_SEEK_DELAY = [ 5000, 3500, 2000, 1200, 600, 100 ];
// export const ROBOT_CATCH_RATE = [ 0.05, 0.2, 0.35, 0.5, 0.7, 0.99 ];
// export const ROBOT_TYPE_COEF = [ 2000, 1200, 900, 600, 300, 10 ];

// 자퀴 정답률
export const ROBOT_CATCH_RATE = [0.1, 0.3, 0.5, 0.65, 0.8, 0.99];

const RIEUL_TO_NIEUN = [4449, 4450, 4457, 4460, 4462, 4467];
const RIEUL_TO_IEUNG = [4451, 4455, 4456, 4461, 4466, 4469];
const NIEUN_TO_IEUNG = [4455, 4461, 4466, 4469];
const POWER_KKT = {
    "ORIGINAL": [
        "렁", "래", "럽", "는", "른", "렛", "럼", "럴", "냥", "렇", "냐", "렘",
        "럿", "렙", "렐", "뤄", "녜", "렝", "뤼", "럭", "렉", "냘", "냠", "레",
        "러", "런", "렌"
    ],
    "REPLACE_TO": [
        "넝", "내", "넙", "은", "은", "넷", "넘", "널", "양", "넣", "야", "넴",
        "넛", "넵", "넬", "눠", "예", "넹", "뉘", "넉", "넥", "얕", "얌", "네",
        "너", "넌", "넨"
    ],
};

export function init (_DB, _DIC) {
    DB = _DB;
    DIC = _DIC;
}

export function shuffle (arr) {
    let r = [...arr];
    r.sort(function (a, b) { return Math.random() - 0.5; });
    
    return r;
}

export function getRandom (arr) {
    if (!arr || arr.length < 1) return;
    return arr[Math.floor(Math.random() * arr.length)];
}

export function getTheme () {
    let my = this;

    if (!my.game) return;
    if (!(my.opts.injpick && my.opts.injpick.length)) return;
    if (!(my.game.pool && my.game.pool.length)) {
        my.game.pool = shuffle([...my.opts.injpick]);
    }
    return my.game.pool.pop();
}

export function getChar (text) {
    let my = this;
    
    switch (Const.GAME_TYPE[my.mode]) {
        case 'EKT':
            return text.slice(text.length - 3);
        case 'KAP':
        case 'EAP':
        case 'JAP':
            return text.charAt(0);
        case 'KWS':
            if (my.opts.reverse) return text.charAt(0);
        default:
            return text.slice(-1);
    }
}

export function getSubChar(char) {
    let my = this;
    let r;
    let c = char.charCodeAt();
    let k;
    let ca, cb, cc;

    switch (Const.GAME_TYPE[my.mode]) {
        case "EKT":
            if (char.length > 2) r = char.slice(1);
            break;
        case "KKT":
        case "KSH":
        case "KAP":
        case "KWS":
            if (my.opts.power && POWER_KKT.ORIGINAL.includes(char)) {
                r = POWER_KKT.REPLACE_TO[POWER_KKT.ORIGINAL.indexOf(char)];
                break;
            }
            k = c - 0xAC00;
            if (k < 0 || k > 11171) break;
            ca = [Math.floor(k / 28 / 21), Math.floor(k / 28) % 21, k % 28];
            cb = [ca[0] + 0x1100, ca[1] + 0x1161, ca[2] + 0x11A7];
            cc = false;
            if (cb[0] == 4357) { // ㄹ에서 ㄴ, ㅇ
                cc = true;
                if (RIEUL_TO_NIEUN.includes(cb[1])) cb[0] = 4354;
                else if (RIEUL_TO_IEUNG.includes(cb[1])) cb[0] = 4363;
                else cc = false;
            } else if (cb[0] == 4354) { // ㄴ에서 ㅇ
                if (NIEUN_TO_IEUNG.indexOf(cb[1]) != -1) {
                    cb[0] = 4363;
                    cc = true;
                }
            }
            if (cc) {
                cb[0] -= 0x1100;
                cb[1] -= 0x1161;
                cb[2] -= 0x11A7;
                r = String.fromCharCode(((cb[0] * 21) + cb[1]) * 28 + cb[2] + 0xAC00);
            }
            break;
        default:
            break;
    }
    return r;
}

export function traverse (func) {
    let my = this;
    let i, o;
    
    for(i in my.game.seq) {
        if (!(o = DIC[my.game.seq[i]])) continue;
        if (!o.game) continue;
        func(o);
    }
}

export function toRegex(theme) {
    return new RegExp(`(^|,)${theme}($|,)`);
}

export function hunminRegex (theme) {
    let arg = theme.split('').map((item) => {
        let c = item.charCodeAt();
        let a = 44032 + 588 * (c - 4352), b = a + 587;
        
        return `[\\u${a.toString(16)}-\\u${b.toString(16)}]`;
    }).join('');
    
    return new RegExp(`^(${arg})$`);
}

export function getAuto (char, subc, type, chain) {
    /* type
        0 무작위 단어 하나
        1 존재 여부
        2 단어 목록
    */
    let my = this;
    let theme;
    if (type === undefined) {
        theme = char;
        type = subc;
    }
    if (chain === undefined) chain = my.game.chain;
    let R = new Tail();
    let gameType = Const.GAME_TYPE[my.mode];
    let aqs, adc, aft;
    let bool = type == 1;
    
    if (my.rule.rule == "Classic" || my.rule.rule == "Wordstack")
        adc = char + (subc ? ("|"+subc) : "");

    switch (gameType) {
        case 'EKT':
            aqs = [ '_id', new RegExp(`^(${adc})..`) ];
            break;
        case 'KSH':
        case 'KWS':
        case 'JSH':
            aqs = [ '_id', new RegExp(`^(${adc}).`) ];
            break;
        case 'ESH':
        case 'EWS':
            aqs = [ '_id', new RegExp(`^(${adc})...`) ];
            break;
        case 'KKT':
            aqs = [ '_id', new RegExp(`^(${adc}).{${my.game.wordLength-1}}$`) ];
            break;
        case 'KAP':
        case 'JAP':
            aqs = [ '_id', new RegExp(`.(${adc})$`) ];
            break;
        case 'KDA':
        case 'EDA':
            aqs = [ 'theme', new RegExp(`(^|,)${theme}($|,)`) ];
            break;
        case 'HUN':
            aqs = [ '_id', hunminRegex(theme) ];
            break;
    }
    if (!char) {
        console.log(`Undefined char detected! char=${char} type=${type} subc=${subc}`);
    }
    
    if (!my.opts.injeong) aqs = aqs.concat([ 'flag', { '$nand': Const.KOR_FLAG.INJEONG } ]);
    if (my.rule.lang == "ko") {
        if (my.opts.loanword) aqs = aqs.concat([ 'flag', { '$nand': Const.KOR_FLAG.LOANWORD } ]);
        if (my.opts.strict) aqs = aqs.concat([ 'type', Const.KOR_STRICT ], [ 'flag', { $lte: 3 } ]);
        else aqs = aqs.concat([ 'type', Const.KOR_GROUP ]);
    } else if (my.rule.lang == "en") {
        aqs = aqs.concat([ '_id', Const.ENG_ID ]);
    } else {
        // 한국어, 영어 외 - 현재는 일본어
    }
    switch (type) {
        case 0:
        default:
            aft = function ($md) {
                R.go(getRandom($md));
            };
            break;
        case 1:
            aft = function ($md) {
                R.go(!!$md.length);
            };
            break;
        case 2:
            aft = function ($md) {
                R.go($md);
            };
            break;
    }

    DB.kkutu[my.rule.lang].find(aqs).limit(bool ? 1 : 123).on(function ($md) {
        if (chain) aft($md.filter(function (item) { return !chain.includes(item); }));
        else aft($md);
    });

    return R;
}

export function getMission(l, t) {
    let arr = Const.MISSION[l] || [];
    if (t && Const.MISSION_TACT.hasOwnProperty(l))
        arr = arr.concat(Const.MISSION_TACT[l]);

    if (!arr) return "-";
    return getRandom(arr);
}

export function getManner(char, subc) {
    let my = this;
    let MAN = DB.MANNER_CACHE[my.rule.lang];
    let mode = Const.GAME_TYPE[my.mode];
    let gameCache = (my.opts.sami && my.game.wordLength == 3) ?
                    my.game.manner_alt : my.game.manner;

    if (!gameCache) return;

    if (gameCache && !gameCache.hasOwnProperty(char)) gameCache[char] = getWordList.call(my, char).length;

    if (!subc) return gameCache[char];

    if (gameCache && !gameCache.hasOwnProperty(subc)) gameCache[subc] = getWordList.call(my, subc).length;

    return gameCache[char] + gameCache[subc];
}

export function getWordList(char, subc, iij) {
    let my = this;
    let MAN = DB.MANNER_CACHE[my.rule.lang];
    let mode = Const.GAME_TYPE[my.mode];
    let R = new MultiArray();

    if (mode == "EKT" || mode == "KKT") {
        if (mode != "EKT" || char.length != 1)
            return getSpcWordList.call(my, char, subc, iij);
    }

    let baseIndex = (mode == "KAP" || mode == "EAP" || my.opts.reverse) ? 1 : 0;

    if (!MAN.hasOwnProperty(char)) {
        // 처리 없음
    } else if (my.rule.lang == 'ko') {
        R.append(MAN[char][baseIndex][0]); // 일반 단어
        if (!my.opts.strict) R.append(MAN[char][baseIndex][1]); // 깐깐
        if (!my.opts.loanword) R.append(MAN[char][baseIndex][2]); // 우리말
        if (my.opts.injeong) {
            R.append(MAN[char][baseIndex][3]); // HBW 어인정
            if (iij) R.append(MAN[char][baseIndex][4]); // 나머지 어인정
        }
    } else {
        R.append(MAN[char][baseIndex][0]); // 한국어 외
        if (my.opts.injeong && iij) R.append(MAN[char][baseIndex][1])
    }
    
    if (subc) R = R.concat(getWordList.call(my, subc));
    return R;
}

function getSpcWordList(char, subc, iij) {
    // 쿵쿵따, 끄투는 여기서 처리
    let my = this;
    let MAN = DB.SPC_MANNER_CACHE[my.rule.lang];
    let baseIndex = (my.opts.sami && my.game.wordLength == 3) ? 1 : 0;
    let R = new MultiArray();

    if (!char) return R;

    if (!MAN.hasOwnProperty(char)) {
        // 처리 없음
    } else if (my.rule.lang == 'ko') {
        R.append(MAN[char][baseIndex][0]); // 일반 단어
        if (!my.opts.strict) R.append(MAN[char][baseIndex][1]); // 깐깐
        if (!my.opts.loanword) R.append(MAN[char][baseIndex][2]); // 우리말
        if (my.opts.injeong) {
            R.append(MAN[char][baseIndex][3]); // HBW 어인정
            if (iij) R.append(MAN[char][baseIndex][4]); // 나머지 어인정
        }
    } else {
        R.append(MAN[char][0]); // 한국어 외
        if (my.opts.injeong && iij) R.append(MAN[char][1]);
    }
    
    if (!subc) return R;

    return R.concat(getSpcWordList.call(my, subc));
}

export function getThemeWords (theme) {
    let my = this;
    if (!theme) return;
    
    let CACHE = DB.THEME_CACHE[my.rule.lang];
    if (CACHE.hasOwnProperty(theme)) return CACHE[theme];
}

export function getRandomChar (text) {
    let my = this;
    let mode = Const.GAME_TYPE[my.mode];
    let isSpc = (mode == "EKT" || mode == "KKT")
    let chars = [];
    if (!text) {
        let MAN = (isSpc ? DB.SPC_MANNER_CACHE : DB.MANNER_CACHE)[my.rule.lang];
        chars = Object.keys(MAN);
    } else {
        if (mode == "KKT") { // 쿵쿵따는 항상 끝 글자의 앞 글자 반환
            chars = [text.charAt(text.length - 2)]
        } else if (mode == "EKT") {
            for (var i in text) {
                let c = text.slice(i, i + 3);
                if (c.length == 3) chars.push(c);
                else break;
            }
        } else {
            chars = [...text];
        }
    }
    let tries = 20;
    let target, sub, count;
    do {
        target = getRandom(chars);
        if (mode == "EKT" && target.length != 3) continue;
        sub = getSubChar.call(my, target);
        count = getWordList.call(my, target, sub).length;
        if (count > 5) return target;
    } while (tries--)
}

const log05 = Math.log(0.5);

export function getPreScore (text, chainArr, tr) {
    let chain = ((chainArr || []).length || 1);
    chain = Math.pow(Math.abs(Math.log(chain) / log05), 2.1) + ((7+chain)/8);
    chain = Math.floor(chain);
    return 2 * (Math.pow(5 + 7 * (text || "").length, 0.74) + 0.88 * chain) * (0.5 + 0.5 * tr);
}
export function getPenalty (chain, score) {
    return -1 * Math.round(Math.min(10 + (chain || []).length * 2.1 + score * 0.15, score));
}