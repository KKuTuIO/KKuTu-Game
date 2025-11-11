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
import Cluster from "cluster";
const WSServer = (await import('ws')).default.Server;
import { createServer } from 'https';
let HTTPS_Server;
// import { writeSnapshot }from "heapdump";
import * as KKuTu from './kkutu.js';
import { decrypt } from "../sub/crypto.js";
import { UID_ALPHABET, UID_LETTER, UID_IMPORT_LETTER, reloads, DISCORD_WEBHOOK, GAME_TYPE, IS_WS_SECURED, WEB_KEY, CRYPTO_KEY,
    ADMIN, CAPTCHA_TO_GUEST, CAPTCHA_SITE_KEY,
    TEST_PORT, KKUTU_MAX, TESTER, CAPTCHA_TO_USER, EVENTS, EXCHANGEABLES } from "../config.js";
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet(UID_ALPHABET, UID_LETTER);
const importId = customAlphabet(UID_ALPHABET, UID_IMPORT_LETTER);

import { CronJob } from 'cron';
import * as IOLog from '../sub/KKuTuIOLog.js';
import Secure from '../sub/secure.js';
import { verifyCaptcha } from '../sub/captcha.js';
import { requestLastRelay, waitACinit, processSuspicion, rebuildWebHook } from '../sub/utils/AntiCheat.js';
import { getRatingLevel, initUserRating } from '../sub/utils/UserRating.js';
import { processReport } from "../sub/utils/ProcessReport.js";
import { guardMessage, attachGuard, detachGuard, SecurityOptions } from '../sub/utils/Guard.js';
import { processUserNickChange } from "../sub/UserNickChange.js";
import { normalizeUserIp, checkBlockedAs, isBlockedIp } from "../sub/utils/AutoMod.js";
import geoIp from 'geoipasn';
import { Webhook, MessageBuilder } from 'discord-webhook-node';
import getLevel from "../sub/KKuTuLevel.js";
const auditDiscordWebHook = new Webhook(DISCORD_WEBHOOK.AUDIT);

let MainDB;

let savedProgress = {
    "reqCountByIp": {},
    "savedUserInfo": {}
};

let Server;
let DIC = {};
let DNAME = {};
let ROOM = {};

let T_ROOM = {};
let T_USER = {};

let SID;
let CHAN;
let WDIC = {};

let allowLobbyChat = true;
let allowGuestEnter = true;
let allowEnter = true;
let allowRoomCreate = true;
let alwaysTriggerCaptcha = CAPTCHA_TO_USER;

let allowedRoomTitles = ["아무나 들어오세요!", "1 VS 1", "다들 레디!", "친구들 모여라~", "자유롭게 대화해요!", "가르쳐 줄 고수 구합니다", "어서와~ 끄투리오는 처음이지?"];
export let XPMultiplier = 1;
export let MoneyMultiplier = 1;

export const DEVELOP = global.test || false;
export const GUEST_PERMISSION = {
    'create': true,
    'enter': true,
    'talk': true,
    'practice': true,
    'ready': true,
    'start': true,
    'invite': true,
    'inviteRes': true,
    'kick': true,
    'kickVote': true,
    'wp': true
};
// export const ENABLE_ROUND_TIME = [10, 30, 60, 90, 120, 150];
export const ENABLE_FORM = ["S", "J"];
export const MODE_LENGTH = GAME_TYPE.length;
const PORT = process.env['KKUTU_PORT'];

process.on('uncaughtException', function (err) {
    const text = `:${PORT} [${new Date().toLocaleString()}] ERROR: ${err.toString()}\n${err.stack}\n`;
    IOLog.emerg(`ERROR OCCURRED ON THE MASTER! ${text}`);
});

