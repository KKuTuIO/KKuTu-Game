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
import getLevel from "../sub/KKuTuLevel.js";

const WSServer = (await import('ws')).default.Server;
// import * as File from 'fs';
import { reloads, IS_WS_SECURED, TEST_PORT, CRYPTO_KEY, ADMIN, TESTER, GAME_TYPE } from "../config.js";
import { createServer } from 'https';
import Secure from '../sub/secure.js';

let Server;
let HTTPS_Server;

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
import { DEVELOP, GUEST_PERMISSION, //ENABLE_ROUND_TIME,
    ENABLE_FORM, MODE_LENGTH } from './master.js';
import * as KKuTu from './kkutu.js';
import { decrypt } from "../sub/crypto.js";
// import * as Lizard from '../sub/lizard.js';
import * as MainDB from '../sub/db.js';
import * as IOLog from '../sub/KKuTuIOLog.js';
import { checkMessagneIntegrity } from '../sub/utils/AntiCheat.js';
import { getRatingLevel, modifyUserRating, ratingInfo } from '../sub/utils/UserRating.js';

let DIC = {};
let DNAME = {};
let ROOM = {};
let RESERVED = {};

const CHAN = process.env['CHANNEL'];

IOLog.notice(`<< 끄투리오 게임서버@${CHAN} >>`);

