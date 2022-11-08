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

import GLOBAL from "./sub/global.json" assert { type: "json" };
export const { MAIN_PORTS, DISCORD_WEBHOOK,
    IS_WS_SECURED, WS_SSL_OPTIONS } = GLOBAL;

export const KKUTU_CLASSIC_COUNT = 0;
export const KKUTU_MAX = 400;
export const TEST_PORT = 4040;
export const CHAT_SPAM_ADD_DELAY = 2000;   //이 시간보다 빨리 치면 도배 카운트 증가
export const CHAT_SPAM_CLEAR_DELAY = 5000; //이 시간 이후 치면 도배 카운트 초기화
export const CHAT_SPAM_LIMIT = 6;          //이 횟수 이상 도배 카운트 올라가면 차단
export const CHAT_BLOCKED_LENGTH = 10000;  //차단됐을 시 이 시간 이후 치면 차단 해제
export const CHAT_KICK_BY_SPAM = 9;        //차단됐을 시 이 횟수 이상 치면 킥
export const SPAM_CLEAR_DELAY = 1600;
export const SPAM_ADD_DELAY = 750;
export const SPAM_LIMIT = 7;
export const BLOCKED_LENGTH = 10000;
export const KICK_BY_SPAM = 9;
export const MAX_OBSERVER = 4;
export const TESTER = GLOBAL.ADMIN.concat([
    "Input tester id here"
]);

// 시간 계산용 1일/1주일 길이
const DAY = 86400000;
const WEEK = DAY * 7;

const STARTING_YEAR = 2022;
const STARTING_MONTH = 10;
const STARTING_DATE = 9;
const STARTING_HOUR = 4;

const WP_DROP_DAYS = 7;
const WP_EXPIRE_GRACE_PERIOD_IN_DAYS = 14;

// 테스트용, 켜두면 관리자는 항상 이벤트 조각을 얻을 수 있음
export const EVENT_FORCE_FOR_ADMIN = false;

// 이벤트 글자조각 드랍 시작 / 종료 / 기간 만료
export const EVENT_WP_DROP_START = new Date(STARTING_YEAR, STARTING_MONTH - 1, STARTING_DATE, STARTING_HOUR).getTime();
export const EVENT_WP_DROP_UNTIL = EVENT_WP_DROP_START + (DAY * WP_DROP_DAYS);
export const EVENT_WP_EXPIRE_AT = Math.floor((EVENT_WP_DROP_UNTIL + (DAY * WP_EXPIRE_GRACE_PERIOD_IN_DAYS)) / 1000);

// 이벤트 글자조각 드랍 확률
export const EVENT_WP_DROP_RATE = 0.06;

// 이벤트 글자조각 드랍 제한, 드랍 가능 여부는 최하단 함수에서 검증함
const EVENT_WP_DROP_THEME_LIMITED = false;
const EVENT_WP_DROP_KOREAN_ENABLED = true;
const EVENT_WP_DROP_ENGLISH_ENABLED = false;

const EVENT_WP_DROP_THEMES_KO = [];
const EVENT_WP_DROP_THEMES_EN = [];

export const EQUIP_GROUP = {
    "Mhead": ["Mhead"],
    "Meye": ["Meye"],
    "Mmouth": ["Mmouth"],
    "Mlhand": ["Mhand"],
    "Mrhand": ["Mhand"],
    "Mclothes": ["Mclothes"],
    "Mshoes": ["Mshoes"],
    "Mback": ["Mback"],
    "BDG": ["BDG1", "BDG2", "BDG3", "BDG4"],
    "NIK": ["NIK"]
};
export const EQUIP_SLOTS = Object.keys(EQUIP_GROUP);

