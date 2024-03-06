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

const LANG = ["ko", "en"];

import * as pgPool from 'pg-pool';
import { PG_USER, PG_PASS, PG_PORT, PG_DB, IJP_EXCEPT } from "../config.js";
import * as IOLog from "./KKuTuIOLog.js";
import { Agent } from "./collection.js";
import { Tail } from "./lizard.js";
import * as ConnectionLog from "./ConnectionLog.js";
import * as UserBlockModule from "./UserBlockModule.js";
import * as VendorDBMigration from "./VendorDBMigration.js";
import * as SuspicionLog from "./utils/SuspicionLog.js";
import { createClient as CreateRedis } from "redis";
export { ConnectionLog, UserBlockModule, VendorDBMigration, SuspicionLog };

const KOR_GROUP = new RegExp("(,|^)(" + [
    "0", "1", "3", "7", "8", "11", "9",
    "16", "15", "17", "2", "18", "20", "26", "19",
    "INJEONG"
].join('|') + ")(,|$)");
const ENG_ID = /^[a-z]+$/i;
const JPN_ID = new RegExp(); // 일본어 제시어 필터, 추가 필요

const FAKE_REDIS_FUNC = () => {
    let R = new Tail();

    R.go({});
    return R;
};
const FAKE_REDIS = {
    putGlobal: FAKE_REDIS_FUNC,
    getGlobal: FAKE_REDIS_FUNC,
    getPage: FAKE_REDIS_FUNC,
    getSurround: FAKE_REDIS_FUNC
};

const Redis = CreateRedis();
let Pg = new pgPool.default({
    user: PG_USER,
    password: PG_PASS,
    port: PG_PORT,
    database: PG_DB,
});
Redis.on('connect', function () {
    connectPg();
});
Redis.on('error', function (err) {
    IOLog.error("Error from Redis: " + err);
    IOLog.notice("Run with no-redis mode.");
    Redis.quit();
    connectPg(true);
});

export let kkutu;
export let kkutu_cw;
export let kkutu_manner;
export let redis;
export let kkutu_injeong;
export let kkutu_shop;
export let kkutu_shop_desc;
export let session;
export let users;
export let family;
export let SUBMIT_WORD_CACHE;
export let MANNER_CACHE;
export let SPC_MANNER_CACHE;
export let THEME_CACHE;
export let shop;

let ready;

function connectPg(noRedis) {
    Pg.connect(async function (err, pgMain) {
        if (err) {
            IOLog.error("Error when connect to PostgreSQL server: " + err.toString());
            return;
        }
        let redisAgent = noRedis ? null : new Agent("Redis", Redis);
        let mainAgent = new Agent("Postgres", pgMain);

        let i;

        kkutu = {};
        kkutu_cw = {};
        // kkutu_manner = {};

        redis = noRedis ? FAKE_REDIS : new redisAgent.Table("KKuTu_Score");
        for (i in LANG) {
            kkutu[LANG[i]] = new mainAgent.Table("kkutu_" + LANG[i]);
            kkutu_cw[LANG[i]] = new mainAgent.Table("kkutu_cw_" + LANG[i]);
            // kkutu_manner[LANG[i]] = new mainAgent.Table("kkutu_manner_" + LANG[i]);
        }
        kkutu_injeong = new mainAgent.Table("kkutu_injeong");
        kkutu_shop = new mainAgent.Table("kkutu_shop");
        kkutu_shop_desc = new mainAgent.Table("kkutu_shop_desc");

        session = new mainAgent.Table("session");
        users = new mainAgent.Table("users");
        family = new mainAgent.Table("family");

        SUBMIT_WORD_CACHE = {'ko': {}, 'en': {}}; // 단어 캐시
        MANNER_CACHE = {'ko': {}, 'en': {}}; // 일반 매너 캐시
        SPC_MANNER_CACHE = {'ko': {}, 'en': {}}; // 쿵쿵따, 끄투 매너 캐시
        THEME_CACHE = {'ko': {}, 'en': {}}
        shop = {};

        await refreshWordcache();
        await refreshShopcache();

        ConnectionLog.initDatabase(pgMain);
        UserBlockModule.initDatabase(pgMain);
        VendorDBMigration.initDatabase(pgMain);
        SuspicionLog.initDatabase(pgMain);

        if (ready) ready(Redis, Pg);
        else IOLog.warn("DB.onReady was not defined yet.");
    });
}