function processAdmin(id, value) {
    let cmd, temp, i, j, msg;

    value = value.replace(/^(#\w+\s+)?(.+)/, function (v, p1, p2) {
        if (p1) cmd = p1.slice(1).trim();
        else if (p2.charAt() == "#") cmd = p2.slice(1);
        return p2;
    });

    auditAdminCommandExecution(id, cmd, value);

    switch (cmd) {
        case "delroom":
            if (temp = ROOM[value]) {
                for (let i in ROOM[value].players) {
                    let $c = DIC[ROOM[value].players[i]];
                    if ($c) {
                        $c.sendError(473);
                        $c.place = 0;
                        $c.send('roomStuck');
                    }
                }
                delete ROOM[value];
            }
            return null;
        case "roomtitle":
            msg = value.trim().split(" ");
            if (temp = ROOM[msg[0]]) {
                temp.title = msg[1] ? value.slice(msg[0].length + 1) : "바른방제목#" + msg[0];
                temp.worker.send({type: 'room-title', id: msg[0], value: temp.title});
                KKuTu.publish('room', {target: id, room: temp.getData(), modify: true}, temp.password);
            }
            return null;
        case "nick":
            msg = value.trim().split(" ");
            let newName = msg[1] ? value.slice(msg[0].length + 1) : '바른별명#' + msg[0].replace(/[^0-9]/g, "").substring(0, 5);
            MainDB.users.update(['_id', msg[0]]).set(['nickname', newName]).on();
            if (temp = DIC[msg[0]]) {
                temp.socket.send('{"type":"error","code":410}');
                temp.socket.close();
            }
            return null;
        case "yell":
            KKuTu.publish('yell', {value: value});
            return null;
        case "notice":
            KKuTu.publish('notice', { value: value });
            return null;
        case "alert":
            j = value.includes("enable-overlay");
            msg = value.replace("enable-overlay", "").trim();
            KKuTu.publish('alert', { value: msg, isOverlayEnabled: j });
            return null;
        case "kill":
            j = value.includes("!");
            msg = value.replace("!", "").trim();

            if (temp = DIC[msg]) {
                temp.socket.send('{"type":"error","code":410}');
                if (j) {
                    try {
                        temp.socket.terminate();
                    } catch {
                        temp.socket.close(1008);
                    }
                } else {
                    temp.socket.close();
                }
            }
            return null;
        case "ip":
            if (temp = DIC[value]) {
                if (DIC[id]) DIC[id].send('tail', {
                    a: "ip",
                    rid: temp.id,
                    id: id,
                    msg: temp.socket._socket.remoteAddress.slice(7)
                });
            }
            return null;
        case "tailroom":
            if (temp = ROOM[value]) {
                if (T_ROOM[value] == id) {
                    i = true;
                    delete T_ROOM[value];
                } else T_ROOM[value] = id;
                if (DIC[id]) DIC[id].send('tail', {
                    a: i ? "trX" : "tr",
                    rid: temp.id,
                    id: id,
                    msg: {pw: temp.password, ltc: temp.lastTitle, players: temp.players}
                });
            }
            return null;
        case "tailuser":
            if (temp = DIC[value]) {
                if (T_USER[value] == id) {
                    i = true;
                    delete T_USER[value];
                } else T_USER[value] = id;
                temp.send('test');
                if (DIC[id]) DIC[id].send('tail', {a: i ? "tuX" : "tu", rid: temp.id, id: id, msg: temp.getData()});
            }
            return null;
        case "roominfo":
            if (temp = ROOM[value]) {
                if (DIC[id]) DIC[id].send('tail', {
                    a: "ri",
                    rid: temp.id,
                    id: id,
                    msg: {pw: temp.password, ltc: temp.lastTitle, players: temp.players}
                });
            }
            return null;
        case "dump":
            if (DIC[id]) DIC[id].send('yell', {value: "This feature is not supported..."});
            /*writeSnapshot("/home/kkutu_memdump_" + Date.now() + ".heapsnapshot", function(err){
                if(err){
                    IOLog.error("Error when dumping!");
                    return IOLog.error(err.toString());
                }
                if(DIC[id]) DIC[id].send('yell', { value: "DUMP OK" });
                IOLog.notice("Dumping success.");
            });*/

            return null;
        case "lobbychat":
            if (allowLobbyChat) {
                allowLobbyChat = false;

                DIC[id].send('chat', {notice: true, message: '로비 채팅을 일시적으로 비활성화했습니다.'});
                IOLog.notice(`${id} 님이 로비 채팅을 일시적으로 비활성화했습니다.`);
            } else {
                allowLobbyChat = true;

                DIC[id].send('chat', {notice: true, message: '로비 채팅을 활성화했습니다.'});
                IOLog.notice(`${id} 님이 로비 채팅을 활성화했습니다.`);
            }
            return null;
        case "setxp":
            if(!value) return;
            temp = parseFloat(value);
            if(!XPMultiplier) return;
            XPMultiplier = temp;
            DIC[id].send('notice', {value: `경험치 배율은 이제 ${XPMultiplier}배입니다.`});
            return null;
        case "setmoney":
            if(!value) return;
            temp = parseFloat(value);
            if(!MoneyMultiplier) return;
            MoneyMultiplier = temp;
            DIC[id].send('notice', {value: `핑 배율은 이제 ${MoneyMultiplier}배입니다.`});
            return null;
        case "flushguest":
            try {
                Object.keys(DIC).forEach(o => {
                    let user = DIC[o];
                    if((user && user.guest && user.place == 0) || (user && user.guest && (value == 'all'))) {
                        user.sendError(458);
                        user.socket.close();
                    }
                });
            } catch (e) {
                IOLog.error(e);
            }
            return null;
        case "flushuser":
            try {
                Object.keys(DIC).forEach(o => {
                    let user = DIC[o];
                    if((user && user.place == 0) || (user && (value == 'all'))) {
                        user.sendError(461);
                        user.socket.close();
                    }
                });
            } catch (e) {
                IOLog.error(e);
            }
            return null;
        case "allowroomcreate":
            if(allowRoomCreate) {
                allowRoomCreate = false;
                DIC[id].send('chat', {notice: true, message: '방 생성이 일시적으로 비활성화되었습니다.'});
                IOLog.notice(`${id} 님이 방 생성을 일시적으로 비활성화했습니다.`);
            } else {
                allowRoomCreate = true;
                DIC[id].send('chat', {notice: true, message: '방 생성이 활성화되었습니다.'});
                IOLog.notice(`${id} 님이 방 생성을 활성화했습니다.`);
            }
            return null;
        case "allowguest":
            if(allowGuestEnter) {
                allowGuestEnter = false;

                DIC[id].send('chat', {notice: true, message: '손님 계정의 출입을 일시적으로 비활성화했습니다.'});
                IOLog.notice(`${id} 님이 손님 계정의 출입을 일시적으로 비활성화했습니다.`);

                try {
                    Object.keys(DIC).forEach(o => {
                        let user = DIC[o];
                        if((user && user.guest && user.place == 0) || (user && user.guest && (value == 'force'))) {
                            user.sendError(458);
                            user.socket.close();
                        }
                    });
                } catch (e) {
                    IOLog.error(e);
                }
            } else {
                allowGuestEnter = true;

                DIC[id].send('chat', {notice: true, message: '손님 계정의 출입을 활성화했습니다.'});
                IOLog.notice(`${id} 님이 손님 계정의 출입을 활성화했습니다.`);
            }
            return null;
        case "allowenter":
            if(allowEnter) {
                allowEnter = false;

                DIC[id].send('chat', {notice: true, message: '채널의 출입을 일시적으로 비활성화했습니다.'});
                IOLog.notice(`${id} 님이 채널의 출입을 일시적으로 비활성화했습니다.`);
            } else {
                allowEnter = true;

                DIC[id].send('chat', {notice: true, message: '채널의 계정의 출입을 활성화했습니다.'});
                IOLog.notice(`${id} 님이 채널의 출입을 활성화했습니다.`);
            }
            return null;
        case 'captcha':
            if(alwaysTriggerCaptcha) {
                alwaysTriggerCaptcha = false;

                DIC[id].send('chat', {notice: true, message: 'CAPTCHA 인증 대상을 "손님 계정"(으)로 설정하였습니다.'});
                IOLog.notice(`${id} 님이 CAPTCHA 인증 대상을 "손님 계정"(으)로 설정하였습니다.`);
            } else {
                alwaysTriggerCaptcha = true;

                DIC[id].send('chat', {notice: true, message: 'CAPTCHA 인증 대상을 "모든 계정"(으)로 설정하였습니다.'});
                IOLog.notice(`${id} 님이 CAPTCHA 인증 대상을 "모든 계정"(으)로 설정하였습니다.`);
            }
            return null;
        case "refreshword":
            DIC[id].send('notice', {value: "단어 캐시를 다시 불러옵니다. 자세한 내용은 로그를 참조하세요."});
            IOLog.notice(`${id} 님이 단어 캐시를 갱신했습니다.`);
            publishMessage({type:"refresh-word"});
            MainDB.refreshWordcache();
            return null;
        case "refreshshop":
            DIC[id].send('notice', {value: "아이템 정보를 다시 불러옵니다. 자세한 내용은 로그를 참조하세요."});
            IOLog.notice(`${id} 님이 아이템 정보를 갱신했습니다.`);
            publishMessage({type:"refresh-shop"});
            MainDB.refreshShopcache();
            return null;
        case "refreshsurvey":
            DIC[id].send('notice', {value: "설문조사 정보를 다시 불러옵니다. 자세한 내용은 로그를 참조하세요."});
            IOLog.notice(`${id} 님이 설문조사 정보를 갱신했습니다.`);
            publishMessage({type:"refresh-survey"});
            MainDB.refreshSurveycache();
            return null;
        case "reload":
            temp = value.trim().split(" ");
            if (value.trim() == "#reload" || temp.length === 0) {
                DIC[id].send('notice', {value: `리로드 가능한 설정 파일 목록: ${Object.keys(reloads).join(", ")}`});
                // DIC[id].send('notice', {value: "all을 입력하면 모든 값을 다시 불러옵니다."});
                return null;
            }
            if (temp.indexOf("all") != -1) {
                DIC[id].send('notice', {value: "모든 설정 파일을 다시 불러옵니다."});
                IOLog.notice(`${id} 님이 모든 설정 파일을 다시 불러왔습니다.`);
                publishMessage({type:"reload",target:["all"]});
                for (let reload of reloads) reload();
                rebuildWebHook();
                return null;
            }
            DIC[id].send('notice', {value: "설정 파일을 다시 불러옵니다."});
            IOLog.notice(`${id} 님이 일부 설정 파일을 다시 불러왔습니다.`);
            IOLog.notice(`다시 불러온 설정 : ${temp.join(', ')}`);
            publishMessage({type:"reload",target:temp});
            for (let k of temp) {
                if (reloads[k]) reloads[k]();
            }
            if (temp.indexOf("api") != -1) {
                rebuildWebHook();
            }
            return null;
        case "give":
            temp = value.trim().split(" ");
            if (value.trim() == "#give" || temp.length < 2) {
                DIC[id].send('notice', {value: "give <대상|all> <아이템> [갯수] [기간] [중복 획득 여부]"});
                return null;
            }
            let opts = {
                q: parseInt(temp[2]) || 1,
                x: parseInt(temp[3]) || undefined,
                mx: !!parseInt(temp[4]) || temp[4] == "true" || false
            }
            if (temp[0] == "all") {
                IOLog.notice(`${id} 님이 모든 사용자에게 ${temp[1]} 아이템을 ${opts.q}개 지급했습니다.`);
                if (opts.x) IOLog.debug(`만료시점 : ${opts.x}, 중복획득 : ${opts.mx}`);
                for (let k in DIC) {
                    DIC[k].obtain(temp[1], opts);
                    DIC[k].flush(true);
                    if (DIC[k].place) KKuTu.publish('refresh', { id: k });
                }
            } else if (DIC.hasOwnProperty(temp[0])) {
                IOLog.notice(`${id} 님이 ${DIC[temp[0]]} 사용자에게 ${temp[1]} 아이템을 ${opts.q}개 지급했습니다.`);
                if (opts.x) IOLog.debug(`만료시점 : ${opts.x}, 중복획득 : ${opts.mx}`);
                DIC[temp[0]].obtain(temp[1], opts);
                DIC[temp[0]].flush(true);
                if (DIC[temp[0]].place) KKuTu.publish('refresh', { id: temp[0] });
            }
            return null;
    }
    return value;
}

