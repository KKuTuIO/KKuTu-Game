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

let GUEST_PERMISSION;
import * as Cluster from "cluster";
import * as Const from '../const.js';
import { Tail, all as LizardAll } from '../sub/lizard.js';
import * as IOLog from '../sub/KKuTuIOLog.js';
import { init as ACInit, canRandomized,
    randomizePacket } from '../sub/utils/AntiCheat.js';
import { resetDaily, rewardRating, ratingInfo } from '../sub/utils/UserRating.js';
import GLOBAL from "../sub/global.json" assert { type: "json" };
import kkutuLevel from "../sub/KKuTuLevel.js";
// 망할 셧다운제 import * as Ajae from "../sub/ajae.js";
let DB;
let DIC;
let ROOM;
let _rid;
let Rule;
let guestProfiles = [];
let CHAN;
let channel = process.env['CHANNEL'] || 0;

const NUM_SLAVES = 8;
const GUEST_IMAGE = "https://cdn.kkutu.io/img/kkutu/guest.png";
const MAX_OKG = 15;
const PER_OKG = 720000;

export let XPMultiplier = 1;
export let MoneyMultiplier = 1;

export let NIGHT = false;
export async function init (_DB, _DIC, _ROOM, _GUEST_PERMISSION, _CHAN) {
    let i, k;

    DB = _DB;
    DIC = _DIC;
    ROOM = _ROOM;
    GUEST_PERMISSION = _GUEST_PERMISSION;
    CHAN = _CHAN;
    _rid = 100;
    // 망할 셧다운제 if(Cluster.isMaster) setInterval(processAjae, 60000);
    Rule = {};
    
    const COMMON = await import(`./games/_common.js`);
    COMMON.init(DB, DIC);

    for (i in Const.RULE) {
        k = Const.RULE[i].rule;
        Rule[k] = await import(`./games/${k.toLowerCase()}.js`);
    }
    ACInit(DB, DIC);
}
/* 망할 셧다운제
export function processAjae (){
	let i;

	NIGHT = (new Date()).getHours() < 6;
	if(NIGHT){
		for(i in DIC){
			if(!DIC[i].isAjae){
				DIC[i].sendError(440);
				DIC[i].socket.close();
			}
		}
	}
};
*/
export function getUserList () {
    let i, res = {};

    for (i in DIC) {
        res[i] = DIC[i].getData();
    }

    return res;
}
export function getRoomList () {
    let i, res = {};

    for (i in ROOM) {
        res[i] = ROOM[i].getData();
    }

    return res;
}
export function narrate (list, type, data) {
    list.forEach(function (v) {
        if (DIC[v]) DIC[v].send(type, data);
    });
}
export function publish (type, data, _room) {
    let i;

    // 턴 종료 패킷 랜덤화
    if (type == 'turnEnd' && canRandomized(data)) {
        data = randomizePacket(data);
    }

    if (Cluster.isMaster) {
        for (i in DIC) {
            DIC[i].send(type, data);
        }
    } else if (Cluster.isWorker) {
        if (type == "room") process.send({type: "room-publish", data: data, password: _room});
        else for (i in DIC) {
            DIC[i].send(type, data);
        }
    }
}
function clientMessageHandler(){}
export function onClientMessage (callback) {
    clientMessageHandler = callback;
}
function clientCloseHandler(){}
export function onClientClosed (callback) {
    clientCloseHandler = callback;
}
export function Robot (target, place, level) {
    let my = this;

    my.id = target + place + Math.floor(Math.random() * 1000000000);
    my.robot = true;
    my.game = {};
    my.data = {};
    my.place = place;
    my.target = target;
    my.equip = {robot: true};

    my.getData = function () {
        return {
            id: my.id,
            robot: true,
            game: my.game,
            data: my.data,
            place: my.place,
            target: target,
            equip: my.equip,
            level: my.level,
            rating: ratingInfo.defaultRobotRating,
            ready: true
        };
    };
    my.setLevel = function (level) {
        my.level = level;
        my.data.score = Math.pow(10, level + 2);
    };
    my.setTeam = function (team) {
        my.game.team = team;
    };
    my.send = function () {
    };
    my.obtain = function () {
    };
    my.invokeWordPiece = function (text, coef) {
    };
    my.invokeEventPiece = function (text, coef) {
    };
    my.publish = function (type, data, noBlock) {
        let i;

        // 턴 종료 패킷 랜덤화
        if (type == 'turnEnd' && canRandomized(data)) {
            data = randomizePacket(data);
        }

        if (my.target == null) {
            for (i in DIC) {
                if (DIC[i].place == place) DIC[i].send(type, data);
            }
        } else if (DIC[my.target]) {
            DIC[my.target].send(type, data);
        }
    };
    my.chat = function (msg, code) {
        my.publish('chat', {value: msg});
    };
    my.setLevel(level);
    my.setTeam(0);
}
export function Data (data) {
    let i, j;

    if (!data) data = {};

    this.score = data.score || 0;
    this.playTime = data.playTime || 0;
    this.connectDate = data.connectDate || 0;
    this.record = {};
    for (i in Const.GAME_TYPE) {
        this.record[j = Const.GAME_TYPE[i]] = data.record ? (data.record[Const.GAME_TYPE[i]] || [0, 0, 0, 0]) : [0, 0, 0, 0];
        if (!this.record[j][3]) this.record[j][3] = 0;
    }
    // 전, 승, 점수
}
export function WebServer (socket) {
    let my = this;

    my.socket = socket;

    my.send = function (type, data) {
        let i, r = data || {};

        r.type = type;

        if (socket.readyState == 1) socket.send(JSON.stringify(r));
    };
    my.onWebServerMessage = function (msg) {
        IOLog.info(`웹서버에서 메시지가 전달되었습니다. : ${msg}`)
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            IOLog.error(`웹서버 메시지 파싱에 실패했습니다. : ${e}`);
            return;
        }

        switch (msg.type) {
            case 'seek':
                my.send('seek', {value: Object.keys(DIC).length});
                break;
            case 'narrate-friend':
                narrate(msg.list, 'friend', {id: msg.id, s: msg.s, stat: msg.stat});
                break;
            case 'kick':
                const userId = msg.hasOwnProperty('userId') ? msg.userId : '';
                const ip = msg.hasOwnProperty('ip') ? msg.ip : '';

                if (userId.length > 0) {
                    IOLog.notice(`${userId} 아이디의 유저를 추방합니다.`)

                    if (DIC.hasOwnProperty(userId)) {
                        const player = DIC[userId];
                        player.sendError(410);
                        player.socket.close();

                        IOLog.notice(`${player.profile.title}(${player.id}) 유저를 추방했습니다.`)
                    }
                } else if (ip.length > 0) {
                    IOLog.notice(`${ip} 아이피의 유저를 추방합니다.`)
                    for (let userId in DIC) {
                        if (!DIC.hasOwnProperty(userId)) continue;
                        const player = DIC[userId];
                        const playerIp = player.socket._socket.remoteAddress.slice(7);

                        if (playerIp === ip) {
                            player.sendError(410);
                            player.socket.close();

                            IOLog.notice(`${player.profile.title}(${player.id}) 유저를 추방했습니다.`)
                        }
                    }
                }
                break;
            case 'yell':
                if (!msg.hasOwnProperty('value')) {
                    IOLog.warn('API가 호출되었지만, 공지 내용이 전달되지 않았습니다. 공지를 전송하지 않습니다.');
                    break;
                }
                IOLog.notice(`API를 통해 공지가 전송되었습니다. 내용 : ${msg.value}`)
                for (let i in DIC) {
                    DIC[i].send('yell', {value: msg.value});
                }
                break;
            default:
                IOLog.warn(`웹서버에서 전송된 메시지를 처리 할 수 없습니다. : ${msg.type}`);
                break;
        }
    };
    socket.on('message', my.onWebServerMessage);
}
export function Client (socket, profile, sid) {
    let my = this;
    let gp, okg;

    if (profile) {
        my.id = profile.id;
        my.profile = profile;
        /* 망할 셧다운제
        if(Cluster.isMaster){
            my.isAjae = Ajae.checkAjae(profile.birth, profile._age);
        }else{
            my.isAjae = true;
        }
        my._birth = profile.birth;
        my._age = profile._age;
        delete my.profile.birth;
        delete my.profile._age;
        */
        delete my.profile.sid;
        delete my.profile.token;

        if (my.profile.title) my.profile.name = "anonymous";
    } else {
        gp = guestProfiles[Math.floor(Math.random() * guestProfiles.length)];

        my.id = "guest__" + sid;
        my.guest = true;
        my.isAjae = false;
        my.profile = {
            id: sid,
            title: getGuestName(sid),
            image: GUEST_IMAGE
        };
    }
    my.socket = socket;
    my.place = 0;
    my.team = 0;
    my.ready = false;
    my.game = {};

    my.subPlace = 0;
    my.error = false;
    my.blocked = false;
    my.blockedChat = false;
    my.spam = 0;
    my.spamChat = 0;
    my.ackFailed = 0;
    my.ackCount = 0;
    my.ackWaiting = false;
    my.acInited = false;
    my.lastAC = 0;
    my.acStoredData = [];
    my.timers = {};
    my._pub = new Date();
    my._pubChat = new Date();

    if (Cluster.isMaster) {
        my.onOKG = function (time) {
            // ?? 이럴 일이 없어야 한다.
        };
    } else {
        my.onOKG = function (time) {
            let d = (new Date()).getDate();

            if (my.guest) return;
            if (d != my.data.connectDate) {
                my.data.connectDate = d;
                my.data.playTime = 0;
                my.okgCount = 0;
                resetDaily(my);
            }
            my.data.playTime += time;

            while (my.data.playTime >= PER_OKG * (my.okgCount + 1)) {
                if (my.okgCount >= MAX_OKG) return;
                my.okgCount++;
            }
            my.send('okg', {time: my.data.playTime, count: my.okgCount});
            // process.send({ type: 'okg', id: my.id, time: time });
        };
    }
    socket.on('close', function (code) {
        if (ROOM[my.place]) ROOM[my.place].go(my);
        if (my.subPlace) my.pracRoom.go(my);
        clientCloseHandler(my, code);
    });
    socket.on('message', function (msg) {
        let data, room = ROOM[my.place];
        if (!my) return;
        if (!msg) return;

        try {
            data = JSON.parse(msg);
        } catch (e) {
            data = {error: 400};
        }

        if (!data.hasOwnProperty('type') || data.type !== 'polygama') {
            const roomText = room ? my.place : '로비';
            IOLog.info(`[` + socket.upgradeReq.connection.remoteAddress.slice(7) + `] ` + `Room @${roomText} Msg #${my.id}: ${msg}`);
        }

        if (Cluster.isWorker) process.send({
            type: "tail-report",
            id: my.id,
            chan: channel,
            place: my.place,
            msg: data.error ? msg : data
        });

        clientMessageHandler(my, data);
    });
    /* 망할 셧다운제
    my.confirmAjae = function(input){
        if(Ajae.confirmAjae(input, my._birth, my._age)){
            DB.users.update([ '_id', my.id ]).set([ 'birthday', input.join('-') ]).on(function(){
                my.sendError(445);
            });
        }else{
            DB.users.update([ '_id', my.id ]).set([ 'black', `[${input.join('-')}] 생년월일이 올바르게 입력되지 않았습니다. 잠시 후 다시 시도해 주세요.` ]).on(function(){
                my.socket.close();
            });
        }
    };
    */
    my.getData = function (gaming) {
        let o = {
            id: my.id,
            guest: my.guest,
            game: {
                ready: my.ready,
                form: my.form,
                team: my.team,
                practice: my.subPlace,
                score: my.game.score,
                item: my.game.item
            }
        };
        if (!gaming) {
            o.profile = my.profile;
            o.place = my.place;
            o.data = my.data;
            o.money = my.money;
            o.equip = my.equip;
            o.exordial = my.exordial;
            o.rating = my.getFlag("rating") || 90;
        }
        return o;
    };
    my.send = function (type, data) {
        let i, r = data || {};

        r.type = type;

        if (socket.readyState == 1) socket.send(JSON.stringify(r));
    };
    my.sendError = function (code, msg) {
        my.send('error', {code: code, message: msg});
    };
    my.publish = function (type, data, noBlock) {
        let i;
        let now = new Date();
        let $room = ROOM[my.place];

        // 턴 종료 패킷 랜덤화
        if (type == 'turnEnd' && canRandomized(data)) {
            data = randomizePacket(data);
        }

        // 채팅 도배 차단
        if (type == 'chat' && !my.subPlace && (!$room || !$room.gaming || $room.game.seq.indexOf(my.id) == -1)) {
            let stChat = now - my._pubChat;
            if (stChat <= Const.CHAT_SPAM_ADD_DELAY) my.spamChat++;
            else if (stChat >= Const.CHAT_SPAM_CLEAR_DELAY) my.spamChat = 0;
            if (my.spamChat >= Const.CHAT_SPAM_LIMIT) {
                if (!my.blockedChat) my.numSpamChat = 0;
                my.blockedChat = true;
            }
            if (!noBlock) {
                my._pubChat = now;
                if (my.blockedChat) {
                    if (stChat < Const.CHAT_BLOCKED_LENGTH) {
                        if (++my.numSpamChat >= Const.CHAT_KICK_BY_SPAM) {
                            if (Cluster.isWorker) process.send({type: "kick", target: my.id});
                            return my.socket.close();
                        }
                        return my.send('blocked');
                    } else my.blockedChat = false;
                }
            }
            // 패킷 도배 차단
        } else {
            let st = now - my._pub;
            if (st <= Const.SPAM_ADD_DELAY) my.spam++;
            else if (st >= Const.SPAM_CLEAR_DELAY) my.spam = 0;
            if (my.spam >= Const.SPAM_LIMIT) {
                if (!my.blocked) my.numSpam = 0;
                my.blocked = true;
            }
            if (!noBlock) {
                my._pub = now;
                if (my.blocked) {
                    if (st < Const.BLOCKED_LENGTH) {
                        if (++my.numSpam >= Const.KICK_BY_SPAM) {
                            if (Cluster.isWorker) process.send({type: "kick", target: my.id});
                            return my.socket.close();
                        }
                        return my.send('blocked');
                    } else my.blocked = false;
                }
            }
        }
        data.profile = my.profile;
        if (my.subPlace && type != 'chat') my.send(type, data);
        else for (i in DIC) {
            if (DIC[i].place == my.place) DIC[i].send(type, data);
        }
        if (Cluster.isWorker && type == 'user') process.send({type: "user-publish", data: data});
    };
    my.chat = function (msg, code) {
        if (my.noChat) {
            my.send('chat', {
                notice: true,
                code: 443
            });
            return;
        }

        if (my.dbBlockedChat !== undefined) {
            my.send('chat', {
                notice: true,
                message: makeBlockChatMessage(my.dbBlockedChat)
            });
            return;
        }

        if (my.guest) return my.send('chat', {notice: true, code: 401});
        my.publish('chat', {value: msg, notice: !!code, code: code});

        function getInquireId(caseId) {
            const date = new Date();
            return `BLK-CHAT-${caseId}-${date.getMonth() + 1}.${date.getDate()}.${date.getHours()}.${date.getMinutes()}`;
        }

        function isPardon(pardonTime) {
            return new Date(pardonTime).getTime() < new Date().getTime();
        }

        function formatTime(time) {
            const timezoneOffset = new Date().getTimezoneOffset() * 60000;
            const timezoneTime = new Date(time - timezoneOffset);

            return timezoneTime.toISOString().replace(/T/, ' ').replace(/\..+/, '');
        }

        function makeBlockChatMessage(block) {
            if (isPardon(block.pardonTime)) {
                return '페이지를 새로 고침하면 채팅을 다시 이용하실 수 있습니다.';
            }

            let message = '운영정책 위반으로 채팅 이용이 ' + (block.permanency ? '영구적으로' : '일정 기간') + ' 제한되었습니다.<br/>' +
                '<br/>' +
                '제한 일시: ' + formatTime(block.time) + '<br/>';

            if (!block.permanency) {
                message += '해제 일시: ' + formatTime(block.pardonTime) + '<br/>';
            }

            message += '제한 사유: ' + block.reason + '<br/>' +
                '<br/>' +
                '본 조치에 대한 문의가 있으실 경우 <a href="https://support.kkutu.io/plugin/support_manager/knowledgebase/view/1" target="_blank"><u>끄투리오 고객센터</u></a>로 문의해주시기 바랍니다. ' +
                '이용제한 기간 중 다른 계정을 이용하여 게임을 플레이할 경우 이용제한 기간이 연장될 수 있습니다.<br/>' +
                '문의 시 사용자 식별을 위하여 <b>' + getInquireId(block.id) + '</b> 문구와 함께 자세한 문의 내용을 작성해주시기 바랍니다.';

            return message;
        }
    };
    my.checkExpire = function () {
        if(my.place !== 0) return;

        let now = new Date();
        let d = now.getDate();
        let i, expired = [];
        let gr, item;
        let needFlush = false;

        now = now.getTime() * 0.001;
        if (d != my.data.connectDate) {
            my.data.connectDate = d;
            my.data.playTime = 0;
            my.okgCount = 0;
            resetDaily(my);
            needFlush = true;
        }
        for (i in my.box) {
            item = my.box[i]
            if (Number.isInteger(item)) {
                item = my.box[i] = {value: my.box[i]};
                needFlush = true;
            }
            if (item.expire == 2147483647) {
                delete my.box[i].expire;
                needFlush = true;
            }

            if (!item.value && !item.expire) {
                delete my.box[i];
                continue;
            }
            if (!item.expire) continue;
            if (item.expire < now) {
                if (DB.shop.hasOwnProperty(i)){
                    gr = DB.shop[i].group;
    
                    if (gr.substr(0, 3) == "BDG") gr = "BDG";
                    if (gr == "Mhand") {
                        if (my.equip.Mlhand == i) delete my.equip.Mlhand;
                        if (my.equip.Mrhand == i) delete my.equip.Mrhand;
                    } else if (my.equip[gr] == i) delete my.equip[gr];
                }
                delete my.box[i];
                expired.push(i);
            }
        }
        needFlush = needFlush || expired.length;
        if (!my.getFlag("equipMigrate")) my.migrateEquips();
        if (expired.length) my.send('expired', {list: expired});
        if (needFlush) my.flush(my.box, my.equip);
    };
    my.getLevel = () => {
        return kkutuLevel(my)
    };
    my.refresh = function () {
        let R = new Tail();
        let playerIp;

        try {
            playerIp = my.socket._socket.remoteAddress.slice(7);

            DB.UserBlockModule.checkBlockIp(playerIp, function (ipBlockResult) {
                if ((ipBlockResult.onlyGuestPunish && (my.guest && ipBlockResult.block)) || (!ipBlockResult.onlyGuestPunish && ipBlockResult.block)) {
                    my.sendError(444, ipBlockResult.reason);
                    my.socket.close();
                }
                
                if (my.guest) {
                    my.equip = {};
                    my.data = new Data();
                    my.money = 0;
                    my.friends = {};

                    R.go({
                        result: 200
                    });
                } else {
                    DB.VendorDBMigration.processVendorMigration(my.id, function () {
                        DB.users.findOne(['_id', my.id]).on(function ($user) {
                            let first = !$user;
                            let black = first ? "" : $user.black;

                            if (first) {
                                $user = GLOBAL.IS_TEST_SERVER ? {money: 2500} : {money: 0};
                            }
                            if (black === "null" || black === "") {
                                black = false;
                            }
                            if (black === "chat") {
                                black = false;
                                my.noChat = true;
                            }

                            /* 망할 셧다운제
                            if(Cluster.isMaster && !my.isAjae){ // null일 수는 없다.
                                my.isAjae = Ajae.checkAjae(($user.birthday || "").split('-'));
                                if(my.isAjae === null){
                                    if(my._birth) my._checkAjae = setTimeout(function(){
                                        my.sendError(442);
                                        my.socket.close();
                                    }, 300000);
                                    else{
                                        my.sendError(441);
                                        my.socket.close();
                                        return;
                                    }
                                }
                            }*/

                            my.exordial = $user.exordial || "";
                            my.equip = $user.equip || {};
                            my.box = $user.box || {};
                            my.data = new Data($user.kkutu);
                            my.money = Number($user.money);
                            my.friends = $user.friends || {};
                            my.flags = $user.flags || {};

                            if (first) {
                                my.setFlag("flagSystem", 2);
                                my.setFlag("equipMigrate", 3);
                                my.flush(false, false, false, true);
                            } else {
                                if (!my.getFlag("flagSystem")) my.migrateFlags();
                                my.checkExpire();
                                my.okgCount = Math.floor((my.data.playTime || 0) / PER_OKG);
                                if (my.okgCount > MAX_OKG) my.okgCount = MAX_OKG;
                            }

                            if (black) {
                                R.go({
                                    result: black ? 444 : 443,
                                    black: black
                                });
                            } else {
                                /* else if (Cluster.isMaster && $user.server) {
                                        R.go({
                                            result: 409,
                                            black: $user.server
                                        });
                                    }*/
                                if (NIGHT && my.isAjae === false) {
                                    R.go({
                                        result: 440
                                    });
                                } else {
                                    DB.UserBlockModule.checkBlockUser(my.id, function (userBlockResult) {
                                        if (userBlockResult.block) {
                                            my.sendError(userBlockResult.reason ? 444 : 443, userBlockResult.reason);
                                            my.socket.close();
                                            return;
                                        }

                                        DB.UserBlockModule.checkBlockChat(my.id, function (chatBlockResult) {
                                            if (chatBlockResult.block) {
                                                my.dbBlockedChat = chatBlockResult;
                                            }

                                            R.go({
                                                result: 200
                                            });
                                        });
                                    });
                                }
                            }
                        });
                    });
                }
            });
        } catch (e) {
            my.sendError(456);
            my.socket.close();
        }

        return R;
    };
    my.flush = function (box, equip, friends, flags, retryCount) {
        let R = new Tail();
        if (retryCount === undefined) retryCount = 0;
        if (my.guest) {
            R.go({id: my.id, prev: 0});
            return R;
        }

        DB.users.findOne(['_id', my.id]).on(function (currentUser) {
            if (!currentUser) {
                if (retryCount >= 5) {
                    IOLog.warn(`${my.id}님의 현재 정보를 불러오는데 실패하였습니다. 데이터 손실 방지를 위해 작업을 취소합니다.`);
                    return;
                } else {
                    IOLog.warn(`${my.id}님의 현재 정보를 불러오는데 실패하였습니다. 저장을 다시 시도합니다. 현재 재시도 횟수 : ${retryCount}`);
                    return my.flush(box, equip, friends, flags, retryCount+1);
                }
            } else {
                IOLog.debug(`${my.id}님의 현재 정보를 불러왔습니다.`);
            }
            if (isNaN(my.money) || !my.data || isNaN(my.data.score)) {
                IOLog.warn(`${my.id}님의 현재 정보에 문제가 있는것 같습니다. 데이터 손실 방지를 위해 작업을 취소합니다.`);
                return;
            }
            DB.users.upsert(['_id', my.id]).set(
                !isNaN(my.money) ? ['money', my.money] : undefined,
                (my.data && !isNaN(my.data.score)) ? ['kkutu', my.data] : undefined,
                box ? ['box', my.box] : undefined,
                equip ? ['equip', my.equip] : undefined,
                friends ? ['friends', my.friends] : undefined,
                flags ? ['flags', my.flags] : undefined,
            ).on(function (__res) {
                DB.redis.getGlobal(my.id).then(function (_res) {
                    DB.redis.putGlobal(my.id, my.data.score).then(function (res) {
                        DB.users.findOne(['_id', my.id]).on(function (resultUser) {
                            if (!resultUser) {
                                if (retryCount >= 3) {
                                    IOLog.warn(`${my.id}님의 새로운 정보를 불러오는데 실패하였습니다. 데이터 손실 방지를 위해 작업을 취소합니다.`);
                                } else {
                                    IOLog.warn(`${my.id}님의 새로운 정보를 불러오는데 실패하였습니다. 저장을 다시 시도합니다. 현재 재시도 횟수 : ${retryCount}`);
                                    return my.flush(box, equip, friends, flags, retryCount+1);
                                }
                            } else {
                                IOLog.notice(`${resultUser.nickname}(${my.id}) 님의 데이터를 저장했습니다. ${currentUser.kkutu.score} -> ${my.data.score} EXP / ${currentUser.money} -> ${my.money} 핑 (차이| ${my.data.score - currentUser.kkutu.score} EXP / ${my.money - currentUser.money}핑)`);
                                R.go({id: my.id, prev: _res});
                            }
                        });
                    });
                });
            });
        });

        return R;
    };
    my.invokeWordPiece = function (text, coef) {
        if (!my.game.wpc) return;
        let v;

        if (Math.random() <= 0.04 * coef) {
            v = text.charAt(Math.floor(Math.random() * text.length));
            if (!v.match(/[a-z가-힣]/)) return;
            my.game.wpc.push(v);
        }
    };
    my.invokeEventPiece = function (text, coef) {
        if (!my.game.wpe) return;
        let v;

        if (Math.random() <= Const.EVENT_WP_DROP_RATE * coef) {
            v = text.charAt(Math.floor(Math.random() * text.length));
            if (!v.match(/[a-z가-힣]/)) return;
            my.game.wpe.push(v);
        }
    };
    my.equipItem = function (item, slot) {
        if (Const.EQUIP_SLOTS.indexOf(slot) == -1) return my.sendError(400); // 없는 슬롯에 장착 시도
        if (Const.EQUIP_GROUP[slot].indexOf(item.group) == -1) return my.sendError(400); // 잘못된 슬롯에 장착 시도

        if (my.equip.hasOwnProperty(slot) && my.equip[slot] == item._id) {
            // 이미 그 슬롯에 장착중임 = 해제 요청
            delete my.equip[slot];
        } else {
            let checkAlt; // 두 슬롯에 장착 가능한 아이템일 때 추가로 검사할 슬롯
            if (slot == "Mlhand") checkAlt = "Mrhand";
            else if (slot == "Mrhand") checkAlt = "Mlhand";

            let reqAmount = 1;
            if (checkAlt !== undefined && my.equip.hasOwnProperty(checkAlt) &&
                my.equip[checkAlt] == item._id) reqAmount = 2;

            if (my.box[item._id].value < reqAmount) return my.sendError(439);
            my.equip[slot] = item._id;
        }

        my.send('obtain', {
            equip: my.equip
        });
        my.flush(my.box, my.equip);
    };
    my.consume = function (item, count) {
        if (!item.options.hasOwnProperty("gives")) return my.sendError(556);
        if (!my.box.hasOwnProperty(item._id) || my.box[item._id].value < count) return my.sendError(434);
        if (!count || count < 1) count = 1;
        my.box[item._id].value -= count;
        if (my.box[item._id].value < 1) delete my.box[item._id];

        let money = 0;
        let exp = 0;

        function addResult (id, value) {
            if (id == "money") {
                my.money += value;
                money += value;
            } else if (id == "exp") {
                my.data.score += value;
                exp += value;
            }
            else my.obtain(id, {q: value.q, x: value.x, mx: value.mx});
            // 아이템은 obtain 함수에서 준 것으로 처리한다
        }

        for (let curr of item.options.gives) {
            let res = {};
            let i, r = (curr.roll || 1) * count;

            if (curr.type == "money" || curr.type == "exp") {
                if (curr.from == "fix") addResult(curr.type, curr.value)
                else {
                    let base = (curr.type == "money" ? my.money : my.data.score);
                    if (curr.from == "per") {
                        addResult(curr.type, base * curr.per);
                    } else if (curr.from == "dict") {
                        while (r-- > 0) {
                            let base = (curr.type == "money" ? my.money : my.data.score);
                            addResult(curr.type, Math.round(Math.sqrt(4 + 3.6 * base) / 2));
                        }
                    }
                }
                continue;
            }

            // 아이템 처리 시작
            res.q = curr.value || 1;
            if (curr.expire) {
                // 여러개 소지 가능한 기간제, 만료일로 설정됨
                if (curr.xmul) res.x = curr.expire;
                else {
                    // 한개만 소지 가능한 기간제, 유지 기간으로 설정됨
                    let now = Math.floor((new Date()).getTime() / 1000);
                    res.x = curr.expire + now;
                }
                res.mx = curr.xmul;
            }

            if (curr.from == "all") for (let id of curr.pool) addResult(id, res)
            else if (curr.from == "full") {
                // full random
                while (r-- > 0) {
                    i = curr.pool[Math.floor(Math.random() * curr.pool.length)];
                    addResult(i, res);
                }
            }
            else if (curr.from == "wei") {
                // weighted random
                let randPool = [];
                for (i in curr.pool) randPool.push(...Array(curr.pool[i]).fill(i));
                while (r-- > 0) {
                    i = randPool[Math.floor(Math.random() * randPool.length)];
                    addResult(i, res);
                }
            } else if (curr.from == "abs") {
                // absolute random
                while (r-- > 0) {
                    for (i in curr.pool) {
                        if (Math.random() < curr.pool[i]) addResult(i, res);
                    }
                }
            } else if (curr.from == "rel") {
                // relational random
                let remainChance = 1;
                let randPool = {};
                for (i in curr.pool) {
                    randPool[i] = remainChance;
                    remainChance -= curr.pool[i];
                }
                while (r-- > 0) {
                    let v = Math.random();
                    let n = 1.1; // 1.1이 남을 수는 없지만, failsafe.
                    if (v < remainChance) continue;
                    let id;
                    for (i in randPool) {
                        if (randPool[i] > n) continue;
                        if (v < randPool[i]) {
                            id = i;
                            n = randPool[i];
                        }
                    }
                    if (id) addResult(id, res);
                }
            }
        }

        my.send('obtain', {
            money: money,
            exp: exp,
            box: my.box,
            data: my.data
        });
        my.flush(my.box, my.equip);
    };
    my.migrateEquips = function () {
        if (my.getFlag("equipMigrate")) return my.sendError(400);
        my.setFlag("equipMigrate", 2);
        for (let i in my.equip) {
            let k = my.equip[i];
            delete my.equip[i];
            if (!my.box.hasOwnProperty(k)) my.box[k] = {value: 0};
            my.box[k].value += 1;
        }
        my.send('obtain', {
            box: my.box,
            equip: my.equip
        });
        my.send('alert', {
            value: "시스템 업데이트로 인해 착용 중이던 아이템이 모두 장착 해제되었습니다.<br>아이템 개수 또는 항목에 문제가 있다면 <a href='https://support.kkutu.io' target='_blank'><u>끄투리오 고객센터</u></a>를 통해 문의해주세요.",
            isOverlayEnabled: true
        });
        my.flush(true, true, false, true);
    };
    my.migrateFlags = function () {
        if (my.getFlag("flagSystem")) return my.sendError(400);
        my.setFlag("flagSystem", 1);
        for (let i in my.box) {
            if (i.charAt() != "#") continue;
            my.setFlag(i.slice(1), my.box[i].value);
            delete my.box[i];
        }
        my.flush(true, false, false, true);
    };
    my.hasFlag = function (name) {
        if (!my.flags) return false;
        return my.flags.hasOwnProperty(name);
    };
    my.getFlag = function (name) {
        if (!my.flags) return false;
        return my.flags.hasOwnProperty(name) ? my.flags[name].value : false;
    };
    my.setFlag = function (name, value, recordtime) {
        if (!my.flags) return false;
        if (!my.flags.hasOwnProperty(name)) my.flags[name] = {};
        let f = my.flags[name];
        f.value = value;
        if (recordtime) f.time = Math.floor(new Date().getTime() / 1000);
        IOLog.info(`${my.id} 님의 플래그가 설정되었습니다. ${name} = ${f.value}`);
        return f.value;
    };
    my.removeFlag = function (name) {
        if (!my.flags) return false;
        if (!my.flags.hasOwnProperty(name)) return true;
        return (delete my.flags[name]);
    }
    my.getFlagTime = function (name) {
        if (!my.flags) return 0;
        if (!my.flags.hasOwnProperty(name)) return 0;
        let time = my.flags[name].time;
        if (!time) return 0;
        else return new Date(time * 1000);
    };
    my.enter = function (room, spec, pass) {
        let $room, i;

        if (my.place) {
            my.send('roomStuck');
            IOLog.warn(`Enter the room ${room.id} in the place ${my.place} by ${my.id}!`);
            return;
        } else if (room.id) {
            // 이미 있는 방에 들어가기... 여기서 유효성을 검사한다.
            $room = ROOM[room.id];

            if (!$room) {
                if (Cluster.isMaster) {
                    for (i in CHAN) CHAN[i].send({type: "room-invalid", room: room});
                } else {
                    process.send({type: "room-invalid", room: room});
                }
                return my.sendError(466, room.id);
            }
            if ($room.opts.onlybeginner && (my.getLevel() >= 50 || my.guest) && !my.admin) {
                if (my.guest) return my.sendError(700);
                else return my.sendError(702);
            }
            if (!spec) {
                if ($room.gaming) return my.send('error', {code: 416, target: $room.id});
                else if (!GUEST_PERMISSION.enter) return my.sendError(401);
            }
            if ($room.opts.noguest && my.guest) return my.sendError(701);
            if ($room.players.length >= $room.limit + (spec && $room.gaming ? Const.MAX_OBSERVER : 0)) {
                return my.sendError(429);
            }
            if ($room.players.indexOf(my.id) != -1) {
                return my.sendError(409);
            }
            if (Cluster.isMaster) {
                my.send('preRoom', {id: $room.id, pw: room.password, channel: $room.channel});
                CHAN[$room.channel].send({type: "room-reserve", session: sid, room: room, spec: spec, pass: pass});

                $room = undefined;
            } else {
                if (!pass && $room) {
                    if ($room.kicked.indexOf(my.id) != -1) {
                        return my.sendError(406);
                    }
                    if ($room.password != room.password && $room.password) {
                        $room = undefined;
                        return my.sendError(403);
                    }
                }
            }
        } else if (my.guest && !GUEST_PERMISSION.enter) {
            my.sendError(401);
        } else {
            // 새 방 만들어 들어가기
            /*
                1. 마스터가 ID와 채널을 클라이언트로 보낸다.
                2. 클라이언트가 그 채널 일꾼으로 접속한다.
                3. 일꾼이 만든다.
                4. 일꾼이 만들었다고 마스터에게 알린다.
                5. 마스터가 방 정보를 반영한다.
            */
            if (Cluster.isMaster) {
                let av = getFreeChannel();

                room.id = _rid;
                room._create = true;
                my.send('preRoom', {id: _rid, channel: av});
                CHAN[av].send({type: "room-reserve", create: true, session: sid, room: room});

                do {
                    if (++_rid > 999) _rid = 100;
                } while (ROOM[_rid]);
            } else {
                if (room._id) {
                    room.id = room._id;
                    delete room._id;
                }
                if (my.place != 0) {
                    my.sendError(409);
                }
                $room = new Room(room, getFreeChannel());

                if ($room.opts.onlybeginner && (my.getLevel() >= 50 || my.guest) && !my.admin) {
                    if (my.guest) return my.sendError(700);
                    else return my.sendError(702);
                }

                if ($room.opts.noguest && my.guest) return my.sendError(701);

                process.send({type: "room-new", target: my.id, room: $room.getData()});
                ROOM[$room.id] = $room;
                spec = false;
            }
        }
        if ($room) {
            if (spec) $room.spectate(my, room.password);
            else $room.come(my, room.password, pass);
        }
    };
    my.leave = function (kickVote) {
        let $room = ROOM[my.place];

        if (my.subPlace) {
            my.pracRoom.go(my);
            if ($room) my.send('room', {target: my.id, room: $room.getData()});
            my.publish('user', my.getData());
            if (!kickVote) return;
        }
        if ($room) $room.go(my, kickVote);
    };
    my.setForm = function (mode) {
        let $room = ROOM[my.place];

        if (!$room) return;

        my.form = mode;
        my.ready = false;
        my.publish('user', my.getData());
    };
    my.setTeam = function (team) {
        my.team = team;
        my.publish('user', my.getData());
    };
    my.kick = function (target, kickVote) {
        let $room = ROOM[my.place];
        let i, $c;
        let len = $room.players.length;

        if (target == null) { // 로봇 (이 경우 kickVote는 로봇의 식별자)
            $room.removeAI(kickVote);
            return;
        }
        for (i in $room.players) {
            if ($room.players[i].robot) len--;
        }
        if (len < 4) kickVote = {target: target, Y: 1, N: 0};
        if (kickVote) {
            $room.kicked.push(target);
            $room.kickVote = null;
            if (DIC[target]) DIC[target].leave(kickVote);
        } else {
            $room.kickVote = {target: target, Y: 1, N: 0, list: []};
            for (i in $room.players) {
                $c = DIC[$room.players[i]];
                if (!$c) continue;
                if ($c.id == $room.master) continue;

                $c.timers.kick = setTimeout($c.kickVote, 10000, $c, true);
            }
            my.publish('kickVote', $room.kickVote, true);
        }
    };
    my.kickVote = function (client, agree) {
        let $room = ROOM[client.place];
        let $m;

        if (!$room) return;

        $m = DIC[$room.master];
        if ($room.kickVote) {
            $room.kickVote[agree ? 'Y' : 'N']++;
            if ($room.kickVote.list.push(client.id) >= $room.players.length - 2) {
                if ($room.gaming) return;

                if ($room.kickVote.Y >= $room.kickVote.N) $m.kick($room.kickVote.target, $room.kickVote);
                else $m.publish('kickDeny', {
                    target: $room.kickVote.target,
                    Y: $room.kickVote.Y,
                    N: $room.kickVote.N
                }, true);

                $room.kickVote = null;
            }
        }
        clearTimeout(client.timers.kick);
        delete client.timers.kick;
    };
    my.toggle = function () {
        let $room = ROOM[my.place];

        if (!$room) return;
        if ($room.master == my.id) return;
        if (my.form != "J") return;

        my.ready = !my.ready;
        my.publish('user', my.getData());
    };
    my.start = function () {
        let $room = ROOM[my.place];

        if (!$room) return;
        if ($room.master != my.id) return;
        if ($room.players.length < 2) return my.sendError(411);

        $room.ready();
    };
    my.practice = function (level) {
        let $room = ROOM[my.place];
        let ud;
        let pr;

        if (!$room) return;
        if (my.subPlace) return;
        if (my.form != "J") return;

        my.team = 0;
        my.ready = false;
        ud = my.getData();
        my.pracRoom = new Room($room.getData());
        my.pracRoom.id = $room.id + 1000;
        ud.game.practice = my.pracRoom.id;
        if (pr = $room.preReady()) return my.sendError(pr);
        my.publish('user', ud);
        my.pracRoom.time /= my.pracRoom.rule.time;
        my.pracRoom.limit = 1;
        my.pracRoom.password = "";
        my.pracRoom.practice = true;
        my.subPlace = my.pracRoom.id;
        my.pracRoom.come(my);
        my.pracRoom.start(level);
        my.pracRoom.game.hum = 1;
    };
    my.setRoom = function (room) {
        let $room = ROOM[my.place];

        if ($room) {
            if (!$room.gaming) {
                if ($room.master == my.id) {
                    $room.set(room);
                    publish('room', {target: my.id, room: $room.getData(), modify: true}, room.password);
                } else {
                    my.sendError(400);
                }
            }
        } else {
            my.sendError(400);
        }
    };
    my.applyEquipOptions = function (rw) {
        let $obj;
        let i, j;
        let pm = rw.playTime / 60000;

        rw._score = Math.round(rw.score);
        rw._money = Math.round(rw.money);
        rw._blog = [];
        my.checkExpire();
        for (i in my.equip) {
            $obj = DB.shop[my.equip[i]];
            if (!$obj) continue;
            if (!$obj.options) continue;
            for (j in $obj.options) {
                if (j == "gEXP") rw.score += rw._score * $obj.options[j];
                else if (j == "hEXP") rw.score += $obj.options[j] * pm;
                else if (j == "gMNY") rw.money += rw._money * $obj.options[j];
                else if (j == "hMNY") rw.money += $obj.options[j] * pm;
                else continue;
                rw._blog.push("q" + j + $obj.options[j]);
            }
        }
        if (rw.together && my.okgCount > 0) {
            i = 0.05 * my.okgCount;
            j = 0.05 * my.okgCount;

            rw.score += rw._score * i;
            rw.money += rw._money * j;
            rw._blog.push("kgEXP" + i);
            rw._blog.push("kgMNY" + j);
        }
        rw.score = Math.round(rw.score);
        rw.money = Math.round(rw.money);
    };
    my.obtain = function (k, {q, x, mx}) {
        if (my.guest) return;
        let data = {};
        // 기존 아이템의 구조 변경
        if (my.box[k] && Number.isInteger(my.box[k])) my.box[k] = {value: my.box[k]};
        if (my.box[k]) data = my.box[k];
        else data = {value: 0}

        if (x) {
            // 기간제 아이템 처리
            if (data.expire) {
                // 이미 기간제 소지중
                if (mx) {
                    // 기간제 아이템 중 같은 아이템을 여러개 소지 가능한 경우
                    data.value += q;
                    data.expire = x;
                } else data.expire += (x - Math.floor((new Date()).getTime() / 1000)) // 기간 증가
                // ^ 1개만 소지 가능한 경우

            } else if (data.value) {
                // 이미 영구 소지중 - 처리 없음
                return;

            } else {
                // 소지하고 있지 않음
                data.value = q;
                data.expire = x;
            }
        } else {
            // 영구 아이템 처리
            data.value += q
        }

        my.box[k] = data;

        my.send('obtain', {gain: [{key: k, q: q}], noref: true});
        // if (flush) my.flush(true);
    };
    my.addFriend = function (id) {
        let fd = DIC[id];

        if (!fd) return;
        my.friends[id] = fd.profile.title || fd.profile.name;
        my.flush(false, false, true);
        my.send('friendEdit', {friends: my.friends});
    };
    my.removeFriend = function (id) {
        DB.users.findOne(['_id', id]).limit(['friends', true]).on(function ($doc) {
            if (!$doc) return;

            let f = $doc.friends;

            delete f[my.id];
            DB.users.update(['_id', id]).set(['friends', f]).on();
        });
        delete my.friends[id];
        my.flush(false, false, true);
        my.send('friendEdit', {friends: my.friends});
    };
}
export function Room (room, channel) {
    let my = this;

    my.id = room.id || _rid;
    my.channel = channel;
    my.opts = {};
    /*my.title = room.title;
    my.password = room.password;
    my.limit = Math.round(room.limit);
    my.mode = room.mode;
    my.rule = Const.getRule(room.mode);
    my.round = Math.round(room.round);
    my.time = room.time * my.rule.time;
    my.opts = {
        manner: room.opts.manner,
        extend: room.opts.injeong,
        mission: room.opts.mission,
        loanword: room.opts.loanword,
        injpick: room.opts.injpick || []
    };*/
    my.master = null;
    my.tail = [];
    my.players = [];
    my.kicked = [];
    my.kickVote = null;

    my.gaming = false;
    my.game = {};

    my.getData = function () {
        let i, readies = {};
        let pls = [];
        let seq = my.game.seq ? my.game.seq.map(filterRobot) : [];
        let o;

        for (i in my.players) {
            if (o = DIC[my.players[i]]) {
                readies[my.players[i]] = {
                    r: o.ready || o.game.ready,
                    f: o.form || o.game.form,
                    t: o.team || o.game.team
                };
            }
            pls.push(filterRobot(my.players[i]));
        }
        return {
            id: my.id,
            channel: my.channel,
            title: my.title,
            password: !!my.password,
            limit: my.limit,
            mode: my.mode,
            round: my.round,
            time: my.time,
            master: my.master,
            lastTitle: my.lastTitle,
            players: pls,
            readies: readies,
            gaming: my.gaming,
            game: {
                round: my.game.round,
                turn: my.game.turn,
                seq: seq,
                title: my.game.title,
                mission: my.game.mission
            },
            practice: !!my.practice,
            opts: my.opts
        };
    };
    my.addAI = function (caller, level) {
        if (my.players.length >= my.limit) {
            return caller.sendError(429);
        }
        if (my.gaming) {
            return caller.send('error', {code: 416, target: my.id});
        }
        if (!my.rule.ai) {
            return caller.sendError(415);
        }
        my.players.push(new Robot(null, my.id, level));
        my.export();
    };
    my.setAI = function (target, level, team) {
        let i;

        for (i in my.players) {
            if (!my.players[i]) continue;
            if (!my.players[i].robot) continue;
            if (my.players[i].id == target) {
                my.players[i].setLevel(level);
                my.players[i].setTeam(team);
                my.export();
                return true;
            }
        }
        return false;
    };
    my.removeAI = function (target, noEx) {
        let i, j;

        for (i in my.players) {
            if (!my.players[i]) continue;
            if (!my.players[i].robot) continue;
            if (!target || my.players[i].id == target) {
                if (my.gaming) {
                    j = my.game.seq.indexOf(my.players[i]);
                    if (j != -1) my.game.seq.splice(j, 1);
                }
                my.players.splice(i, 1);
                if (!noEx) my.export();
                return true;
            }
        }
        return false;
    };
    my.come = function (client) {
        if (!my.practice) client.place = my.id;

        if (my.players.push(client.id) == 1) {
            my.master = client.id;
            my.lastTitle = client.id;
        }
        if (Cluster.isWorker) {
            client.ready = false;
            client.team = 0;
            client.cameWhenGaming = false;
            client.form = "J";

            if (!my.practice) process.send({type: "room-come", target: client.id, id: my.id});
            my.export(client.id);
        }
    };
    my.spectate = function (client, password) {
        if (!my.practice) client.place = my.id;
        let len = my.players.push(client.id);

        if (Cluster.isWorker) {
            client.ready = false;
            client.team = 0;
            client.cameWhenGaming = true;
            client.form = (len > my.limit) ? "O" : "S";

            process.send({type: "room-spectate", target: client.id, id: my.id, pw: password});
            my.export(client.id, false, true);
        }
    };
    my.go = function (client, kickVote) {
        let x = my.players.indexOf(client.id);
        let me;

        if (x == -1) {
            client.place = 0;
            if (my.players.length < 1) delete ROOM[my.id];
            return client.sendError(409);
        }
        my.players.splice(x, 1);
        client.game = {};
        if (client.id == my.master) {
            while (my.removeAI(false, true)) ;
            my.master = my.players[0];
        }
        if (DIC[my.master]) {
            DIC[my.master].ready = false;
            if (my.gaming) {
                x = my.game.seq.indexOf(client.id);
                if (x != -1) {
                    if (my.game.seq.length <= 2) {
                        my.game.seq.splice(x, 1);
                        my.roundEnd();
                    } else {
                        me = my.game.turn == x;
                        if (me && my.rule.ewq) {
                            clearTimeout(my.game._rrt);
                            my.game.loading = false;
                            if (Cluster.isWorker) my.turnEnd();
                        }
                        my.game.seq.splice(x, 1);
                        if (my.game.turn > x) {
                            my.game.turn--;
                            if (my.game.turn < 0) my.game.turn = my.game.seq.length - 1;
                        }
                        if (my.game.turn >= my.game.seq.length) my.game.turn = 0;
                    }
                }
            }
        } else {
            if (my.gaming) {
                my.interrupt();
                my.game.late = true;
                my.gaming = false;
                my.game = {};
            }
            delete ROOM[my.id];
        }
        if (my.practice) {
            clearTimeout(my.game.turnTimer);
            client.subPlace = 0;
        } else client.place = 0;

        if (Cluster.isWorker) {
            if (!my.practice) {
                client.socket.close();
                process.send({type: "room-go", target: client.id, id: my.id, removed: !ROOM.hasOwnProperty(my.id)});
            }
            my.export(client.id, kickVote);
        }
    };
    my.setTitle = function (title) {
        my.title = title;
    };
    my.set = function (room) {
        let i, k, ijc, ij;

        if (my.title !== room.title) my.lastTitle = my.master;
        my.title = room.title;
        my.password = room.password;
        my.limit = Math.max(Math.min(8, my.players.length), Math.round(room.limit));
        my.mode = room.mode;
        my.rule = Const.getRule(room.mode);
        my.round = Math.round(room.round);
        my.time = room.time * my.rule.time;
        if (room.opts && my.opts) {
            for (i in Const.OPTIONS) {
                k = Const.OPTIONS[i].name.toLowerCase();
                my.opts[k] = room.opts[k] && my.rule.opts.includes(i);
            }
            if (ijc = my.rule.opts.includes("ijp")) {
                ij = Const[`${my.rule.lang.toUpperCase()}_IJP`];
                my.opts.injpick = (room.opts.injpick || []).filter(function (item) {
                    return ij.includes(item);
                });
            } else my.opts.injpick = [];
        }
        if (!my.rule.ai) {
            while (my.removeAI(false, true)) ;
        }
        for (i in my.players) {
            if (DIC[my.players[i]]) DIC[my.players[i]].ready = false;
        }
    };
    my.preReady = function (teams) {
        let i, j, t = 0, l = 0;
        let avTeam = [];

        // 팀 검사
        if (teams) {
            if (teams[0].length) {
                if (teams[1].length > 1 || teams[2].length > 1 || teams[3].length > 1 || teams[4].length > 1) return 418;
            } else {
                for (i = 1; i < 5; i++) {
                    if (j = teams[i].length) {
                        if (t) {
                            if (t != j) return 418;
                        } else t = j;
                        l++;
                        avTeam.push(i);
                    }
                }
                if (l < 2) return 418;
                my._avTeam = shuffle(avTeam);
            }
        }
        // 인정픽 검사
        if (!my.rule) return 400;
        if (my.rule.opts.includes("ijp")) {
            if (!my.opts.injpick) return 400;
            if (!my.opts.injpick.length) return 413;
            if (!my.opts.injpick.every(function (item) {
                return !Const.IJP_EXCEPT.includes(item);
            })) return 414;
        }
        return false;
    };
    my.ready = function () {
        let i, all = true;
        let len = 0;
        let teams = [[], [], [], [], []];

        for (i in my.players) {
            if (my.players[i].robot) {
                len++;
                teams[my.players[i].game.team].push(my.players[i]);
                continue;
            }
            if (!DIC[my.players[i]]) continue;
            if (DIC[my.players[i]].form == "S") continue;

            len++;
            teams[DIC[my.players[i]].team].push(my.players[i]);

            if (my.players[i] == my.master) continue;
            if (!DIC[my.players[i]].ready) {
                all = false;
                break;
            }
        }
        if (!DIC[my.master]) return;
        if (len < 2) return DIC[my.master].sendError(411);
        if (i = my.preReady(teams)) return DIC[my.master].sendError(i);
        if (all) {
            my._teams = teams;
            my.start();
        } else DIC[my.master].sendError(412);
    };
    my.start = function (pracLevel) {
        let i, j, o, hum = 0;
        let now = (new Date()).getTime();
        my.game.event = Const.EVENT_WP_DROP_START < now && now < Const.EVENT_WP_DROP_UNTIL;

        my.gaming = true;
        my.game.late = true;
        my.game.round = 0;
        my.game.turn = 0;
        my.game.seq = [];
        my.game.robots = [];
        my.game.rev = false;
        if (my.practice) {
            my.game.robots.push(o = new Robot(my.master, my.id, pracLevel));
            my.game.seq.push(o, my.master);
        } else {
            for (i in my.players) {
                if (my.players[i].robot) {
                    my.game.robots.push(my.players[i]);
                } else {
                    if (!(o = DIC[my.players[i]])) continue;
                    if (o.form != "J") continue;
                    hum++;
                }
                if (my.players[i]) my.game.seq.push(my.players[i]);
            }
            if (!my.rule.ewq) {
                // 섞을 필요가 없다.
            } else if (my._avTeam) {
                o = my.game.seq.length;
                j = my._avTeam.length;
                my.game.seq = [];
                for (i = 0; i < o; i++) {
                    let v = my._teams[my._avTeam[i % j]].shift();

                    if (!v) continue;
                    my.game.seq[i] = v;
                }
            } else {
                my.game.seq = shuffle(my.game.seq);
            }
        }
        my.game.mission = null;
        my.game.initseq = my.game.seq;
        my.game.initusers = my.game.seq.filter( (u) => { return !u.robot } ) || [];
        for (i in my.game.seq) {
            o = DIC[my.game.seq[i]] || my.game.seq[i];
            if (!o) continue;
            if (!o.game) continue;

            o.playAt = now;
            o.ready = false;
            o.game.score = 0;
            o.game.bonus = 0;
            o.game.item = [/*0, 0, 0, 0, 0, 0*/];
            o.game.wpc = [];
            delete o.game.wpe;
            if (my.game.event || (Const.EVENT_FORCE_FOR_ADMIN && o.admin)) o.game.wpe = [];
        }
        my.game.hum = hum;
        my.getTitle().then(function (title) {
            my.game.title = title;
            my.export();
            setTimeout(my.roundReady, 2000);
        });
        my.byMaster('starting', {target: my.id});
        delete my._avTeam;
        delete my._teams;
    };
    my.roundReady = function () {
        if (!my.gaming) return;
        if (!my.game.seq || my.game.seq.length < 2) return my.roundEnd();
        return my.route("roundReady");
    };
    my.interrupt = function () {
        clearTimeout(my.game._rrt);
        clearTimeout(my.game.turnTimer);
        clearTimeout(my.game.hintTimer);
        clearTimeout(my.game.hintTimer2);
        clearTimeout(my.game.qTimer);
    };
    my.roundEnd = function (data) {
        let i, o, rw;
        let res = [];
        let users = {};
        let rl;
        let pv = -1;
        let suv = [];
        let teams = [null, [], [], [], []];
        let sumScore = 0;
        let now = (new Date()).getTime();
        if (my.game === undefined) return;
        if (my.game.seq === undefined) return;
        if (my.game.robots === undefined) {
            my.game.robots = [];
            for (i in my.players) {
                if(my.players[i].robot) {
                    my.game.robots.push(my.players[i]);
                }
            }
        }

        my.interrupt();
        for (i in my.players) {
            o = DIC[my.players[i]];
            if (!o) continue;
            if (o.cameWhenGaming) {
                o.cameWhenGaming = false;
                if (o.form == "O") {
                    o.sendError(428);
                    o.leave();
                    continue;
                }
                o.setForm("J");
            }
        }
        for (i in my.game.seq) {
            o = DIC[my.game.seq[i]] || my.game.seq[i];
            if (!o) continue;
            if (o.robot) {
                if (o.game.team) teams[o.game.team].push(o.game.score);
            } else if (o.team) teams[o.team].push(o.game.score);
        }
        for (i = 1; i < 5; i++) if (o = teams[i].length) teams[i] = [o, teams[i].reduce(function (p, item) {
            return p + item;
        }, 0)];
        for (i in my.game.initseq) {
            let currscore = -1;
            o = DIC[my.game.initseq[i]];
            if (!o) continue;
            if (my.game.seq.indexOf(o.id) != -1) currscore = o.game.score
            if (currscore >= 0) sumScore += currscore;
            res.push({id: o.id, score: o.team ? teams[o.team][1] : currscore, dim: o.team ? teams[o.team][0] : 1});
        }
        res.sort(function (a, b) {
            return b.score - a.score;
        });

        if (my.game.initusers === undefined) rl = 1;
        else rl = my.game.initusers.length;
        if ((my.game.seq.length - my.game.robots.length) < 2) rl = 1;

        for (i in res) {
            if (my.opts.rankmode && res[i].score === -1) continue;

            if (!my.opts.rankmode && DIC[res[i].id] === undefined) {
                DB.users.findOne(['_id', res[i].id]).on(function (user) {
                    user.kkutu.record[my.mode][0]++
                    DB.users.upsert(['_id', res[i].id]).set([
                        ['kkutu', user.kkutu]
                    ]);
                });
                continue;
            }

            o = DIC[res[i].id];
            if (pv == res[i].score) {
                res[i].rank = res[Number(i) - 1].rank;
            } else {
                res[i].rank = Number(i);
            }
            pv = res[i].score;
            rw = getRewards(my.mode, o.game.score / res[i].dim, o.game.bonus, res[i].rank, rl, sumScore);
            rw.playTime = now - o.playAt;
            o.applyEquipOptions(rw); // 착용 아이템 보너스 적용
            if (rw.together) {
                if (o.game.wpc) o.game.wpc.forEach(function (item) {
                    o.obtain("$WPC" + item, {q: 1});
                }); // 글자 조각 획득 처리
                if (o.game.wpe) o.game.wpe.forEach (function (item) {
                    o.obtain("$WPE" + item, {q: 1, x: Const.EVENT_WP_EXPIRE_AT, mx: true});
                });
                o.onOKG(rw.playTime);
            }

            res[i].reward = rw;
            o.data.score += rw.score || 0;
            o.money += rw.money || 0;
            o.data.record[Const.GAME_TYPE[my.mode]][2] += rw.score || 0;
            o.data.record[Const.GAME_TYPE[my.mode]][3] += rw.playTime;
            if (!my.practice && rw.together) {
                o.data.record[Const.GAME_TYPE[my.mode]][0]++;
                if (res[i].rank == 0) o.data.record[Const.GAME_TYPE[my.mode]][1]++;
                rewardRating(o, pv);
            }
            users[o.id] = o.getData();
            suv.push(o.flush(true, false, false, true));
        }
        LizardAll(suv).then(function (uds) {
            let o = {};

            suv = [];
            for (i in uds) {
                o[uds[i].id] = {prev: uds[i].prev};
                suv.push(DB.redis.getSurround(uds[i].id));
            }
            LizardAll(suv).then(function (ranks) {
                let i, j;

                for (i in ranks) {
                    if (!o[ranks[i].target]) continue;

                    o[ranks[i].target].list = ranks[i].data;
                }
                my.byMaster('roundEnd', {result: res, users: users, ranks: o, data: data}, true);
            });
        });
        my.gaming = false;
        my.export();
        delete my.game.seq;
        delete my.game.wordLength;
        delete my.game.dic;
    };
    my.byMaster = function (type, data, nob) {
        if (DIC[my.master]) DIC[my.master].publish(type, data, nob);
    };
    my.export = function (target, kickVote, spec) {
        let obj = {room: my.getData()};
        let i, o;

        if (!my.rule) return;
        if (target) obj.target = target;
        if (kickVote) obj.kickVote = kickVote;
        if (spec && my.gaming) {
            if (my.rule.rule == "Classic") {
                if (my.game.chain) obj.chain = my.game.chain.length;
            } else if (my.rule.rule == "Jaqwi") {
                obj.theme = my.game.theme;
                obj.conso = my.game.conso;
            } else if (my.rule.rule == "Crossword") {
                obj.prisoners = my.game.prisoners;
                obj.boards = my.game.boards;
                obj.means = my.game.means;
            }
            obj.spec = {};
            for (i in my.game.seq) {
                if (o = DIC[my.game.seq[i]]) obj.spec[o.id] = o.game.score;
            }
        }
        if (my.practice) {
            if (DIC[my.master || target]) DIC[my.master || target].send('room', obj);
        } else {
            publish('room', obj, my.password);
        }
    };
    my.turnStart = function (force) {
        if (!my.gaming) return;
        if (!my.game.seq || my.game.seq.length < 2) return my.roundEnd();
        return my.route("turnStart", force);
    };
    my.readyRobot = function (robot) {
        if (!my.gaming) return;

        return my.route("readyRobot", robot);
    };
    my.turnRobot = function (robot, text, data) {
        if (!my.gaming) return;

        my.submit(robot, text, data);
        //return my.route("turnRobot", robot, text);
    };
    my.turnNext = function (force) {
        if (!my.gaming) return;
        if (!my.game.seq) return;
        let additional = 0;
        if (my.game.queue) {
            /* queue가..
             * 1이면 다음 사람 건너뜀
             * -1이면 턴을 넘기지 않음
             */
            additional = my.game.queue;
            my.game.queue = 0;
        }
        if (my.game.rev) { // 역방향 진행인 경우
            my.game.turn = my.game.turn - 1 + my.game.seq.length - additional; // 인덱싱이 넘어가지 않도록
        } else {
            my.game.turn = my.game.turn + 1 + additional;
        }
        my.game.turn = my.game.turn % my.game.seq.length;
        my.turnStart(force);
    };
    my.turnEnd = function () {
        return my.route("turnEnd");
    };
    my.submit = function (client, text, data) {
        return my.route("submit", client, text, data);
    };
    my.useItem = function (client, id) {
        return my.route("useItem", client, id);
    }
    my.getScore = function (text, delay, ignoreMission) {
        return my.routeSync("getScore", text, delay, ignoreMission);
    };
    my.getTurnSpeed = function (rt) {
        if (rt < 5000) return 10;
        else if (rt < 11000) return 9;
        else if (rt < 18000) return 8;
        else if (rt < 26000) return 7;
        else if (rt < 35000) return 6;
        else if (rt < 45000) return 5;
        else if (rt < 56000) return 4;
        else if (rt < 68000) return 3;
        else if (rt < 81000) return 2;
        else if (rt < 95000) return 1;
        else return 0;
    };
    my.getTitle = function () {
        return my.route("getTitle");
    };
    /*my.route = function(func, ...args){
        let cf;

        if(!(cf = my.checkRoute(func))) return;
        return Slave.run(my, func, args);
    };*/
    my.route = my.routeSync = function (func, ...args) {
        let cf;

        if (!(cf = my.checkRoute(func))) return;
        return cf.apply(my, args);
    };
    my.checkRoute = function (func) {
        let c;

        if (!my.rule) return IOLog.warn("Unknown mode: " + my.mode), false;
        if (!(c = Rule[my.rule.rule])) return IOLog.warn("Unknown rule: " + my.rule.rule), false;
        if (!c[func]) return IOLog.warn("Unknown function: " + func), false;
        return c[func];
    };
    my.set(room);
}