process.on('uncaughtException', function (err) {
    let text = `:${process.env['KKUTU_PORT']} [${new Date().toLocaleString()}] ERROR: ${err.toString()}\n${err.stack}`;

    for (let i in DIC) {
        DIC[i].send('dying');
    }

    IOLog.emerg(`ERROR OCCURRED! This worker will die in 10 seconds. ${text}`);
    setTimeout(function () {
        process.exit();
    }, 10000);
});
process.on('message', function (msg) {
    switch (msg.type) {
        case "invite-error":
            if (!DIC[msg.target]) break;
            DIC[msg.target].sendError(msg.code);
            break;
        case "room-reserve":
            if (RESERVED[msg.session]) {
                // 이미 입장 요청을 했는데 또 하는 경우
                break;
            } else RESERVED[msg.session] = {
                profile: msg.profile,
                room: msg.room,
                spec: msg.spec,
                pass: msg.pass,
                _expiration: setTimeout(function (tg, create) {
                    process.send({type: "room-expired", id: msg.room.id, create: create});
                    delete RESERVED[tg];
                }, 10000, msg.session, msg.create)
            };
            break;
        case "room-invalid":
            delete ROOM[msg.room.id];
            break;
        case "room-title":
            if (ROOM[msg.id]) {
                ROOM[msg.id].title = msg.value;
            }
            break;
        case "refresh-word":
            MainDB.refreshWordcache();
            break;
        case "refresh-shop":
            MainDB.refreshShopcache();
            break;
        case 'refresh':
            if (!DIC.hasOwnProperty(msg.id)) break;
            let $c = DIC[msg.id];
            let $r = ROOM[$c.place];
            if (!$r || $r.gaming) {
                $c.waitGame = true;
                break;
            }
            $c.refresh();
            break;
        case "reload":
            if (msg.target.indexOf("all") != -1) {
                for (let reload of reloads) reload();
                break;
            }
            for (let k of msg.target) {
                if (reloads[k]) reloads[k]();
            }
            break;
        default:
            IOLog.warn(`Unhandled IPC message type: ${msg.type}`);
    }
});
MainDB.onReady(function () {
    IOLog.notice("데이터베이스가 준비되었습니다.");
    KKuTu.init(MainDB, DIC, ROOM, GUEST_PERMISSION);
});
Server.on('connection', function (socket, req) {
    socket.upgradeReq = req;

    let chunk = socket.upgradeReq.url.slice(1).split('&')
    let key;
    // 토큰 복호화
    try {
        key = decrypt(chunk[0], CRYPTO_KEY);
    } catch (exception) {
        key = ".";
    }
    // 토큰 값 검사
    let pattern = /^[0-9a-zA-Z_-]{32}$/;
    if (!pattern.test(key)) {
        socket.close();
        return;
    }
    let reserve = RESERVED[key] || {}, room;
    let $c;

    socket.on('error', function (err) {
        IOLog.warn("Error on #" + key + " on ws: " + err.toString());
    });
    if (CHAN != Number(chunk[1])) {
        IOLog.warn(`Wrong channel value ${chunk[1]} on @${CHAN}`);
        socket.close();
        return;
    }
    if (room = reserve.room) {
        if (room._create) {
            room._id = room.id;
            delete room.id;
        }
        clearTimeout(reserve._expiration);
        delete reserve._expiration;
        delete RESERVED[key];
    } else {
        IOLog.warn(`Not reserved from ${key} on @${CHAN}`);
        socket.close();
        return;
    }
    MainDB.session.findOne(['_id', key]).limit(['profile', true]).on(function ($body) {
        $c = new KKuTu.Client(socket, $body ? $body.profile : null, key);
        $c.admin = ADMIN.indexOf($c.id) != -1;

        if (DIC[$c.id]) {
            DIC[$c.id].send('error', {code: 408});
            DIC[$c.id].socket.close();
        }
        if (DEVELOP && !TESTER.includes($c.id)) {
            $c.send('error', {code: 500});
            $c.socket.close();
            return;
        }
        $c.refresh().then(function (ref) {
            if (ref.result == 200) {
                const userName = $c.profile.title.replace(/\s/g, "");

                DIC[$c.id] = $c;
                DNAME[userName] = $c.id;

                $c.enter(room, reserve.spec, reserve.pass);
                if ($c.place == room.id) {
                    $c.publish('connRoom', {user: $c.getData()});
                } else { // 입장 실패
                    $c.socket.close();
                }

                $c.roomId = chunk[2];
                IOLog.info(`${userName}(${$c.id}) 님이 ${$c.roomId}번 방에 입장했습니다.`);
            } else {
                $c.send('error', {
                    code: ref.result, message: ref.black
                });
                $c._error = ref.result;
                $c.socket.close();
            }
        });
    });
});
Server.on('error', function (err) {
    IOLog.warn("Error on ws: " + err.toString());
});
KKuTu.onClientMessage(function ($c, msg) {
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
        case 'talk':
            if (!msg.value) return;
            if (!msg.value.substr) return;
            if (!GUEST_PERMISSION.talk) if ($c.guest) {
                $c.send('error', {code: 401});
                return;
            }
            msg.value = msg.value.substr(0, 200);
            if (msg.relay) {
                if (!checkMessagneIntegrity(msg)) process.send({type: "requestLastRelay", id: $c.id, value: msg});
                if ($c.subPlace) temp = $c.pracRoom;
                else if (!(temp = ROOM[$c.place])) return;
                if (!temp.gaming) return;
                if (temp.game.late) {
                    $c.chat(msg.value);
                } else if (!temp.game.loading) {
                    temp.submit($c, msg.value, msg.data);
                }
            } else {
                if ($c.admin) {
                    if (msg.value.charAt() == "#") {
                        process.send({type: "admin", id: $c.id, value: msg.value});
                        break;
                    }
                }
                if (msg.whisper) {
                    process.send({type: "tail-report", id: $c.id, chan: CHAN, place: $c.place, msg: msg});
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
                    $c.chat(msg.value);
                }
            }
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
                if (!$c.admin && (msg.limit < 2 || msg.limit > ($c.perks["maximumPlayers"] || 8))) {
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
                if (msg.opts.onlybeginner && (getLevel() >= 50)) {
                    msg.code = 434;
                    stable = false;
                }
                if (msg.opts.etiquette && getRatingLevel($c) < 1) {
                    msg.code = 704;
                    stable = false;
                }
                // if (ENABLE_ROUND_TIME.indexOf(msg.time) == -1) stable = false;
                if (msg.time < 10 || msg.time > 150) {
                    stable = false;
                }
            }
            if (msg.type == 'enter') {
                if (msg.id || stable) $c.enter(msg, msg.spectate);
                else $c.sendError(msg.code || 431);
            } else if (msg.type == 'setRoom') {
                if (stable) $c.setRoom(msg);
                else $c.sendError(msg.code || 431);
            }
            break;
        case 'leave':
            if (!$c.place) return;

            $c.leave();
            break;
        case 'ready':
            if (!$c.place) return;
            if (!GUEST_PERMISSION.ready) if ($c.guest) return;

            $c.toggle();
            break;
        case 'start':
            if (!$c.place) return;
            if (!ROOM[$c.place]) return;
            if (ROOM[$c.place].gaming) return;
            if (!GUEST_PERMISSION.start) if ($c.guest) return;

            $c.start();
            break;
        case 'practice':
            if (!ROOM[$c.place]) return;
            if (ROOM[$c.place].gaming) return;
            if (!GUEST_PERMISSION.practice) if ($c.guest) return;
            if (isNaN(msg.level = Number(msg.level))) return;
            if (ROOM[$c.place].rule.ai) {
                if (msg.level < 0 || msg.level >= 6) return;
            } else if (msg.level != -1) return;

            $c.practice(msg.level);
            break;
        case 'invite':
            if (!ROOM[$c.place]) return;
            if (ROOM[$c.place].gaming) return;
            if (ROOM[$c.place].master != $c.id) return;
            if (!GUEST_PERMISSION.invite) if ($c.guest) return;
            if (msg.target == "AI") {
                let level = parseInt(msg.level);
                if(isNaN(level)) level = 3;
                if(level < 0 || level >= 6) level = 3;
                ROOM[$c.place].addAI($c, level);
            } else {
                process.send({type: "invite", id: $c.id, place: $c.place, target: msg.target});
            }
            break;
        case 'inviteRes':
            if (!(temp = ROOM[msg.from])) return;
            if (!GUEST_PERMISSION.inviteRes) if ($c.guest) return;
            if (msg.res) {
                $c.enter({id: msg.from}, false, true);
            } else {
                if (DIC[temp.master]) DIC[temp.master].send('inviteNo', {target: $c.id});
            }
            break;
        case 'form':
            if (!msg.mode) return;
            if (!ROOM[$c.place]) return;
            if (ENABLE_FORM.indexOf(msg.mode) == -1) return;

            $c.setForm(msg.mode);
            break;
        case 'team':
            if (!ROOM[$c.place]) return;
            if (ROOM[$c.place].gaming) return;
            if ($c.ready) return;
            if (isNaN(temp = Number(msg.value))) return;
            if (temp < 0 || temp > 4) return;

            $c.setTeam(Math.round(temp));
            break;
        case 'kick':
            if (!msg.robot) if (!(temp = DIC[msg.target])) return;
            if (!ROOM[$c.place]) return;
            if (ROOM[$c.place].gaming) return;
            if (!msg.robot) if ($c.place != temp.place) return;
            if (ROOM[$c.place].master != $c.id) return;
            if (ROOM[$c.place].kickVote) return;
            if (!GUEST_PERMISSION.kick) if ($c.guest) return;

            if (msg.robot) $c.kick(null, msg.target);
            else $c.kick(msg.target);
            break;
        case 'kickVote':
            if (!(temp = ROOM[$c.place])) return;
            if (!temp.kickVote) return;
            if ($c.id == temp.kickVote.target) return;
            if ($c.id == temp.master) return;
            if (temp.kickVote.list.indexOf($c.id) != -1) return;
            if (!GUEST_PERMISSION.kickVote) if ($c.guest) return;

            $c.kickVote($c, msg.agree);
            break;
        case 'handover':
            if (!DIC[msg.target]) return;
            if (!(temp = ROOM[$c.place])) return;
            if (temp.gaming) return;
            if ($c.place != DIC[msg.target].place) return;
            if (temp.master != $c.id) return;

            temp.master = msg.target;
            temp.export();
            break;
        case 'wp':
            if (!msg.value) return;
            if (!GUEST_PERMISSION.wp) if ($c.guest) {
                $c.send('error', {code: 401});
                return;
            }

            msg.value = msg.value.substr(0, 200);
            msg.value = msg.value.replace(/[^a-z가-힣]/g, "");
            if (msg.value.length < 2) return;
            break;
        case 'setAI':
            if (!msg.target) return;
            if (!ROOM[$c.place]) return;
            if (ROOM[$c.place].gaming) return;
            if (ROOM[$c.place].master != $c.id) return;
            if (isNaN(msg.level = Number(msg.level))) return;
            if (msg.level < 0 || msg.level >= 6) return;
            if (isNaN(msg.team = Number(msg.team))) return;
            if (msg.team < 0 || msg.team > 4) return;

            ROOM[$c.place].setAI(msg.target, Math.round(msg.level), Math.round(msg.team));
            break;
        case 'useItem':
            if ($c.subPlace) temp = $c.pracRoom;
            else if (!(temp = ROOM[$c.place])) return;
            if (!temp.gaming) return;
            if (!temp.game.loading) {
                temp.useItem($c, msg.id);
            }
        default:
            break;
    }
});
KKuTu.onClientClosed(function ($c, code) {
    let room;
    let $r;
    delete DIC[$c.id];
    if ($c.form == "J" && ($r = ROOM[$c.roomId])) {
        if ($r.gaming && $r.game.initusers.length > 1 && !$r.opts.rankmode) {
            $c.data.record[GAME_TYPE[$r.mode]][0]++;
            $c.setFlag("escape", true, true);
            modifyUserRating($c, ratingInfo.forceExitOnGame);
            // $c.flush(); // 평점 변동 시 자동으로 flush
        }
    }
    for (let timer in $c.timers) {
        clearTimeout($c.timers[timer]);
    }
    if ($c.profile) delete DNAME[$c.profile.title || $c.profile.name];
    if ($c.socket) $c.socket.removeAllListeners();
    KKuTu.publish('disconnRoom', {id: $c.id});

    IOLog.info(`${$c.profile.title}(${$c.id}) 님이 ${$c.roomId}번 방에서 퇴장했습니다.`);
});