function publishMessage(msg) {
    for (let i in CHAN) CHAN[i].send(msg);
}

function checkTailUser(id, place, msg) {
    let temp;

    if (temp = T_USER[id]) {
        if (!DIC[temp]) {
            delete T_USER[id];
            return;
        }
        DIC[temp].send('tail', {a: "user", rid: place, id: id, msg: msg});
    }
}

function narrateFriends(id, friends, stat) {
    if (!friends) return;
    let fl = Object.keys(friends);

    if (!fl.length) return;

    MainDB.users.find(['_id', {$in: fl}], ['server', /^\w+$/]).limit(['server', true]).on(function ($fon) {
        let i, sf = {}, s;

        for (i in $fon) {
            if (!sf[s = $fon[i].server]) sf[s] = [];
            sf[s].push($fon[i]._id);
        }
        if (DIC[id]) DIC[id].send('friends', {list: sf});

        if (sf[SID]) {
            KKuTu.narrate(sf[SID], 'friend', {id: id, s: SID, stat: stat});
            delete sf[SID];
        }
        for (i in WDIC) {
            WDIC[i].send('narrate-friend', {id: id, s: SID, stat: stat, list: sf});
            break;
        }
    });
}

function auditAdminCommandExecution(id, cmd, value) {
    const embed = new MessageBuilder()
        .setTitle('관리자 명령어 사용 기록')
        .setDescription(`관리자 ${id}님이 게임 내에서 관리자 명령어를 사용하였습니다.`)
        .setColor(14423100)
        .addField('관리자 ID', id, false)
        .addField('사용 명령어', `\`#${cmd} ${value}\``, false)
        .setTimestamp();

    auditDiscordWebHook.send(embed).then(() => {
        IOLog.notice(`관리자 ${id} 님이 관리자 명령어 #${cmd} ${value}을(를) 사용했습니다.`);
    }).catch(err => {
        IOLog.error(`명령어 사용 내역을 디스코드 웹후크로 전송하는 중 오류가 발생했습니다. ${err.message}`);
    });
}

