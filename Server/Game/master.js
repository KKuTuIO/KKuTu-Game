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
import Cluster from "cluster";
const WSServer = (await import('ws')).default.Server;
import { createServer } from 'https';
let HTTPS_Server;
// import { writeSnapshot }from "heapdump";
import * as KKuTu from './kkutu.js';
import { decrypt } from "../sub/crypto.js";
import GLOBAL from "../sub/global.json" assert { type: "json" };
import { DISCORD_WEBHOOK, GAME_TYPE, IS_WS_SECURED,
    TEST_PORT, KKUTU_MAX, TESTER } from "../const.js";
import * as IOLog from '../sub/KKuTuIOLog.js';
import Secure from '../sub/secure.js';
import { verifyCaptcha } from '../sub/captcha.js';
import { requestLastRelay, waitACinit, processSuspicion } from '../sub/utils/AntiCheat.js';
import { initUserRating } from '../sub/utils/UserRating.js';
import { processUserNickChange } from "../sub/UserNickChange.js";
import geoIp from 'geoip-country';
import { Webhook, MessageBuilder } from 'discord-webhook-node';
const reportDiscordWebHook = new Webhook(DISCORD_WEBHOOK.REPORT);

let MainDB;

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
let alwaysTriggerCaptcha = GLOBAL.CAPTCHA_TO_USER;

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
    switch (cmd) {
        case "delroom":
            if (temp = ROOM[value]) {
                for (let i in ROOM[value].players) {
                    let $c = DIC[ROOM[value].players[i]];
                    if ($c) {
                        $c.send('notice', {value: "???????????? ????????? ?????? ???????????? ?????? ?????????????????????."});
                        $c.send('roomStuck');
                    }
                }
                delete ROOM[value];
            }
            return null;
        case "roomtitle":
            msg = value.trim().split(" ");
            if (temp = ROOM[msg[0]]) {
                temp.title = msg[1] ? value.slice(msg[0].length + 1) : "???????????????#" + msg[0];
                temp.worker.send({type: 'room-title', id: msg[0], value: temp.title});
                KKuTu.publish('room', {target: id, room: temp.getData(), modify: true}, temp.password);
            }
            return null;
        case "nick":
            msg = value.trim().split(" ");
            let newName = msg[1] ? value.slice(msg[0].length + 1) : '???????????????' + msg[0].replace(/[^0-9]/g, "").substring(0, 5);
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
            if (temp = DIC[value]) {
                temp.socket.send('{"type":"error","code":410}');
                temp.socket.close();
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

                DIC[id].send('chat', {notice: true, message: '?????? ????????? ??????????????? ????????????????????????.'});
                IOLog.notice(`${id} ?????? ?????? ????????? ??????????????? ????????????????????????.`);
            } else {
                allowLobbyChat = true;

                DIC[id].send('chat', {notice: true, message: '?????? ????????? ?????????????????????.'});
                IOLog.notice(`${id} ?????? ?????? ????????? ?????????????????????.`);
            }
            return null;
        case "setxp":
            if(!value) return;
            temp = parseFloat(value);
            if(!XPMultiplier) return;
            XPMultiplier = temp;
            DIC[id].send('notice', {value: `????????? ????????? ?????? ${XPMultiplier}????????????.`})
            return null;
        case "setmoney":
            if(!value) return;
            temp = parseFloat(value);
            if(!MoneyMultiplier) return;
            MoneyMultiplier = temp;
            DIC[id].send('notice', {value: `??? ????????? ?????? ${MoneyMultiplier}????????????.`})
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
                DIC[id].send('chat', {notice: true, message: '??? ????????? ??????????????? ???????????????????????????.'});
                IOLog.notice(`${id} ?????? ??? ????????? ??????????????? ????????????????????????.`);
            } else {
                allowRoomCreate = true;
                DIC[id].send('chat', {notice: true, message: '??? ????????? ????????????????????????.'});
                IOLog.notice(`${id} ?????? ??? ????????? ?????????????????????.`);
            }
            return null;
        case "allowguest":
            if(allowGuestEnter) {
                allowGuestEnter = false;

                DIC[id].send('chat', {notice: true, message: '?????? ????????? ????????? ??????????????? ????????????????????????.'});
                IOLog.notice(`${id} ?????? ?????? ????????? ????????? ??????????????? ????????????????????????.`);

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

                DIC[id].send('chat', {notice: true, message: '?????? ????????? ????????? ?????????????????????.'});
                IOLog.notice(`${id} ?????? ?????? ????????? ????????? ?????????????????????.`);
            }
            return null;
        case "allowenter":
            if(allowEnter) {
                allowEnter = false;

                DIC[id].send('chat', {notice: true, message: '????????? ????????? ??????????????? ????????????????????????.'});
                IOLog.notice(`${id} ?????? ????????? ????????? ??????????????? ????????????????????????.`);
            } else {
                allowEnter = true;

                DIC[id].send('chat', {notice: true, message: '????????? ????????? ????????? ?????????????????????.'});
                IOLog.notice(`${id} ?????? ????????? ????????? ?????????????????????.`);
            }
            return null;
        case 'captcha':
            if(alwaysTriggerCaptcha) {
                alwaysTriggerCaptcha = false;

                DIC[id].send('chat', {notice: true, message: 'CAPTCHA ?????? ????????? "?????? ??????"(???)??? ?????????????????????.'});
                IOLog.notice(`${id} ?????? CAPTCHA ?????? ????????? "?????? ??????"(???)??? ?????????????????????.`);
            } else {
                alwaysTriggerCaptcha = true;

                DIC[id].send('chat', {notice: true, message: 'CAPTCHA ?????? ????????? "?????? ??????"(???)??? ?????????????????????.'});
                IOLog.notice(`${id} ?????? CAPTCHA ?????? ????????? "?????? ??????"(???)??? ?????????????????????.`);
            }
            return null;
        case "refreshword":
            DIC[id].send('notice', {value: "?????? ????????? ?????? ???????????????. ????????? ????????? ????????? ???????????????."});
            publishMessage({type:"refresh-word"});
            MainDB.refreshWordcache();
            return null;
        case "refreshshop":
            DIC[id].send('notice', {value: "????????? ????????? ?????? ???????????????. ????????? ????????? ????????? ???????????????."});
            publishMessage({type:"refresh-shop"});
            MainDB.refreshShopcache();
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
            DIC[msg.target].send('invited', {from: msg.place});
            break;
        case "room-new":
            if (ROOM[msg.room.id] || !DIC[msg.target]) { // ?????? ?????? ID??? ?????? ??????... ??? ?????? ?????? ?????? ??????.
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
                // ????????? ?????? ?????? ????????? ????????? ??? ????????? ??? ??????.
                IOLog.warn(`Wrong room-go id=${msg.id}&target=${msg.target}`);
                if (ROOM[msg.id] && ROOM[msg.id].players) {
                    // ??? ??? ???????????? ????????????.
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
        default:
            IOLog.warn(`Unhandled IPC message type: ${msg.type}`);
    }
});
export async function init (_SID, _CHAN) {
    SID = _SID;
    CHAN = _CHAN;
    MainDB = await import('../sub/db.js');
    MainDB.onReady(function () {
        IOLog.notice("????????? ????????????????????? ?????????????????????.");

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

            if (key.startsWith(GLOBAL.WEB_KEY)) {
                isWebServer = true;
                key = key.replace(`${GLOBAL.WEB_KEY}:`, '')
            } else {
                // ?????? ?????????
                try {
                    key = decrypt(socket.upgradeReq.url.slice(1), GLOBAL.CRYPTO_KEY);
                } catch (exception) {
                    key = ".";
                }

                // ?????? ??? ??????
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

            // ??? ??????
            if (isWebServer) {
                if (WDIC[key]) WDIC[key].socket.close();
                WDIC[key] = new KKuTu.WebServer(socket);
                IOLog.notice(`????????? ???????????? ?????????????????????. #${key}`);
                WDIC[key].socket.on('close', function () {
                    IOLog.notice(`???????????? ????????? ???????????????. #${key}`);
                    WDIC[key].socket.removeAllListeners();
                    delete WDIC[key];
                });
                return;
            }

            MainDB.session.findOne(['_id', key]).limit(['profile', true]).on(function ($body) {
                $c = new KKuTu.Client(socket, $body ? $body.profile : null, key);
                $c.admin = GLOBAL.ADMIN.indexOf($c.id) != -1;

                if (!$c.admin && Object.keys(DIC).length >= KKUTU_MAX) {
                    $c.sendError('full');
                    $c.socket.close();

                    IOLog.notice(`????????? ?????? ????????? ???????????? ${$c.profile.title}(${$c.id}) ?????? ????????? ???????????????.`);
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
                if ($c.guest) {
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

                    let userIp = $c.socket.upgradeReq.connection.remoteAddress;
                    let lookuped = geoIp.lookup(userIp);
                    let geoCountry = lookuped ? lookuped['country'] : 'NONE'

                    if (geoCountry !== 'KR') {
                        IOLog.info(`???????????? ???????????? ????????? ?????????????????????. ?????????: ${userIp} ??????: ${geoCountry}`)
                        $c.sendError(449);
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
                        DIC[$c.id] = $c;
                        DNAME[($c.profile.title || $c.profile.name).replace(/\s/g, "")] = $c.id;
                        MainDB.users.update(['_id', $c.id]).set(['server', SID]).on();

                        if (($c.guest && GLOBAL.CAPTCHA_TO_GUEST) || alwaysTriggerCaptcha) {
                            $c.socket.send(JSON.stringify({
                                type: 'captcha',
                                siteKey: GLOBAL.CAPTCHA_SITE_KEY
                            }));
                        } else {
                            $c.passCaptcha = true;

                            joinNewUser($c);
                        }
                    } else {
                        if (ref.result === 550) {
                            // ????????? ??????
                            $c.send('error', {
                                code: ref.result, message: ref.black
                            });
                        } else if (ref.result === 551) {
                            // ????????? ?????????
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
    if (initUserRating($c)) return; // ????????? ???????????? ?????? true -> ?????? ?????? ?????? ??????

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
        caj: !!$c._checkAjae
    });
    narrateFriends($c.id, $c.friends, "on");
    KKuTu.publish('conn', {user: $c.getData()});

    heartbeat($c.id);
    waitACinit($c.id);

    IOLog.notice(`${$c.profile.title}(${$c.id}) ?????? ????????? ??????????????????. ?????? ??????: ${Object.keys(DIC).length}???`);
}

function heartbeat(id) {
    if (!DIC.hasOwnProperty(id)) return;

    let $c = DIC[id];

    // ????????? ????????????
    if ($c.admin) return;

    // ?????? ????????? ?????? ????????? ??????
    if ($c.socket.readyState == 3) {
        delete DIC[id];
        return;
    }

    // ?????? ????????? ??????????????? = ??? ????????? ???????????? ?????????
    if ($c.ackWaiting) $c.ackFailed++;

    // 5??? ????????? ????????? => ???
    if ($c.ackFailed == 5) {
        let name = $c.profile.title || $c.profile.name;
        IOLog.warn(`Heartbeat - ${name} (${$c.id}) ???????????? ?????????????????????. ?????? : ACK ?????? ?????? (${$c.ackFailed})`);
        $c.sendError(442);
        $c.socket.close();
        return;
    }

    $c.send('test', {reqType: 127});
    $c.ackWaiting = true;

    // 8??? ??????????????? ?????? ????????? ???????????? ??????
    if ($c.ackCount == 8) $c.send('notice', {value: "??????????????? ????????? 2???????????? ???????????? ???????????????. 15??? ????????? ????????? ????????? ???????????? ????????? ????????? ???????????? ?????? ?????? ?????? ???????????????."});

    // 15??? ?????? ?????? ???????????? ??????
    $c.timers.heartbeat = setTimeout(heartbeat, 15 * 60 * 1000, id);
}

KKuTu.onClientMessage(function ($c, msg) {
    if (!msg) return;

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

                    processClientRequest($c, msg);
                } else {
                    IOLog.warn(`${$c.socket._socket.remoteAddress} ??????????????? CAPTCHA ????????? ??????????????????.`);

                    $c.sendError(447);
                    $c.socket.close();
                }
            });
        }

        return;
    }

    processClientRequest($c, msg);
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
        case 'refresh':
            if ($c.gaming) return;
            $c.refresh();
            publishMessage({type: "refresh", id: $c.id});
            break;
        case 'talk':
            if (!msg.value) return;
            if (!msg.value.substr) return;
            if (!GUEST_PERMISSION.talk) if ($c.guest) {
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
                if (!allowLobbyChat && $c.place == 0 && !$c.admin) $c.send('notice', {value: "?????? ????????? ??????????????? ???????????????????????????."});
                else $c.chat(msg.value);
            }
            break;
        case 'friendAdd':
            if (!msg.target) return;
            if ($c.guest) return;
            if ($c.id == msg.target) return;
            if (Object.keys($c.friends).length >= 100) return $c.sendError(452);
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
            if (msg.res) {
                // $c??? temp??? ????????? ?????????.
                $c.addFriend(temp.id);
                temp.addFriend($c.id);
            }
            temp.send('friendAddRes', {target: $c.id, res: msg.res});
            delete temp._friend;
            break;
        case 'friendEdit':
            if (!$c.friends) return;
            if (!$c.friends[msg.id]) return;
            $c.friends[msg.id] = (msg.memo || "").slice(0, 50);
            $c.flush(false, false, true);
            $c.send('friendEdit', {friends: $c.friends});
            break;
        case 'friendRemove':
            if (!$c.friends) return;
            if (!$c.friends[msg.id]) return;
            $c.removeFriend(msg.id);
            break;
        case 'report':
            // IOLog.info("[DEBUG] Got Response: REPORT");
            if (!msg.id || !msg.reason) return;
            if (!GUEST_PERMISSION.report) if ($c.guest) return;

            const embed = new MessageBuilder()
                .setTitle('?????? ??????')
                .setDescription('?????? ????????? ?????? ????????? ?????????????????????.')
                .setColor(14423100)
                .addField('????????? ID', $c.id, false)
                .addField('?????? ID', msg.id, false)
                .addField('??????', msg.reason, false)
                .setTimestamp();

            reportDiscordWebHook.send(embed).then(() => {
                $c.send('notice', {value: "????????? ??????????????? ?????????????????????."});
                IOLog.notice(`${$c.profile.title}(${$c.id}) ?????? ${msg.id} ?????? "${msg.reason}" ????????? ??????????????????.`);
            }).catch(err => {
                IOLog.error(`?????? ????????? ???????????? ???????????? ???????????? ??? ????????? ??????????????????. ${err.message}`);
            });
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
                if (msg.title.length > 24) stable = false;
                if (msg.password.length > 32) stable = false;
                if (!$c.admin && (msg.limit < 2 || msg.limit > 8)) {
                    msg.code = 432;
                    stable = false;
                }
                if (msg.mode < 0 || msg.mode >= MODE_LENGTH) stable = false;
                if (msg.round < 1 || msg.round > 10) {
                    msg.code = 433;
                    stable = false;
                }
                if ((msg.opts.noguest || msg.opts.onlybeginner || msg.opts.etiquette) && $c.guest) {
                    msg.code = 434;
                    stable = false;
                }
                /*
                TODO: ?????? ???????????? 50?????? ?????? ?????? ??????
                TODO: ????????? ???????????? ?????? ?????? ?????? ?????? ??????
                if (msg.opts.onlybeginner && ) {
                    msg.code = 434;
                    stable = false;
                }
                */
                // if (ENABLE_ROUND_TIME.indexOf(msg.time) == -1) stable = false;
                if (msg.time < 10 || msg.time > 150) {
                    stable = false;
                }
            }
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
        /* ?????? ????????????
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
            processUserNickChange($c, msg.value, function (code) {
                $c.sendError(code);
            });
            break;
        case 'consume':
            if ($c.gaming) return $c.sendError(438);
            if ($c.guest) return $c.sendError(421);
            let item;
            if (!$c.box.hasOwnProperty(msg.item)) return $c.sendError(430);
            if (!(item = MainDB.shop[msg.item])) return $c.sendError(430);
            if (item.group == "CNS") $c.consume(item, msg.count);
            else $c.equipItem(item, msg.slot);
            break;
        case 'polygama':
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
    if ($c._error != 409) MainDB.users.update(['_id', $c.id]).set(['server', ""]).on();
    if ($c.profile) delete DNAME[$c.profile.title || $c.profile.name];
    if ($c.socket) $c.socket.removeAllListeners();
    if ($c.friends) narrateFriends($c.id, $c.friends, "off");
    KKuTu.publish('disconn', {id: $c.id});

    IOLog.notice(`${$c.profile.title}(${$c.id}) ?????? ???????????? ??????????????????. ?????? ??????: ${Object.keys(DIC).length}???`);
});