export const OPTIONS = {
    'man': {name: "Manner"},
    'saf': {name: "Safe"},
    'ext': {name: "Injeong"},
    'mis': {name: "Mission"},
    'loa': {name: "Loanword"},
    'prv': {name: "Proverb"},
    'str': {name: "Strict"},
    'k32': {name: "Sami"},
    'no2': {name: "No2"},
    'beg': {name: "OnlyBeginner"},
    'nog': {name: "NoGuest"},
    'nol': {name: "NoLimit"},
    'rms': {name: "RandMission", req: "mis"},
    'tct': {name: "Tactical", req: "mis"},
    'rnk': {name: "RankMode"},
    'asy': {name: "AntiSynonym"},
    'pwr': {name: "Power"},
    'itm': {name: "Item"},
    'etq': {name: "Etiquette"},
    'gnt': {name: "Gentle"},
    'apm': {name: "Apmal"}
};
export const RULE = {
    /*
        유형: { lang: 언어,
            rule: 이름,
            opts: [ 추가 규칙 ],
            time: 시간 상수,
            ai: AI 가능?,
            big: 큰 화면?,
            ewq: 현재 턴 나가면 라운드 종료?
        }
    */
    'EKT': {// 영어 끄투
        lang: "en",
        rule: "Classic",
        opts: ["man", "saf", "ext", "mis", "beg", "nog", "rms", "tct", "rnk", "itm"],
        time: 1,
        ai: true,
        big: false,
        ewq: true
    },
    'ESH': {// 영어 끝말잇기
        lang: "en",
        rule: "Classic",
        opts: ["ext", "mis", "beg", "nog", "rms", "rnk", "itm"],
        time: 1,
        ai: true,
        big: false,
        ewq: true
    },
    'KKT': {// 한국어 쿵쿵따
        lang: "ko",
        rule: "Classic",
        opts: ["man", "saf", "gnt", "ext", "mis", "loa", "str", "k32", "beg", "nog", "rms", "tct", "rnk", "pwr", "itm"],
        time: 1,
        ai: true,
        big: false,
        ewq: true
    },
    'KSH': {// 한국어 끝말잇기
        lang: "ko",
        rule: "Classic",
        opts: ["man", "saf", "gnt", "ext", "mis", "loa", "str", "beg", "nog", "rms", "tct", "rnk", "itm"],
        time: 1,
        ai: true,
        big: false,
        ewq: true
    },
    'CSQ': {// 자음 퀴즈
        lang: "ko",
        rule: "Jaqwi",
        opts: ["ijp", "beg", "nog", "nol", "no2", "rnk", "asy"],
        time: 1,
        ai: true,
        big: false,
        ewq: false
    },
    'KCW': {// 한국어 십자말풀이
        lang: "ko",
        rule: "Crossword",
        opts: ["beg", "nog", "rnk", "asy"],
        time: 2,
        ai: false,
        big: true,
        ewq: false
    },
    'KTY': {// 한국어 타자 대결
        lang: "ko",
        rule: "Typing",
        opts: ["prv", "beg", "nog", "rnk"],
        time: 1,
        ai: false,
        big: false,
        ewq: false
    },
    'ETY': {// 영어 타자 대결
        lang: "en",
        rule: "Typing",
        opts: ["prv", "beg", "nog", "rnk"],
        time: 1,
        ai: false,
        big: false,
        ewq: false
    },
    'KAP': {// 한국어 앞말잇기
        lang: "ko",
        rule: "Classic",
        opts: ["man", "saf", "ext", "mis", "loa", "str", "beg", "nog", "rms", "tct", "rnk", "itm"],
        time: 1,
        ai: true,
        big: false,
        _back: true,
        ewq: true
    },
    'HUN': {// 훈민정음
        lang: "ko",
        rule: "Hunmin",
        opts: ["ext", "mis", "loa", "str", "beg", "nog", "rms", "rnk"],
        time: 1,
        ai: true,
        big: false,
        ewq: true
    },
    'KDA': {// 한국어 단어 대결
        lang: "ko",
        rule: "Daneo",
        opts: ["ijp", "mis", "beg", "nog", "rms", "tct", "rnk"],
        time: 1,
        ai: true,
        big: false,
        ewq: true
    },
    'EDA': {// 영어 단어 대결
        lang: "en",
        rule: "Daneo",
        opts: ["ijp", "mis", "beg", "nog", "rms", "rnk"],
        time: 1,
        ai: true,
        big: false,
        ewq: true
    },
    'KSS': {// 한국어 솎솎
        lang: "ko",
        rule: "Sock",
        opts: ["no2", "beg", "nog", "rnk"],
        time: 1,
        ai: false,
        big: true,
        ewq: false
    },
    'ESS': {// 영어 솎솎
        lang: "en",
        rule: "Sock",
        opts: ["no2", "beg", "nog", "rnk"],
        time: 1,
        ai: false,
        big: true,
        ewq: false
    },
    'EAP': {// 영어 앞말잇기
        lang: "en",
        rule: "Classic",
        opts: ["ext", "mis", "beg", "nog", "rms", "rnk", "itm"],
        time: 1,
        ai: true,
        big: false,
        _back: true,
        ewq: true
    },
    'KWS': {// 한국어 워드스택
        lang: "ko",
        rule: "Wordstack",
        opts: ["man", "etq", "ext", "mis", "apm", "beg", "nog", "rms", "rnk"],
        time: 1,
        ai: true,
        big: false,
        _back: true,
        ewq: true
    },
    'EWS': {// 영어 워드스택
        lang: "en",
        rule: "Wordstack",
        opts: ["ext", "mis", "apm", "beg", "nog", "rms", "rnk"],
        time: 1,
        ai: true,
        big: false,
        _back: true,
        ewq: true
    }
    // Add Drawquiz Below
};