Cluster.on('message', function (worker, msg) {
    let temp;

    switch (msg.type) {
        case "admin":
            if (DIC[msg.id] && DIC[msg.id].admin) processAdmin(msg.id, msg.value);
            break;
        case "tail-report":
            if (temp = T_ROOM[msg.place]) {
                if (!DIC[temp]) delete T_ROOM[msg.place];
                DIC[temp].send('tail', {a: "room", rid: msg.place, id: msg.id, msg: msg.msg});
            }
            checkTailUser(msg.id, msg.place, msg.msg);
            break;
        case "okg":
            if (DIC[msg.id]) DIC[msg.id].onOKG(msg.time);
            break;
        case "kick":
            if (DIC[msg.target]) DIC[msg.target].socket.close();
            break;
        case "invite":
            if (!DIC[msg.target]) {
                worker.send({type: "invite-error", target: msg.id, code: 417});
                break;
            }
            if (DIC[msg.target].place != 0) {
                worker.send({type: "invite-error", target: msg.id, code: 417});
                break;
            }
            if (!GUEST_PERMISSION.invite) if (DIC[msg.target].guest) {
                worker.send({type: "invite-error", target: msg.id, code: 422});
                break;
            }
            if (DIC[msg.target]._invited) {
                worker.send({type: "invite-error", target: msg.id, code: 419});
                break;
            }
            DIC[msg.target]._invited = msg.place;
            DIC[msg.target].send('invited', {
                from: msg.place,
                by: msg.id
            });
            break;
        case "room-new":
            if (ROOM[msg.room.id] || !DIC[msg.target]) { // 이미 그런 ID의 방이 있다... 그 방은 없던 걸로 해라.
                worker.send({type: "room-invalid", room: msg.room});
            } else {
                ROOM[msg.room.id] = new KKuTu.Room(msg.room, msg.room.channel);
                ROOM[msg.room.id].worker = worker;
            }
            break;
        case "room-come":
            if (ROOM[msg.id] && DIC[msg.target]) {
                ROOM[msg.id].come(DIC[msg.target]);
            } else {
                IOLog.warn(`Wrong room-come id=${msg.id}&target=${msg.target}`);
            }
            break;
        case "room-spectate":
            if (ROOM[msg.id] && DIC[msg.target]) {
                ROOM[msg.id].spectate(DIC[msg.target], msg.pw);
            } else {
                IOLog.warn(`Wrong room-spectate id=${msg.id}&target=${msg.target}`);
            }
            break;
        case "room-go":
            if (ROOM[msg.id] && DIC[msg.target]) {
                ROOM[msg.id].go(DIC[msg.target]);
            } else {
                // 나가기 말고 연결 자체가 끊겼을 때 생기는 듯 하다.
                IOLog.warn(`Wrong room-go id=${msg.id}&target=${msg.target}`);
                if (ROOM[msg.id] && ROOM[msg.id].players) {
                    // 이 때 수동으로 지워준다.
                    let x = ROOM[msg.id].players.indexOf(msg.target);

                    if (x != -1) {
                        ROOM[msg.id].players.splice(x, 1);
                        IOLog.warn(`^ OK`);
                    }
                }
                if (msg.removed) delete ROOM[msg.id];
            }
            break;
        case "user-publish":
            if (temp = DIC[msg.data.id]) {
                for (let i in msg.data) {
                    temp[i] = msg.data[i];
                }
            }
            break;
        case "room-publish":
            if (temp = ROOM[msg.data.room.id]) {
                for (let i in msg.data.room) {
                    temp[i] = msg.data.room[i];
                }
                temp.password = msg.password;
            }
            KKuTu.publish('room', msg.data);
            break;
        case "room-expired":
            if (msg.create && ROOM[msg.id]) {
                for (let i in ROOM[msg.id].players) {
                    let $c = DIC[ROOM[msg.id].players[i]];

                    if ($c) $c.send('roomStuck');
                }
                delete ROOM[msg.id];
            }
            break;
        case "room-invalid":
            delete ROOM[msg.room.id];
            break;
        case "requestLastRelay":
            let $c = DIC[msg.id];
            requestLastRelay($c, msg.value);
            break;
        case "clients-sync":
            IOLog.info(`총 ${msg.updated.length}개의 업데이트된 클라이언트 데이터를 동기화합니다.`);
            for (const data of msg.updated) {
                for (const key of Object.keys(data)) {
                    if (data && data.id && key) DIC[data.id][key] = data[key];
                }
            }
            break;
        default:
            IOLog.warn(`Unhandled IPC message type: ${msg.type}`);
    }
});
export async function init (_SID, _CHAN) {
    SID = _SID;
    CHAN = _CHAN;
    MainDB = await import('../sub/db.js');
    MainDB.onReady(function () {
        IOLog.notice("마스터 데이터베이스가 준비되었습니다.");

        MainDB.users.update(['server', SID]).set(['server', ""]).on();

        if (IS_WS_SECURED) {
            const options = Secure();
            HTTPS_Server = createServer(options)
                .listen(global.test ? (TEST_PORT + 416) : process.env['KKUTU_PORT']);
            Server = new WSServer({server: HTTPS_Server});
        } else {
            Server = new WSServer({
                port: global.test ? (TEST_PORT + 416) : process.env['KKUTU_PORT'],
                perMessageDeflate: false
            });
        }
        Server.on('connection', function (socket, req) {
            socket.upgradeReq = req;

            let isWebServer = false;
            let key = socket.upgradeReq.url.slice(1);

            if (key.startsWith(WEB_KEY)) {
                isWebServer = true;
                key = key.replace(`${WEB_KEY}:`, '')
            } else {
                // 토큰 복호화
                try {
                    key = decrypt(socket.upgradeReq.url.slice(1), CRYPTO_KEY);
                } catch (exception) {
                    key = ".";
                }

                // 토큰 값 검사
                let pattern = /^[0-9a-zA-Z_-]{32}$/;
                if (!pattern.test(key)) {
                    socket.send(`{ "type": "error", "code": "400" }`);
                    return;
                }
            }

            let $c;
            socket.on('error', function (err) {
                IOLog.warn("Error on #" + key + " on ws: " + err.toString());
            });

            // 웹 서버
            if (isWebServer) {
                if (WDIC[key]) WDIC[key].socket.close();
                WDIC[key] = new KKuTu.WebServer(socket);
                IOLog.notice(`새로운 웹 서버와 연결되었습니다. #${key}`);
                WDIC[key].socket.on('close', function () {
                    IOLog.notice(`웹 서버와의 연결이 끊어졌습니다. #${key}`);
                    WDIC[key].socket.removeAllListeners();
                    delete WDIC[key];
                });
                return;
            }

            MainDB.session.findOne(['_id', key]).limit(['profile', true]).on(function ($body) {
                $c = new KKuTu.Client(socket, $body ? $body.profile : null, key);
                $c.admin = ADMIN.indexOf($c.id) != -1;
                attachGuard($c);

                if (!($c.admin || $c.membership >= 2) && Object.keys(DIC).length >= KKUTU_MAX) {
                    $c.sendError('full');
                    $c.socket.close();

                    IOLog.notice(`서버에 남은 자리가 없으므로 ${$c.profile.title}(${$c.id}) 님의 접속을 거부합니다.`);
                    return;
                }

                if (DIC[$c.id]) {
                    DIC[$c.id].sendError(408);
                    DIC[$c.id].socket.close();
                }
                if (DEVELOP && !TESTER.includes($c.id)) {
                    $c.sendError(500);
                    $c.socket.close();
                    return;
                }
                if (!allowEnter && !$c.admin) {
                    $c.sendError(460);
                    $c.socket.close();
                    return;
                }
                if ($c.guest && SID !== "4") { // 테스트 서버
                    if (SID !== "0" && SID !== "1") {
                        $c.sendError(402);
                        $c.socket.close();
                        return;
                    }
                    if (!allowGuestEnter) {
                        $c.sendError(457);
                        $c.socket.close();
                        return;
                    }
                    if (KKuTu.NIGHT) {
                        $c.sendError(440);
                        $c.socket.close();
                        return;
                    }

                    const userIpObject = normalizeUserIp($c.socket.upgradeReq.connection.remoteAddress);

                    if (userIpObject.type !== 4) {
                        $c.sendError(449);
                        $c.socket.close();
                        return;
                    }

                    const userIp = userIpObject.address;
                    const geoIpData = geoIp(userIp);
                    const geoIpCountry = geoIpData ? geoIpData['country']['code'] : 'NONE';
                    const geoIpAsNumber = geoIpData ? geoIpData['as']['number'] : 'NONE';
                    const geoIpAsName = geoIpData ? geoIpData['as']['name'] : 'NONE';

                    if (geoIpCountry !== 'KR') {
                        IOLog.info(`해외에서 손님으로 접속을 시도하였습니다. 아이피: ${userIp} 국가: ${geoIpCountry}`)
                        $c.sendError(449);
                        $c.socket.close();
                        return;
                    }

                    if (geoIpAsNumber) {
                        if (checkBlockedAs(userIp, geoIpAsName)) {
                            $c.sendError(479);
                            $c.socket.close();
                            return;
                        }
                    }

                    if (isBlockedIp(userIp)) {
                        $c.sendError(479);
                        $c.socket.close();
                        return;
                    }
                }
                if ($c.isAjae === null) {
                    $c.sendError(441);
                    $c.socket.close();
                    return;
                }
                $c.refresh().then(function (ref) {
                    if (ref.result == 200) {
                        if ($c.server && $c.server != SID && !$c.admin) { // 이미 다른 서버에 접속 중
                            $c.send('error', {
                                code: 409, message: $c.server
                            });

                            $c._error = 409;
                            $c.socket.close();
                            return;
                        }
                        DIC[$c.id] = $c;
                        DNAME[($c.profile.title || $c.profile.name).replace(/\s/g, "")] = $c.id;
                        MainDB.users.update(['_id', $c.id]).set(['lastLogin', Date.now()], ['server', SID]).on();

                        if (($c.guest && CAPTCHA_TO_GUEST) || alwaysTriggerCaptcha) {
                            $c.socket.send(JSON.stringify({
                                type: 'captcha',
                                siteKey: CAPTCHA_SITE_KEY
                            }));
                        } else {
                            $c.passCaptcha = true;

                            joinNewUser($c);
                        }
                    } else {
                        if (ref.result === 550) {
                            // 정지된 계정
                            $c.send('error', {
                                code: ref.result, message: ref.black
                            });
                        } else if (ref.result === 551) {
                            // 정지된 아이피
                            $c.send('error', {
                                code: ref.result, message: ref.black
                            });
                        } else {
                            $c.send('error', {
                                code: ref.result, message: ref.black
                            });
                        }

                        $c._error = ref.result;
                        $c.socket.close();
                    }
                });
            });
        });
        Server.on('error', function (err) {
            IOLog.warn("Error on ws: " + err.toString());
        });
        KKuTu.init(MainDB, DIC, ROOM, GUEST_PERMISSION, CHAN);
    });
}