function getFreeChannel() {
    let i, list = {};

    if (Cluster.isMaster) {
        let mk = 1;

        for (i in CHAN) {
            // if(CHAN[i].isDead()) continue;
            list[i] = 0;
        }
        for (i in ROOM) {
            // if(!list.hasOwnProperty(i)) continue;
            mk = ROOM[i].channel;
            list[mk]++;
        }
        for (i in list) {
            if (list[i] < list[mk]) mk = i;
        }
        return Number(mk);
    } else {
        return channel || 0;
    }
}

function getGuestName(sid) {
    let i, len = sid.length, res = 0;

    for (i = 0; i < len; i++) {
        res += sid.charCodeAt(i) * (i + 1);
    }
    return "손님" + (1000 + (res % 9000));
}

function shuffle(arr) {
    let i, r = [];

    for (i in arr) r.push(arr[i]);
    r.sort(function (a, b) {
        return Math.random() - 0.5;
    });

    return r;
}

function getRewards(mode, score, bonus, rank, all, ss) {
    let rw = {score: 0, money: 0};
    let sr = score / ss;

    // all은 1~8
    // rank는 0~7
    switch (Const.GAME_TYPE[mode]) {
        case "EKT":
            rw.score += score * 1.34;
            break;
        case "ESH":
            rw.score += score * 0.48;
            break;
        case "EAP":
            rw.score += score * 0.7;
            break;
        case "KKT":
            rw.score += score * 0.92;
            break;
        case "KSH":
            rw.score += score * 0.54;
            break;
        case "CSQ":
            rw.score += score * 0.44;
            break;
        case 'KCW':
            rw.score += score * 1.0;
            break;
        case 'KTY':
            rw.score += score * 0.32;
            break;
        case 'ETY':
            rw.score += score * 0.36;
            break;
        case 'KAP':
            rw.score += score * 0.8;
            break;
        case 'HUN':
            rw.score += score * 0.52;
            break;
        case 'KDA':
            rw.score += score * 0.56;
            break;
        case 'EDA':
            rw.score += score * 0.6;
            break;
        case 'KSS':
            rw.score += score * 0.48;
            break;
        case 'ESS':
            rw.score += score * 0.28;
            break;
        case 'KWS':
            rw.score += score * 0.42;
            break;
        case 'EWS':
            rw.score += score * 0.32;
        default:
            break;
    }

    rw.score = rw.score
        * (0.77 + 0.05 * (all - rank) * (all - rank)) // 순위
        * 1.25 / (1 + 1.25 * sr * sr) // 점차비(양학했을 수록 ↓)
    ;
    rw.money = 1 + rw.score * 0.01;

    rw.score *= XPMultiplier
    rw.money *= MoneyMultiplier

    if (all < 2) {
        rw.score = rw.score * 0.4;
        rw.money = rw.money * 0.4;
    } else if (all < 4) {
        rw.score = rw.score * 0.9;
        rw.money = rw.money * 0.9;
        rw.together = true;
    } else {
        rw.together = true;
    }
    rw.score += bonus;

    rw.score = rw.score || 0;
    rw.money = rw.money || 0;

    // applyEquipOptions에서 반올림한다.
    return rw;
}

function filterRobot(item) {
    if (!item) return {};
    return (item.robot && item.getData) ? item.getData() : item;
}