export const GAME_TYPE = Object.keys(RULE);
export const EXAMPLE_TITLE = {
    'ko': "가나다라마바사아자차",
    'en': "abcdefghij"
};
export const INIT_SOUNDS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
export const MISSION = {
    'ko': '가나다라마바사아자차카타파하'.split(''),
    'en': 'abcdefghijklmnopqrstuvwxyz'.split(''),
    'ja': 'あかさたなはまら'.split('')
};

export const MISSION_TACT = {
    'ko': '기니디리미비시이지치키티피히구누두루무부수우주추쿠투푸후게네데레메베세에제체케테페헤고노도로모보소오조초코토포호'.split(''),
    'en': [], // placeholder
    'ja': 'いうえおきくけこしすせそちつてとにぬねのひふへほみむめもりるれろ'.split('')
};

export const KO_INJEONG = [
    "IMS", "VOC", "KRR", "KTV",
    "KOT", "DOT", "THP", "DRR", "DGM", "RAG", "LVL",
    "LOL", "TQS", "MMM", "MAP",
    "MOB", "CYP", "STA", "OIJ",
    "KGR", "ELW", "OVW", "NEX", /*"WOW",*/
    "KPO", "JLN", "JAN", "ZEL", "POK",
    "HSS", "MOV", "HDC", "HOS",
    "BDM", "KIO", "CON", "HRT", "BRD"
];
export const EN_INJEONG = [
    "LOL", "BRD"
];
export const KO_THEME = [
    "30", "40", "60", "80", "90",
    "140", "150", "160", "170", "190",
    "220", "230", "240", "270", "310",
    "320", "350", "360", "420", "430",
    "450", "490", "530", "1001"
];
export const EN_THEME = [
    "e05", "e08", "e12", "e13", "e15",
    "e18", "e20", "e43", "e53"
];
export const IJP_EXCEPT = [
    // "OIJ" // 신조어 선택 활성화를 위한 주석 처리
];
export const KO_IJP = KO_INJEONG.concat(KO_THEME).filter(function (item) {
    return !IJP_EXCEPT.includes(item);
});
export const EN_IJP = EN_INJEONG.concat(EN_THEME).filter(function (item) {
    return !IJP_EXCEPT.includes(item);
});
export const REGION = {
    'en': "en",
    'ko': "kr"
};
export const KOR_STRICT = /(^|,)(1|INJEONG)($|,)/;
export const KOR_GROUP = new RegExp("(,|^)(" + [
    "0", "1", "3", "7", "8", "11", "9",
    "16", "15", "17", "2", "18", "20", "26", "19",
    "INJEONG"
].join('|') + ")(,|$)");
export const ENG_ID = /^[a-z]+$/i;
export const JPN_ID = new RegExp(); // 일본어 제시어 필터, 추가 필요
export const KOR_FLAG = {
    LOANWORD: 1,  // 외래어
    INJEONG: 2,   // 어인정
    SPACED: 4,    // 띄어쓰기를 해야 하는 어휘
    SATURI: 8,    // 방언
    OLD: 16,      // 옛말
    MUNHWA: 32,   // 문화어
    KUNG: 64      // 쿵쿵따 전용 단어
};
export function WP_REWARD () {
    return 10 + Math.floor(Math.random() * 91);
}
export function getRule (mode) {
    return RULE[GAME_TYPE[mode]];
}

// 이벤트 글자 조각 드랍 제한 확인 함수
export function WPE_CHECK (lang, theme) {
    let THEMERULE = [];
    if (lang == "ko") {
        if (!EVENT_WP_DROP_KOREAN_ENABLED) return false;
        THEMERULE = EVENT_WP_DROP_THEMES_KO;
    } else if (lang == "en") {
        if (!EVENT_WP_DROP_ENGLISH_ENABLED) return false;
        THEMERULE = EVENT_WP_DROP_THEMES_EN;
    }
    
    if (EVENT_WP_DROP_THEME_LIMITED) {
        if (!theme || theme.length == 0) return false;
        let drop = false;
        theme = theme.split(',');
        for (let t of theme) {
            if (THEMERULE.indexOf(t) != -1) {
                drop = true;
                break;
            }
        }
        return drop;
    }
    return true;
}