function joinNewUser($c) {
    if (initUserRating($c)) return; // 레이팅 초기화시 값이 true -> 유저 입장 처리 안함

    let event = {};
    event.list = [];
    for (let e of EVENTS) {
        let status = KKuTu.isEventGoing(e);
        let info = {
            start: e.EVENT_START,
            until: e.EVENT_UNTIL,
            status: status,
            id: e.EVENT_ID,
            name: e.EVENT_NAME,
            bulletin: e.EVENT_BULLETIN,
            description: e.EVENT_DESCRIPTION,
            placeholder: e.EVENT_PLACEHOLDER,
            link: e.EVENT_LINK,
            type: {
                wordpiece: e.hasOwnProperty("EVENT_WORDPIECE"),
                point: e.hasOwnProperty("EVENT_POINT"),
                itempiece: e.hasOwnProperty("EVENT_ITEMPIECE"),
                support: e.hasOwnProperty("EVENT_SUPPORT")
            }
        };
        event.list.push(info);
        if (event.status != 1) event.status = event.status || status;
        if (status) {
            event.point = event.point || e.hasOwnProperty("EVENT_POINT");
            event.team = event.team || (event.point && e.EVENT_POINT.ENABLE_TEAM);
            if (event.team) event.teamList = event.teamList || e.EVENT_POINT.TEAM_LIST;
            event.wordpiece = event.wordpiece || e.hasOwnProperty("EVENT_WORDPIECE");
            event.itempiece = event.itempiece || e.hasOwnProperty("EVENT_ITEMPIECE");
        }
    }

    $c.send('welcome', {
        id: $c.id,
        guest: $c.guest,
        box: $c.box,
        playTime: $c.data.playTime,
        okg: $c.okgCount,
        users: KKuTu.getUserList(),
        rooms: KKuTu.getRoomList(),
        friends: $c.friends,
        admin: $c.admin,
        test: global.test,
        caj: !!$c._checkAjae,
        membership: $c.membership,
        event: event
    });
    narrateFriends($c.id, $c.friends, "on");
    KKuTu.publish('conn', {user: $c.getData()});

    heartbeat($c.id);
    waitACinit($c.id);

    IOLog.notice(`${$c.profile.title}(${$c.id}) 님이 게임에 입장했습니다. 접속 인원: ${Object.keys(DIC).length}명`);
}

function heartbeat(id) {
    if (!DIC.hasOwnProperty(id)) return;

    let $c = DIC[id];

    // 관리자 예외처리
    if ($c.admin) return;

    // 이미 연결이 끊긴 사용자 제거
    if ($c.socket.readyState == 3) {
        delete DIC[id];
        return;
    }

    // 이미 요청이 대기중이다 = 앞 요청에 응답하지 않았다
    if ($c.ackWaiting) $c.ackFailed++;

    // 5번 요청에 실패함 => 킥
    if ($c.ackFailed == 15) {
        let name = $c.profile.title || $c.profile.name;
        IOLog.warn(`Heartbeat - ${name} (${$c.id}) 사용자를 추방하였습니다. 사유 : ACK 요청 실패 (${$c.ackFailed})`);
        $c.sendError(442);
        $c.socket.close();
        return;
    }

    $c.send('test', {reqType: 127});
    $c.ackWaiting = true;

    // 8번 응답할동안 다른 패킷이 전송되지 않음
    if ($c.ackCount == 18) $c.send('notice', {value: "사용자님의 동작이 3시간동안 감지되지 않았습니다. 15분 이내로 어떠한 동작을 수행하지 않으면 원활한 서비스를 위해 강제 퇴장 조치됩니다."});

    // 15분 이후 다음 하트비트 전송
    $c.timers.heartbeat = setTimeout(heartbeat, 15 * 60 * 1000, id);
}

KKuTu.onClientMessage(function ($c, msg) {
    if (!msg) return;
    return guardMessage($c, msg, () => {
        if (!$c.passIdentity) {
            if (msg.type === 'identity') {
                $c.passIdentity = true;

                logConnection($c, msg.fingerPrint2, msg.pcidC, msg.pcidL);
            }

            return;
        }

        if (!$c.passCaptcha) {
            if (msg.type === 'captcha') {
                verifyCaptcha(msg.token, $c.socket._socket.remoteAddress, function (success) {
                    if (success) {
                        $c.passCaptcha = true;

                        joinNewUser($c);
                        try {
                            processClientRequest($c, msg);
                        } catch (e) {
                            IOLog.error(`클라이언트의 요청을 처리하는 도중 오류가 발생하였습니다: ${e}`);
                        }

                    } else {
                        IOLog.warn(`${$c.socket._socket.remoteAddress} 아이피에서 CAPTCHA 인증에 실패했습니다.`);

                        $c.sendError(448);
                        $c.socket.close();
                    }
                });
            }

            return;
        }

        try {
            processClientRequest($c, msg);
        } catch (e) {
            IOLog.error(`클라이언트의 요청을 처리하는 도중 오류가 발생하였습니다: ${e}`);
        }
    });
});

function logConnection($c, fingerprint2, pcidC, pcidL) {
    let channel = SID;
    let id = $c.id;
    let name = $c.profile.title;
    let ip = $c.socket.upgradeReq.connection.remoteAddress;
    let userAgent = $c.socket.upgradeReq.headers['user-agent'];

    MainDB.ConnectionLog.addLog(id, name, ip, channel, userAgent, fingerprint2, pcidC, pcidL);
}