export function onReady (callback) {
    ready = callback;
}

const RIEUL_TO_NIEUN = [4449, 4450, 4457, 4460, 4462, 4467];
const RIEUL_TO_IEUNG = [4451, 4455, 4456, 4461, 4466, 4469];
const NIEUN_TO_IEUNG = [4455, 4461, 4466, 4469];

function getSubKorean (char) {
    let c = char.charCodeAt();
    let ca, cb, cc;

    let k = c - 0xAC00;
    if (k < 0 || k > 11171) return;
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
        return String.fromCharCode(((cb[0] * 21) + cb[1]) * 28 + cb[2] + 0xAC00);
    }
}

function getMannerTemplate (len) {
    let R = new Array();
    for (let i = 0;i < len;i++) R.push(new Array())
    return R;
}

export async function refreshWordcache () {
    IOLog.info(`단어 데이터를 메모리에 저장합니다...`)

    kkutu['ko'].find(['type', KOR_GROUP]).on($res => {
        let newCache = {};
        let newManner = {};
        let newSpcManner = {};
        let newTheme = {};
        for (let resIndex in $res) {
            const data = $res[resIndex];
            const _id = data['_id'];
            const flag = data['flag'];
            const theme = data['theme'].split(',');
            const hbw = theme.includes('HBW');
            
            newCache[_id] = data;

            // 주제별 캐싱, 선택 불가능 주제는 기록하지 않음
            for (let t of theme) {
                if (IJP_EXCEPT.includes(t)) continue;
                if (!newTheme.hasOwnProperty(t)) newTheme[t] = [];
                newTheme[t].push(data);
            }

            if (!data['type'].match(KOR_GROUP)) continue; // 클래식에서 사용 불가능한 단어

            if (_id.length < 2) continue;
            const start = _id.charAt(_id.length-1); // 시작하는 글자
            const last = _id.charAt(); // 끝나는 글자

            if (start == last || start == getSubKorean(last)) continue; // 글자돌림, 매너 테이블에서 계산 안함

            /*  인덱스 순서대로, * = 매너 계산 적용받지 않음
             *  0 = 일반 단어
             *  1 = 깐깐에서 사용 불가능한 단어
             *  2 = 우리말에서 사용 불가능한 단어
             *  3 = HBW 주제의 단어
             *  4 = *HBW 주제 외의 어인정 단어
             */
            let fi = 0;
            if (!hbw && (flag & 2)) fi = 4;
            else if (hbw) fi = 3;
            else if (flag & 1) fi = 2;
            else if (flag > 3) fi = 1;

            if (!(flag & 64)) { // 쿵쿵따 전용 단어 스킵

                if (!newManner.hasOwnProperty(start)) newManner[start] = [getMannerTemplate(5), getMannerTemplate(5)];
                if (!newManner.hasOwnProperty(last)) newManner[last] = [getMannerTemplate(5), getMannerTemplate(5)];

                newManner[start][1][fi].push(data);
                newManner[last][0][fi].push(data);
            }

            if (_id.length > 3) continue; // 2, 3글자일때는 쿵쿵따 테이블 기록

            let i = 0;
            if (_id.length == 2) i = 1; // 3232용 2글자 기록

            if (!newSpcManner.hasOwnProperty(last)) newSpcManner[last] = [getMannerTemplate(5), getMannerTemplate(5)];
            newSpcManner[last][i][fi].push(data);

        }

        SUBMIT_WORD_CACHE['ko'] = newCache;
        MANNER_CACHE['ko'] = newManner;
        SPC_MANNER_CACHE['ko'] = newSpcManner;
        THEME_CACHE['ko'] = newTheme;

        IOLog.info(`${Object.keys(SUBMIT_WORD_CACHE['ko']).length} 개의 한국어 단어 데이터를 메모리에 불러왔습니다.`)
        IOLog.debug(`${Object.keys(MANNER_CACHE['ko']).length} 개의 한국어 일반 매너 데이터를 메모리에 불러왔습니다.`)
        IOLog.debug(`${Object.keys(SPC_MANNER_CACHE['ko']).length} 개의 한국어 특수 매너 데이터를 메모리에 불러왔습니다.`)
        IOLog.debug(`${Object.keys(THEME_CACHE['ko']).length} 개의 한국어 주제 데이터를 메모리에 불러왔습니다.`)
    });

    kkutu['en'].find(['_id', ENG_ID]).on($res => {
        let newCache = {};
        let newManner = {};
        let newSpcManner = {};
        let newTheme = {};
        for (let resIndex in $res) {
            const data = $res[resIndex];
            const _id = data['_id'];
            const flag = data['flag'];
            const theme = data['theme'].split(',');
            
            newCache[_id] = data;

            // 주제별 캐싱, 선택 불가능 주제는 기록하지 않음
            for (let t of theme) {
                if (IJP_EXCEPT.includes(t)) continue;
                if (!newTheme.hasOwnProperty(t)) newTheme[t] = [];
                newTheme[t].push(data);
            }

            if (!_id.match(ENG_ID)) continue; // 클래식에서 사용 불가능한 단어

            if (_id.length < 2) continue; // 끝말/앞말
            const start = _id.charAt(_id.length-1); // 시작하는 글자
            const last = _id.charAt(); // 끝나는 글자

            /*  인덱스 순서대로, * = 매너 계산 적용받지 않음
             *  0 = 일반 단어
             *  1 = *어인정 단어
             */
            let fi = 0;
            if (flag & 2) fi = 1;

            if (!newManner.hasOwnProperty(start)) newManner[start] = [getMannerTemplate(2), getMannerTemplate(2)];
            if (!newManner.hasOwnProperty(last)) newManner[last] = [getMannerTemplate(2), getMannerTemplate(2)];

            if (start != last) { // 글자돌림 제외
                newManner[start][1][fi].push(data);
                newManner[last][0][fi].push(data);
            }

            if (_id.length < 4) continue; // 4글자 이상이면 끄투 규칙용 데이터도 저장
            const kkchar = _id.slice(0,3);
            const kksub = _id.slice(0,2);

            if (!newSpcManner.hasOwnProperty(kkchar)) newSpcManner[kkchar] = getMannerTemplate(2);
            if (!newSpcManner.hasOwnProperty(kksub)) newSpcManner[kksub] = getMannerTemplate(2);

            newSpcManner[kkchar][fi].push(data);
            newSpcManner[kksub][fi].push(data);
        }

        SUBMIT_WORD_CACHE['en'] = newCache;
        MANNER_CACHE['en'] = newManner;
        SPC_MANNER_CACHE['en'] = newSpcManner;
        THEME_CACHE['en'] = newTheme;

        IOLog.info(`${Object.keys(SUBMIT_WORD_CACHE['en']).length} 개의 영어 단어 데이터를 메모리에 불러왔습니다.`)
        IOLog.debug(`${Object.keys(MANNER_CACHE['en']).length} 개의 영어 일반 매너 데이터를 메모리에 불러왔습니다.`)
        IOLog.debug(`${Object.keys(SPC_MANNER_CACHE['en']).length} 개의 영어 특수 매너 데이터를 메모리에 불러왔습니다.`)
        IOLog.debug(`${Object.keys(THEME_CACHE['en']).length} 개의 영어 주제 데이터를 메모리에 불러왔습니다.`)
    });
};

export async function refreshShopcache () {    
    IOLog.info('아이템 데이터 갱신을 시작합니다...')

    kkutu_shop.find().on(function ($res) {
        let newCache = {};

        $res.forEach(function (item) {
            newCache[item._id] = item;
        });

        shop = newCache;

        IOLog.info(`${Object.keys(shop).length} 개의 아이템 데이터를 메모리에 불러왔습니다.`)
    });
};