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
import GLOBAL from "./global.json" assert { type: "json" };
import { KOR_GROUP, ENG_ID, IJP_EXCEPT } from "../const.js";
import * as IOLog from "./KKuTuIOLog.js";
import { Agent } from "./collection.js";
import { Tail } from "./lizard.js";
import * as ConnectionLog from "./ConnectionLog.js";
import * as UserBlockModule from "./UserBlockModule.js";
import * as VendorDBMigration from "./VendorDBMigration.js";
import * as SuspicionLog from "./utils/SuspicionLog.js";
import { createClient as CreateRedis } from "redis";
export { ConnectionLog, UserBlockModule, VendorDBMigration, SuspicionLog };

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
    user: GLOBAL.PG_USER,
    password: GLOBAL.PG_PASS,
    port: GLOBAL.PG_PORT,
    database: GLOBAL.PG_DB,
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

        SUBMIT_WORD_CACHE = {'ko': {}, 'en': {}}; // ?????? ??????
        MANNER_CACHE = {'ko': {}, 'en': {}}; // ?????? ?????? ??????
        SPC_MANNER_CACHE = {'ko': {}, 'en': {}}; // ?????????, ?????? ?????? ??????
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
    if (cb[0] == 4357) { // ????????? ???, ???
        cc = true;
        if (RIEUL_TO_NIEUN.includes(cb[1])) cb[0] = 4354;
        else if (RIEUL_TO_IEUNG.includes(cb[1])) cb[0] = 4363;
        else cc = false;
    } else if (cb[0] == 4354) { // ????????? ???
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
    IOLog.info(`?????? ???????????? ???????????? ???????????????...`)

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

            // ????????? ??????, ?????? ????????? ????????? ???????????? ??????
            for (let t of theme) {
                if (IJP_EXCEPT.includes(t)) continue;
                if (!newTheme.hasOwnProperty(t)) newTheme[t] = [];
                newTheme[t].push(data);
            }

            if (!data['type'].match(KOR_GROUP)) continue; // ??????????????? ?????? ???????????? ??????

            if (_id.length < 2) continue;
            const start = _id.charAt(_id.length-1); // ???????????? ??????
            const last = _id.charAt(); // ????????? ??????

            if (start == last || start == getSubKorean(last)) continue; // ????????????, ?????? ??????????????? ?????? ??????

            /*  ????????? ????????????, * = ?????? ?????? ???????????? ??????
             *  0 = ?????? ??????
             *  1 = ???????????? ?????? ???????????? ??????
             *  2 = ??????????????? ?????? ???????????? ??????
             *  3 = HBW ????????? ??????
             *  4 = *HBW ?????? ?????? ????????? ??????
             */
            let fi = 0;
            if (!hbw && (flag & 2)) fi = 4;
            else if (hbw) fi = 3;
            else if (flag & 1) fi = 2;
            else if (flag > 3) fi = 1;

            if (!(flag & 64)) { // ????????? ?????? ?????? ??????

                if (!newManner.hasOwnProperty(start)) newManner[start] = [getMannerTemplate(5), getMannerTemplate(5)];
                if (!newManner.hasOwnProperty(last)) newManner[last] = [getMannerTemplate(5), getMannerTemplate(5)];

                newManner[start][1][fi].push(data);
                newManner[last][0][fi].push(data);
            }

            if (_id.length > 3) continue; // 2, 3??????????????? ????????? ????????? ??????

            let i = 0;
            if (_id.length == 2) i = 1; // 3232??? 2?????? ??????

            if (!newSpcManner.hasOwnProperty(last)) newSpcManner[last] = [getMannerTemplate(5), getMannerTemplate(5)];
            newSpcManner[last][i][fi].push(data);

        }

        SUBMIT_WORD_CACHE['ko'] = newCache;
        MANNER_CACHE['ko'] = newManner;
        SPC_MANNER_CACHE['ko'] = newSpcManner;
        THEME_CACHE['ko'] = newTheme;

        IOLog.info(`${Object.keys(SUBMIT_WORD_CACHE['ko']).length} ?????? ????????? ?????? ???????????? ???????????? ??????????????????.`)
        IOLog.debug(`${Object.keys(MANNER_CACHE['ko']).length} ?????? ????????? ?????? ?????? ???????????? ???????????? ??????????????????.`)
        IOLog.debug(`${Object.keys(SPC_MANNER_CACHE['ko']).length} ?????? ????????? ?????? ?????? ???????????? ???????????? ??????????????????.`)
        IOLog.debug(`${Object.keys(THEME_CACHE['ko']).length} ?????? ????????? ?????? ???????????? ???????????? ??????????????????.`)
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

            // ????????? ??????, ?????? ????????? ????????? ???????????? ??????
            for (let t of theme) {
                if (IJP_EXCEPT.includes(t)) continue;
                if (!newTheme.hasOwnProperty(t)) newTheme[t] = [];
                newTheme[t].push(data);
            }

            if (!_id.match(ENG_ID)) continue; // ??????????????? ?????? ???????????? ??????

            if (_id.length < 2) continue; // ??????/??????
            const start = _id.charAt(_id.length-1); // ???????????? ??????
            const last = _id.charAt(); // ????????? ??????

            /*  ????????? ????????????, * = ?????? ?????? ???????????? ??????
             *  0 = ?????? ??????
             *  1 = *????????? ??????
             */
            let fi = 0;
            if (flag & 2) fi = 1;

            if (!newManner.hasOwnProperty(start)) newManner[start] = [getMannerTemplate(2), getMannerTemplate(2)];
            if (!newManner.hasOwnProperty(last)) newManner[last] = [getMannerTemplate(2), getMannerTemplate(2)];

            if (start != last) { // ???????????? ??????
                newManner[start][1][fi].push(data);
                newManner[last][0][fi].push(data);
            }

            if (_id.length < 4) continue; // 4?????? ???????????? ?????? ????????? ???????????? ??????
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

        IOLog.info(`${Object.keys(SUBMIT_WORD_CACHE['en']).length} ?????? ?????? ?????? ???????????? ???????????? ??????????????????.`)
        IOLog.debug(`${Object.keys(MANNER_CACHE['en']).length} ?????? ?????? ?????? ?????? ???????????? ???????????? ??????????????????.`)
        IOLog.debug(`${Object.keys(SPC_MANNER_CACHE['en']).length} ?????? ?????? ?????? ?????? ???????????? ???????????? ??????????????????.`)
        IOLog.debug(`${Object.keys(THEME_CACHE['en']).length} ?????? ?????? ?????? ???????????? ???????????? ??????????????????.`)
    });
};

export async function refreshShopcache () {    
    IOLog.info('????????? ????????? ????????? ???????????????...')

    kkutu_shop.find().on(function ($res) {
        let newCache = {};

        $res.forEach(function (item) {
            newCache[item._id] = item;
        });

        shop = newCache;

        IOLog.info(`${Object.keys(shop).length} ?????? ????????? ???????????? ???????????? ??????????????????.`)
    });
};