function processClientRequest($c, msg) {
    let stable = true;
    let temp;
    let now = (new Date()).getTime();

    if (!msg) return;

    switch (msg.type) {
        case 'yell':
            if (!msg.value) return;
            if (!$c.admin) return;

            $c.publish('yell', {value: msg.value});
            break;
        case 'notice':
            if (!msg.value) return;
            if (!$c.admin) return;

            $c.publish('notice', {value: msg.value});
            break;
        case 'ping':
            $c.send('pong');
            break;
        case 'refreshRoom':
            $c.publish('refreshRoom', {
                rooms: KKuTu.getRoomList()
            });
            break;
        case 'refresh':
            if ($c.gaming) return;
            $c.refresh();
            publishMessage({type: "refresh", id: $c.id});
            break;
        case 'talk':
            if (!msg.value) return;
            if (!msg.value.substr) return;
            if (!GUEST_PERMISSION.talk && $c.guest && $c.place == 0) {
                $c.send('error', {code: 401});
                return;
            }
            msg.value = msg.value.substr(0, 200);
            if ($c.admin) {
                if (!processAdmin($c.id, msg.value)) break;
            }
            checkTailUser($c.id, $c.place, msg);
            if (msg.whisper) {
                msg.whisper.split(',').forEach(v => {
                    if (temp = DIC[DNAME[v]]) {
                        temp.send('chat', {
                            from: $c.profile.title || $c.profile.name,
                            profile: $c.profile,
                            value: msg.value
                        });
                    } else {
                        $c.sendError(424, v);
                    }
                });
            } else {
                if (!allowLobbyChat && $c.place == 0 && !$c.admin) $c.send('notice', {value: "로비 채팅이 일시적으로 비활성화되었습니다."});
                else $c.chat(msg.value);
            }
            break;
        case 'friendAdd':
            if (!msg.target) return;
            if ($c.guest) return;
            if ($c.id == msg.target) return;
            if (Object.keys($c.friends).length >= 200) return $c.sendError(452);
            if (temp = DIC[msg.target]) {
                if (temp.guest) return $c.sendError(453);
                if ($c._friend) return $c.sendError(454);
                $c._friend = temp.id;
                temp.send('friendAdd', {from: $c.id});
            } else {
                $c.sendError(450);
            }
            break;
        case 'friendAddRes':
            if (!(temp = DIC[msg.from])) return;
            if (temp._friend != $c.id) return;
            if (Object.keys($c.friends).length >= 200) return $c.sendError(452);
            if (msg.res) {
                // $c와 temp가 친구가 되었다.
                $c.addFriend(temp.id);
                temp.addFriend($c.id);
            }
            temp.send('friendAddRes', {target: $c.id, res: msg.res});
            delete temp._friend;
            break;
        case 'friendEdit':
            if (!$c.friends) return;
            if (!$c.friends[msg.id]) return;
            if (msg.memo && msg.memo > 50) return $c.sendError(708);
            if (typeof $c.friends[msg.id] !== 'object') {
                // 기존 친구에 대한 처리
                $c.friends[msg.id] = {
                    "nick": $c.friends[msg.id],
                    "memo": $c.friends[msg.id],
                    "bf": false
                };
            }
            $c.friends[msg.id]["memo"] = (msg.memo || "");
            $c.flush(false, false, true);
            $c.send('friendEdit', {friends: $c.friends});
            break;
        case 'friendRemove':
            if (!$c.friends) return;
            if (!$c.friends[msg.id]) return;
            $c.removeFriend(msg.id);
            break;
        case 'toggleBF':
            if (!$c.friends) return;
            if (!$c.friends[msg.id]) return;
            if (typeof $c.friends[msg.id] !== 'object') {
                // 기존 친구에 대한 처리
                $c.friends[msg.id] = {
                    "nick": $c.friends[msg.id],
                    "memo": $c.friends[msg.id],
                    "bf": false
                };
            }
            $c.friends[msg.id]["bf"] = !$c.friends[msg.id]["bf"];
            $c.flush(false, false, true);
            $c.send('friendEdit', {friends: $c.friends});
            break;
        case 'report':
            // IOLog.info("[DEBUG] Got Response: REPORT");
            if (!msg.id || !msg.reason) return;
            if (!GUEST_PERMISSION.report) if ($c.guest) return;
            if ($c.id == msg.id) return $c.sendError(400);

            processReport($c, msg, "user");
            break;
        case "reportRoom":
            if (!msg.id || !msg.reason) return;
            if (!GUEST_PERMISSION.report) if ($c.guest) return;

            processReport($c, msg, "room");
            break;
        case "reportChat":
            if (!msg.id || !msg.reason) return;
            if (!GUEST_PERMISSION.report) if ($c.guest) return;

            processReport($c, msg, "chat");
            break;
        case 'enter':
        case 'setRoom':
            if (!msg.title) stable = false;
            if (!msg.limit) stable = false;
            if (!msg.round) stable = false;
            if (!msg.time) stable = false;
            if (!msg.opts) stable = false;

            if (msg.opts && msg.opts.randmission && !msg.opts.mission) stable = false;
            if (msg.opts && msg.opts.tactical && !msg.opts.mission) stable = false;

            msg.code = false;
            msg.limit = Number(msg.limit);
            msg.mode = Number(msg.mode);
            msg.round = Number(msg.round);
            msg.time = Number(msg.time);

            if (isNaN(msg.limit)) stable = false;
            if (isNaN(msg.mode)) stable = false;
            if (isNaN(msg.round)) stable = false;
            if (isNaN(msg.time)) stable = false;

            if (stable) {
                if (Date.now() - ($c._tempFlags.setRoom === undefined ? 0 : $c._tempFlags.setRoom) < 3000) {
                    msg.code = 476;
                    stable = false;
                }
                if ($c.guest && !allowedRoomTitles.includes(msg.title)) stable = false;
                if (msg.title.length > 24) stable = false;
                if (msg.password && msg.password.length !== 32) stable = false;
                if (!$c.admin && (msg.limit < 2 || msg.limit > ($c.perks["maximumPlayers"] || 8))) {
                    msg.code = 432;
                    stable = false;
                }
                if (msg.mode < 0 || msg.mode >= MODE_LENGTH) stable = false;
                if (msg.round < 1 || msg.round > 10) {
                    msg.code = 433;
                    stable = false;
                }
                if ($c.guest && (msg.opts.noguest || msg.opts.onlybeginner || msg.opts.etiquette)) {
                    msg.code = 701;
                    stable = false;
                }
                else if (msg.opts.onlybeginner && (getLevel($c) >= 50)) {
                    msg.code = 702;
                    stable = false;
                }
                else if (msg.opts.etiquette && getRatingLevel($c) < 1) {
                    msg.code = 704;
                    stable = false;
                }
                // if (ENABLE_ROUND_TIME.indexOf(msg.time) == -1) stable = false;
                if (msg.time < 5 || msg.time > 150) {
                    stable = false;
                }
            }

            if (stable) $c._tempFlags.setRoom = Date.now();
            if (msg.type == 'enter') {
                if (msg.id || stable) $c.enter(msg, msg.spectate);
                else $c.sendError(msg.code || 431);
            } else if (msg.type == 'setRoom') {
                if (!allowRoomCreate) $c.sendError(462);
                else if (stable) $c.setRoom(msg);
                else $c.sendError(msg.code || 431);
            }
            break;
        case 'inviteRes':
            if (!(temp = ROOM[msg.from])) return;
            if (!GUEST_PERMISSION.inviteRes) if ($c.guest) return;
            if ($c._invited != msg.from) return;
            if (msg.res) {
                $c.enter({id: $c._invited}, false, true);
            } else {
                if (DIC[temp.master]) DIC[temp.master].send('inviteNo', {target: $c.id});
            }
            delete $c._invited;
            break;
        /* 망할 셧다운제
        case 'caj':
            if(!$c._checkAjae) return;
            clearTimeout($c._checkAjae);
            if(msg.answer == "yes") $c.confirmAjae(msg.input);
            else if(KKuTu.NIGHT){
                $c.sendError(440);
                $c.socket.close();
            }
            break;
        */
        case 'test':
            checkTailUser($c.id, $c.place, msg);
            break;
        case 'nickChange':
            if ($c.guest) return;
            if (!msg.value || typeof msg.isFixed === "undefined") return $c.sendError(400);
            processUserNickChange($c, msg.value, msg.isFixed, function (code) {
                $c.sendError(code);
            });
            break;
        case 'mailBox':
            if ($c.guest) return;
            
            const currentTime = Date.now();
            
            MainDB.mailbox.find().on(function(mails) {
                if (!mails) return $c.send('mailBox', { mails: [] });
                
                const validMails = mails.filter(mail => {
                    // 만료 여부 확인
                    if (mail.expire && new Date(mail.expire) < new Date(currentTime)) return false;
                    
                    // 수령 여부 확인
                    if (mail.received && mail.received.includes($c.id)) return false;
                    
                    // 수신자 확인
                    if (mail.recipients && mail.recipients.length > 0 && !mail.recipients.includes($c.id)) return false;
                    
                    return true;
                });
                
                const mailsToSend = validMails.map(mail => ({
                    _id: mail._id,
                    title: mail.title,
                    desc: mail.desc,
                    expire: mail.expire,
                    rewards: mail.rewards || [],
                    hasRewards: mail.rewards && mail.rewards.length > 0
                }));
                
                $c.send('mailBox', { mails: mailsToSend });
            });
            break;
    
        case 'obtainMail':
            if ($c.guest) return;
            if (!msg.id) return $c.sendError(400);
            
            MainDB.mailbox.findOne(['_id', msg.id]).on(function(mail) {
                if (!mail) return $c.sendError(404);
                
                if (mail.expire && new Date(mail.expire) < new Date()) {
                    return $c.sendError(410); // 메일 만료
                }
                
                if (mail.recipients && mail.recipients.length > 0 && !mail.recipients.includes($c.id)) {
                    return $c.sendError(403); // 수령 대상 아님
                }
                
                if (mail.received && mail.received.includes($c.id)) {
                    return $c.sendError(409); // 이미 보상 수령
                }
                
                const received = mail.received || [];
                received.push($c.id);
                
                const updates = {
                    hit: (mail.hit || 0) + 1,
                    received: JSON.stringify(received)
                };
                
                let hasRewards = false;
                if (mail.rewards && mail.rewards.length > 0) {
                    hasRewards = true;
                    mail.rewards.forEach(reward => {
                        if (reward.type === "ping") {
                            $c.money += (reward.q || 0);
                        } else if (reward.type === "item" && reward.name) {
                            if (reward.expire) {
                                $c.obtain(reward.name, {
                                    q: reward.q || 1,
                                    x: Math.floor(Date.now() / 1000) + reward.expire,
                                    mx: reward.mx || false
                                });
                            } else {
                                $c.obtain(reward.name, {
                                    q: reward.q || 1
                                });
                            }
                        }
                    });
                    
                    $c.flush(true, false, true);
                }
                
                MainDB.mailbox.update(['_id', msg.id]).set(updates).on(function() {
                    $c.send('obtainMail', { 
                        result: true, 
                        id: mail._id, 
                        rewards: mail.rewards || [] 
                    });
                });
            });
            break;
        case 'useCoupon':
            if ($c.guest) return $c.sendError(400);
            if (!msg.value) return $c.sendError(400);

            MainDB.coupons.findOne(['code', msg.value]).on(function ($coupon) {
                if (!$coupon) return $c.sendError(715);
                if (!$coupon.active) return $c.sendError(715);

                const expiresAt = new Date($coupon['expiresAt']);
                const currentDate = new Date();
                const usedCoupons = $c.getFlag('usedCoupons') || {};

                if (expiresAt < currentDate) {
                    IOLog.info(`${$c.profile.title}(${$c.id})님이 만료된 교환권 ${msg.value}을(를) 입력하였습니다.`);
                    return $c.sendError(715);
                }
                if ($coupon.maxUse !== -1 && $coupon.used >= $coupon.maxUse) {
                    IOLog.info(`${$c.profile.title}(${$c.id})님이 사용 가능 횟수 ${$coupon.maxUse}를 초과하여 교환권 ${msg.value}을(를) 사용 시도하였습니다.`);
                    return $c.sendError(716);
                }
                if (!$coupon.flags['allowDuplicates'] && usedCoupons.hasOwnProperty(msg.value)) {
                    IOLog.info(`${$c.profile.title}(${$c.id})님이 이미 사용한 교환권 ${msg.value}을(를) 사용 시도하였습니다.`);
                    return $c.sendError(717);
                }

                $coupon.used += 1;

                for (let key in usedCoupons) {
                    if (usedCoupons.hasOwnProperty(key) && usedCoupons[key]["expiresAt"] < Date.now()) {
                        delete usedCoupons[key];
                    }
                }

                MainDB.coupons.update(['code', msg.value]).set(['used', $coupon.used]).on();

                $c.money += $coupon.money;
                $c.data.score += $coupon.score;

                $c.send('obtain', { money: $coupon.money, exp: $coupon.score });

                for (let key in $coupon.items) {
                    $c.obtain(key, {
                        q: $coupon.items[key].value,
                        x: $coupon.items[key].expire ? parseInt($coupon.items[key].expire) : undefined,
                        mx: !!parseInt($coupon.items.mx) || false
                    });
                }

                usedCoupons[msg.value] = 1;
                $c.setFlag('usedCoupons', usedCoupons);
                $c.flush(true, false, false, true);

                IOLog.info(`${$c.profile.title}(${$c.id})님이 교환권 ${msg.value}을(를) 사용하였습니다.`);
                // $c.sendError(718);
            });
            break;
        case 'drawGacha':
            if ($c.gaming) return $c.sendError(438);
            if ($c.guest) return $c.sendError(421);
            if (!msg.item) return $c.sendError(400);
            if (!msg.count) return $c.sendError(400);
            if (![1, 10].includes(msg.count)) return $c.sendError(400);

            let gachaItem = MainDB.shop[msg.item];
            if (!gachaItem) return $c.sendError(430);
            if (gachaItem.group != "CNS") return $c.sendError(430);

            let pricePerDraw = MainDB.shop[msg.item].cost || 300;
            if (pricePerDraw === -1) return $c.sendError(430);
            if (msg.count === 10) pricePerDraw = Math.floor(pricePerDraw * 0.9);

            let subTotal = pricePerDraw * msg.count;
            if ($c.money < subTotal) return $c.sendError(407);
            $c.money -= subTotal;
            $c.draw(gachaItem, msg.count);
            break;
        case 'consume':
            if ($c.gaming) return $c.sendError(438);
            if ($c.guest) return $c.sendError(421);
            if (!msg.item) return $c.sendError(400);
            let item;
            if (!$c.box.hasOwnProperty(msg.item)) return $c.sendError(430);
            if (!(item = MainDB.shop[msg.item])) return $c.sendError(430);
            if (item.group == "CNS") $c.consume(item, msg.count);
            else $c.equipItem(item, msg.slot);
            break;
        case 'getExchanges':
            $c.send('exchangeData', {
                exchange: EXCHANGEABLES
            });
            break;
        case 'exchange':
            if (!msg.eid || !msg.id) return $c.sendError(400);
            $c.exchange(msg.eid, msg.id);
            break;
        case 'gift':
            stable = false;
            for (let event of EVENTS) {
                if (KKuTu.isEventGoing(event) &&
                    event.hasOwnProperty("EVENT_ITEMPIECE") && event.EVENT_ITEMPIECE.ENABLE_GIFT &&
                    event.hasOwnProperty("EVENT_POINT")) {
                        stable = true; // 이벤트 진행중
                        break;
                }
            }
            if (!stable) return $c.sendError(556); // 이벤트 진행중 아님
            if ($c.gaming) return $c.sendError(438); // 본인이 게임중
            if ($c.guest) return $c.sendError(421); // 본인이 게스트
            if (!msg.target) return $c.sendError(400); // 대상이 없음
            if (!DIC.hasOwnProperty(msg.target)) return $c.sendError(405); // 대상이 접속중이 아님
            if (DIC[msg.target].gaming) return $c.sendError(417); // 대상이 게임중
            if (DIC[msg.target].guest) return $c.sendError(421); // 대상이 게스트
            if (!MainDB.shop.hasOwnProperty(msg.item)) return $c.sendError(430); // 서버에 없는 아이템
            if (!MainDB.shop[msg.item].options.giftable) return $c.sendError(400); // 선물 불가능한 아이템
            if (!$c.box.hasOwnProperty(msg.item)) return $c.sendError(434); // 아이템을 소지하고있지 않음
            if (!$c.box[msg.item].value < 1) return $c.sendError(434); // 아이템이 1개 미만임..?
            if ($c.money < 200) return $c.sendError(407); // 핑 부족
            if ($c.event.point < 20) return $c.sendError(469); // EP 부족

            let $t = DIC[msg.target];
            let expire = $c.box[msg.item].expire || 0;

            // 보낸쪽 처리
            if (--$c.box[msg.item].value) delete $c.box[msg.item];
            $c.money = $c.money - 200;
            $c.event.point = $c.getFlag("eventPoint") || 0;
            $c.event.point = $c.event.point - 20;
            $c.setFlag("eventPoint", $c.event.point);
            $c.send('obtain', { money: $c.money, box: $c.box, event: $c.event });
            $c.send('gift', { to: $t.id, item: msg.item });
            $c.flush(true, false, false, true);

            // 받는쪽 처리
            $t.obtain(msg.item, { x: expire, mx: true });
            $t.send('obtain', { box: $c.box });
            $t.send('gift', { from: $c.id, item: msg.item });
            $t.flush(true, false, false, false);
            break;
        case 'uid':
            if ($c.guest) return $c.sendError(464);
            $c.send('prompt', {
                lang: 'uidInfo',
                type: 'uid',
                value: $c.getFlag("uid")
            });
            break;
        case 'newUid':
            if ($c.guest) return $c.sendError(464);
            if (($c.getFlagTime("uid") + 1800) > Math.floor(new Date() / 1000))
                return $c.sendError(465);
            $c.setFlag("uid", nanoid(), true);
            $c.flush(false, false, false, true);
            $c.send('prompt', {
                lang: 'newUidInfo',
                type: 'uid',
                value: $c.getFlag("uid")
            });
            break;
        case 'saveProgress':
            if (!$c.guest) return $c.sendError(400);
            let importCode;

            if (msg.gid) {
                if (!savedProgress["savedUserInfo"].hasOwnProperty(msg.gid)) {
                    return $c.sendError(400);
                }

                importCode = msg.gid;
            } else {
                const ip = $c.socket.upgradeReq.connection.remoteAddress.slice(7);

                if (savedProgress["reqCountByIp"][ip] > 10) {
                    return $c.sendError(710);
                }

                // 절대 그럴 일이 없을 것 같지만.. 메모리에 저장하니까 혹시 모르니 확인해본다.
                if (savedProgress["savedUserInfo"].length > (2 ** 19)) {
                    return $c.sendError(434);
                }

                savedProgress["reqCountByIp"][ip] += 1;

                importCode = importId();
            }

            savedProgress["savedUserInfo"][importCode] = {
                "money": $c.money,
                "score": $c.data.score,
                "box": $c.box || {}
            };

            $c.send('prompt', {
                lang: 'gidInfo',
                type: 'gid',
                value: importCode
            });

            break;
        case 'listSurvey':
            if ($c.guest) return $c.sendError(400);

            $c.send('surveyList', {
               surveys: MainDB.survey
            });
            break;
        case 'getSurveyToken':
            if ($c.guest) return $c.sendError(400);
            if (!$c.hasFlag("surveyToken") || $c.getFlagTime("surveyToken").getFullYear() == new Date().getFullYear()) {
                $c.setFlag("surveyToken", nanoid(), true);
                $c.flush(false, false, false, true);
            }

            return $c.send('surveyToken', { value: $c.getFlag("surveyToken") });
        case 'import':
            if ($c.guest) return $c.sendError(711);
            if (!msg.gid) return $c.sendError(400);
            if (!savedProgress["savedUserInfo"].hasOwnProperty(msg.gid)) return $c.sendError(712);

            const o = savedProgress["savedUserInfo"][msg.gid];

            $c.money += o.money;
            $c.data.score += o.score;

            for (let key in o.box) {
                if ($c.box.hasOwnProperty(key)) {
                    $c.box[key]["value"] += o.box[key]["value"];
                } else {
                    $c.box[key] = o.box[key];
                }
            }

            $c.sendError(713);
            $c.flush(true, false, false, false);
            delete savedProgress["savedUserInfo"][msg.gid];

            break;
        case msg.type.startsWith('wms'):
            processSuspicion.call(this, $c, msg);
            break;
        default:
            break;
    }
}

KKuTu.onClientClosed(function ($c, code) {
    delete DIC[$c.id];
    for (let timer in $c.timers) {
        clearTimeout($c.timers[timer]);
    }
    detachGuard($c);
    if ($c._error != 409) MainDB.users.update(['_id', $c.id]).set(['server', ""]).on();
    if ($c.profile) delete DNAME[$c.profile.title || $c.profile.name];
    if ($c.socket) $c.socket.removeAllListeners();
    if ($c.friends) narrateFriends($c.id, $c.friends, "off");
    KKuTu.publish('disconn', {id: $c.id});

    IOLog.notice(`${$c.profile.title}(${$c.id}) 님이 게임에서 퇴장했습니다. 접속 인원: ${Object.keys(DIC).length}명`);
});

const job = new CronJob('0 0 * * *', () => {
    savedProgress = {
        "reqCountByIp": {},
        "savedUserInfo": {}
    };

    IOLog.info('자정이 지나 저장된 불러오기 데이터가 초기화되었습니다.');
}, null, true, "Asia/Seoul");