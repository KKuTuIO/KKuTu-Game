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
import { Tail, all as LizardAll } from '../sub/lizard.js';
import * as IOLog from '../sub/KKuTuIOLog.js';
import { init as ACInit, canRandomized,
    randomizePacket } from '../sub/utils/AntiCheat.js';
import { resetDaily, rewardRating, getRatingLevel } from '../sub/utils/UserRating.js';
import { RULE, GAME_TYPE, CHAT_SPAM_ADD_DELAY, CHAT_SPAM_CLEAR_DELAY,
    CHAT_SPAM_LIMIT, CHAT_BLOCKED_LENGTH, CHAT_KICK_BY_SPAM, SPAM_ADD_DELAY,
    SPAM_CLEAR_DELAY, SPAM_LIMIT, BLOCKED_LENGTH, KICK_BY_SPAM, EVENT_WORDPIECE,
    EQUIP_SLOTS, EQUIP_GROUP, MAX_OBSERVER, OPTIONS, IJP,
    IJP_EXCEPT, EVENT_FORCE_FOR_ADMIN, EVENT_ID, EVENT_POINT, EVENT_START,
    EVENT_UNTIL, EVENT_EXPIRE_AT, EVENT_ITEMPIECE, EVENT_SUPPORT } from "../config.js"
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

const IS_TEST_SERVER = false // 현재 더미

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

    for (i in RULE) {
        k = RULE[i].rule;
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

export function isEventGoing() {
    let now = new Date().getTime();
    if (EVENT_START > now) return 0; // 이벤트 시작 전
    if (EVENT_UNTIL > now) return 1; // 이벤트 중
    if ((EVENT_EXPIRE_AT * 1000) > now) return 2; // 이벤트 완료 후 ~ 교환 기간
    return 0; // 이벤트 이미 종료됨
}

export function runAs(obj, func, ...args) {
    const target = func.bind(obj);
    return target.apply(obj, args);
}

export function getWeightedRandom (arr) {
    let total = Object.values(arr).reduce( (a, b) => a + b )
    let i = Math.floor(Math.random() * total);
    let k;
    for (k in arr) {
        if (i < arr[k]) break;
        i -= arr[k];
    }
    return k;
}

export function getRandom (arr) {
    if (!arr || arr.length < 1) return;
    return arr[Math.floor(Math.random() * arr.length)];
}

export class Robot {
    constructor (target, place, level) {
        this.id = target + place + Math.floor(Math.random() * 1000000000);
        this.robot = true;
        this.game = {};
        this.data = {};
        this.place = place;
        this.target = target;
        this.equip = {robot: true};

        this.setLevel(level);
        this.setTeam(0);

        return this;
    }

    getData () {
        return {
            id: this.id,
            robot: true,
            game: this.game,
            data: this.data,
            place: this.place,
            target: this.target,
            equip: this.equip,
            level: this.level,
            rating: -1,
            ready: true
        };
    };

    setLevel (level) {
        this.level = level;
        this.data.score = Math.pow(10, level + 2);
    };

    setTeam (team) {
        this.game.team = team;
    };

    send () {
    };

    obtain () {
    };

    invokeWordPiece (text, coef) {
    };

    invokeEventPiece (text, coef) {
    };

    publish (type, data, noBlock) {
        let i;

        // 턴 종료 패킷 랜덤화
        if (type == 'turnEnd' && canRandomized(data)) {
            data = randomizePacket(data);
        }

        if (this.target == null) {
            for (i in DIC) {
                if (DIC[i].place == this.place) DIC[i].send(type, data);
            }
        } else if (DIC[this.target]) {
            DIC[this.target].send(type, data);
        }
    };

    chat (msg, code) {
        this.publish('chat', {value: msg});
    };
};

export class Data {
    constructor (data) {
        let i, j;

        if (!data) data = {};

        this.score = data.score || 0;
        this.playTime = data.playTime || 0;
        this.connectDate = data.connectDate || 0;
        this.record = {};
        for (i in GAME_TYPE) {
            this.record[j = GAME_TYPE[i]] = data.record ? (data.record[GAME_TYPE[i]] || [0, 0, 0, 0]) : [0, 0, 0, 0];
            if (!this.record[j][3]) this.record[j][3] = 0;
        }
        // 전, 승, 점수

        return this;
    }
}

export class WebServer {
    constructor (socket) {
        this.socket = socket;
        socket.on('message', this.onWebServerMessage);
    }

    send (type, data) {
        let i, r = data || {};

        r.type = type;

        if (this.socket.readyState == 1) this.socket.send(JSON.stringify(r));
    };

    onWebServerMessage (msg) {
        IOLog.info(`웹서버에서 메시지가 전달되었습니다. : ${msg}`)
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            IOLog.error(`웹서버 메시지 파싱에 실패했습니다. : ${e}`);
            return;
        }

        switch (msg.type) {
            case 'seek':
                this.send('seek', {value: Object.keys(DIC).length});
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
}

export class Client {
    constructor (socket, profile, sid) {
        let gp, okg;

        if (profile) {
            this.id = profile.id;
            this.profile = profile;
            /* 망할 셧다운제
            if(Cluster.isMaster){
                this.isAjae = Ajae.checkAjae(profile.birth, profile._age);
            }else{
                this.isAjae = true;
            }
            this._birth = profile.birth;
            this._age = profile._age;
            delete this.profile.birth;
            delete this.profile._age;
            */
            delete this.profile.sid;
            delete this.profile.token;

            if (this.profile.title) this.profile.name = "anonymous";
        } else {
            gp = guestProfiles[Math.floor(Math.random() * guestProfiles.length)];

            this.id = "guest__" + sid;
            this.guest = true;
            this.isAjae = false;
            this.profile = {
                id: sid,
                title: getGuestName(sid),
                image: GUEST_IMAGE
            };
        }
        this.socket = socket;
        this.place = 0;
        this.team = 0;
        this.ready = false;
        this.game = {};
        this.sid = sid;
        this.event = {};

        this.subPlace = 0;
        this.error = false;
        this.blocked = false;
        this.blockedChat = false;
        this.spam = 0;
        this.spamChat = 0;
        this.ackFailed = 0;
        this.ackCount = 0;
        this.ackWaiting = false;
        this.acInited = false;
        this.lastAC = 0;
        this.acStoredData = [];
        this.timers = {};
        this._pub = new Date();
        this._pubChat = new Date();

        socket.on('close', (code) => {
            if (ROOM[this.place]) ROOM[this.place].go(this);
            if (this.subPlace) this.pracRoom.go(this);
            clientCloseHandler(this, code);
        });

        socket.on('message', (msg) => {
            let data, room = ROOM[this.place];
            if (!this) return;
            if (!msg) return;

            try {
                data = JSON.parse(msg);
            } catch (e) {
                data = {error: 400};
            }

            if (!data.hasOwnProperty('type') || data.type !== 'polygama') {
                const roomText = room ? this.place : '로비';
                IOLog.info(`[` + socket.upgradeReq.connection.remoteAddress.slice(7) + `] ` + `Room @${roomText} Msg #${this.id}: ${msg}`);
            }

            if (Cluster.isWorker) process.send({
                type: "tail-report",
                id: this.id,
                chan: channel,
                place: this.place,
                msg: data.error ? msg : data
            });

            clientMessageHandler(this, data);
        });
    }

    
    onOKG (time) {
        if (Cluster.isMaster) return; // ?? 이럴 일이 없어야 한다.
        let d = (new Date()).getDate();

        if (this.guest) return;
        if (d != this.data.connectDate) {
            this.data.connectDate = d;
            this.data.playTime = 0;
            this.okgCount = 0;
            resetDaily(this);
        }
        this.data.playTime += time;

        while (this.data.playTime >= PER_OKG * (this.okgCount + 1)) {
            if (this.okgCount >= MAX_OKG) return;
            this.okgCount++;
        }
        this.send('okg', {time: this.data.playTime, count: this.okgCount});
        // process.send({ type: 'okg', id: this.id, time: time });
    };

    /* 망할 셧다운제
    confirmAjae (input){
        if(Ajae.confirmAjae(input, this._birth, this._age)){
            DB.users.update([ '_id', this.id ]).set([ 'birthday', input.join('-') ]).on(() => {
                this.sendError(445);
            });
        }else{
            DB.users.update([ '_id', this.id ]).set([ 'black', `[${input.join('-')}] 생년월일이 올바르게 입력되지 않았습니다. 잠시 후 다시 시도해 주세요.` ]).on(() => {
                this.socket.close();
            });
        }
    };
    */
    
    getData (gaming) {
        let o = {
            id: this.id,
            guest: this.guest,
            game: {
                ready: this.ready,
                form: this.form,
                team: this.team,
                practice: this.subPlace,
                score: this.game.score,
                item: this.game.item,
            }
        };
        if (!gaming) {
            o.profile = this.profile;
            o.place = this.place;
            o.data = this.data;
            o.money = this.money;
            o.equip = this.equip;
            o.exordial = this.exordial;
            o.rating = getRatingLevel(this) || 2;
            o.event = this.event;
        }
        return o;
    };
    
    send (type, data) {
        let i, r = data || {};

        r.type = type;

        if (this.socket.readyState == 1) this.socket.send(JSON.stringify(r));
    };
    
    sendError (code, msg) {
        this.send('error', {code: code, message: msg});
    };
    
    publish (type, data, noBlock) {
        let i;
        let now = new Date();
        let $room = ROOM[this.place];

        // 턴 종료 패킷 랜덤화
        if (type == 'turnEnd' && canRandomized(data)) {
            data = randomizePacket(data);
        }

        // 채팅 도배 차단
        if (type == 'chat' && !this.subPlace && (!$room || !$room.gaming || $room.game.seq.indexOf(this.id) == -1)) {
            let stChat = now - this._pubChat;
            if (stChat <= CHAT_SPAM_ADD_DELAY) this.spamChat++;
            else if (stChat >= CHAT_SPAM_CLEAR_DELAY) this.spamChat = 0;
            if (this.spamChat >= CHAT_SPAM_LIMIT) {
                if (!this.blockedChat) this.numSpamChat = 0;
                this.blockedChat = true;
            }
            if (!noBlock) {
                this._pubChat = now;
                if (this.blockedChat) {
                    if (stChat < CHAT_BLOCKED_LENGTH) {
                        if (++this.numSpamChat >= CHAT_KICK_BY_SPAM) {
                            if (Cluster.isWorker) process.send({type: "kick", target: this.id});
                            return this.socket.close();
                        }
                        return this.send('blocked');
                    } else this.blockedChat = false;
                }
            }
            // 패킷 도배 차단
        } else {
            let st = now - this._pub;
            if (st <= SPAM_ADD_DELAY) this.spam++;
            else if (st >= SPAM_CLEAR_DELAY) this.spam = 0;
            if (this.spam >= SPAM_LIMIT) {
                if (!this.blocked) this.numSpam = 0;
                this.blocked = true;
            }
            if (!noBlock) {
                this._pub = now;
                if (this.blocked) {
                    if (st < BLOCKED_LENGTH) {
                        if (++this.numSpam >= KICK_BY_SPAM) {
                            if (Cluster.isWorker) process.send({type: "kick", target: this.id});
                            return this.socket.close();
                        }this
                        return this.send('blocked');
                    } else this.blocked = false;
                }
            }
        }
        data.profile = this.profile;
        if (this.subPlace && type != 'chat') this.send(type, data);
        else for (i in DIC) {
            if (DIC[i].place == this.place) DIC[i].send(type, data);
        }
        if (Cluster.isWorker && type == 'user') process.send({type: "user-publish", data: data});
    };

    chat (msg, code) {
        if (this.noChat) {
            this.send('chat', {
                notice: true,
                code: 443
            });
            return;
        }

        if (this.dbBlockedChat !== undefined) {
            this.send('chat', {
                notice: true,
                message: makeBlockChatMessage(this.dbBlockedChat)
            });
            return;
        }

        if (this.guest) return this.send('chat', {notice: true, code: 401});
        this.publish('chat', {value: msg, notice: !!code, code: code});

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
    
    checkExpire () {
        if(this.place !== 0) return;

        let now = new Date();
        let d = now.getDate();
        let i, expired = [];
        let gr, item;
        let needFlush = false;

        now = now.getTime() * 0.001;
        if (d != this.data.connectDate) {
            this.data.connectDate = d;
            this.data.playTime = 0;
            this.okgCount = 0;
            resetDaily(this);
            needFlush = true;
        }
        for (i in this.box) {
            item = this.box[i]
            if (Number.isInteger(item)) {
                item = this.box[i] = {value: this.box[i]};
                needFlush = true;
            }
            if (item.expire == 2147483647) {
                delete this.box[i].expire;
                needFlush = true;
            }

            if (!item.value && !item.expire) {
                delete this.box[i];
                continue;
            }
            if (!item.expire) continue;
            if (item.expire < now) {
                if (DB.shop.hasOwnProperty(i)){
                    gr = DB.shop[i].group;
    
                    if (gr.substr(0, 3) == "BDG") gr = "BDG";
                    if (gr == "Mhand") {
                        if (this.equip.Mlhand == i) delete this.equip.Mlhand;
                        if (this.equip.Mrhand == i) delete this.equip.Mrhand;
                    } else if (this.equip[gr] == i) delete this.equip[gr];
                }
                delete this.box[i];
                expired.push(i);
            }
        }
        needFlush = needFlush || expired.length;
        if (!this.getFlag("equipMigrate")) this.migrateEquips();
        if (expired.length) this.send('expired', {list: expired});
        if (needFlush) this.flush(this.box, this.equip);
    };
    
    getLevel = () => kkutuLevel(this)
    
    refresh () {
        let R = new Tail();
        let playerIp;

        try {
            playerIp = this.socket._socket.remoteAddress.slice(7);

            DB.UserBlockModule.checkBlockIp(playerIp, (ipBlockResult) => {
                if ((ipBlockResult.onlyGuestPunish && (this.guest && ipBlockResult.block)) || (!ipBlockResult.onlyGuestPunish && ipBlockResult.block)) {
                    this.sendError(444, ipBlockResult.reason);
                    this.socket.close();
                }
                
                if (this.guest) {
                    this.equip = {};
                    this.data = new Data();
                    this.money = 0;
                    this.friends = {};

                    R.go({
                        result: 200
                    });
                } else {
                    DB.VendorDBMigration.processVendorMigration(this.id, () => {
                        DB.users.findOne(['_id', this.id]).on(($user) => {
                            let first = !$user;
                            let black = first ? "" : $user.black;

                            if (first) {
                                $user = IS_TEST_SERVER ? {money: 2500} : {money: 0};
                            }
                            if (black === "null" || black === "") {
                                black = false;
                            }
                            if (black === "chat") {
                                black = false;
                                this.noChat = true;
                            }

                            /* 망할 셧다운제
                            if(Cluster.isMaster && !this.isAjae){ // null일 수는 없다.
                                this.isAjae = Ajae.checkAjae(($user.birthday || "").split('-'));
                                if(this.isAjae === null){
                                    if(this._birth) this._checkAjae = setTimeout(() => {
                                        this.sendError(442);
                                        this.socket.close();
                                    }, 300000);
                                    else{
                                        this.sendError(441);
                                        this.socket.close();
                                        return;
                                    }
                                }
                            }*/

                            this.exordial = $user.exordial || "";
                            this.equip = $user.equip || {};
                            this.box = $user.box || {};
                            this.data = new Data($user.kkutu);
                            this.money = Number($user.money);
                            this.friends = $user.friends || {};
                            this.flags = $user.flags || {};

                            if (first) {
                                this.setFlag("flagSystem", 2);
                                this.setFlag("equipMigrate", 3);
                                this.flush(false, false, false, true);
                            } else {
                                if (!this.getFlag("flagSystem")) this.migrateFlags();
                                this.checkExpire();
                                this.okgCount = Math.floor((this.data.playTime || 0) / PER_OKG);
                                if (this.okgCount > MAX_OKG) this.okgCount = MAX_OKG;
                            }

                            let eventStatus = isEventGoing();
                            if (eventStatus) {
                                if (eventStatus == 1) { // 이벤트 진행 중에만 갱신하는 정보
                                    let lastEvent = this.getFlag("lastEvent");
                                    if (EVENT_ID != lastEvent) { // 이벤트 정보 갱신 필요
                                        this.setFlag("lastEvent", EVENT_ID)
                                        if (EVENT_POINT.IS_ENABLED) {
                                            this.setFlag("eventPoint", EVENT_POINT.INIT_POINT);
                                            if (EVENT_POINT.ENABLE_TEAM) this.joinNewTeam();
                                        }
                                        if (EVENT_SUPPORT.IS_ENABLED) {
                                            for (let item of EVENT_SUPPORT.ITEMS) {
                                                if (item.expire == -1) {
                                                    this.obtain(item.id, {q: item.value, x: EVENT_EXPIRE_AT, mx: true})
                                                    continue;
                                                } else if (item.expire > 0) {
                                                    let expire = Math.floor(new Date().getTime() / 1000) + (item.expire * 86400);
                                                    this.obtain(item.id, {q: item.value, x: expire, mx: true})
                                                    continue;
                                                } else {
                                                    this.obtain(item.id, {q: item.value})
                                                    continue;
                                                }
                                            }
                                        }
                                    }
                                }
                                // 종료 전까지 항상 갱신되는 정보
                                if (EVENT_POINT.IS_ENABLED) {
                                    this.event.point = this.getFlag("eventPoint") || 0;
                                    this.event.epTotal = this.getFlag("epTotal") || 0;
                                    if (EVENT_POINT.ENABLE_TEAM) this.event.team = this.getFlag("eventTeam");
                                }
                            }
                            this.flush(EVENT_SUPPORT.IS_ENABLED, false, false, true);

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
                                if (NIGHT && this.isAjae === false) {
                                    R.go({
                                        result: 440
                                    });
                                } else {
                                    DB.UserBlockModule.checkBlockUser(this.id, (userBlockResult) => {
                                        if (userBlockResult.block) {
                                            this.sendError(userBlockResult.reason ? 444 : 443, userBlockResult.reason);
                                            this.socket.close();
                                            return;
                                        }

                                        DB.UserBlockModule.checkBlockChat(this.id, (chatBlockResult) => {
                                            if (chatBlockResult.block) {
                                                this.dbBlockedChat = chatBlockResult;
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
            this.sendError(456);
            this.socket.close();
        }

        return R;
    };

    flush (box, equip, friends, flags, retryCount) {
        let R = new Tail();
        if (retryCount === undefined) retryCount = 0;
        if (this.guest) {
            R.go({id: this.id, prev: 0});
            return R;
        }

        DB.users.findOne(['_id', this.id]).on((currentUser) => {
            if (!currentUser) {
                if (retryCount >= 5) {
                    IOLog.warn(`${this.id}님의 현재 정보를 불러오는데 실패하였습니다. 데이터 손실 방지를 위해 작업을 취소합니다.`);
                    return;
                } else {
                    IOLog.warn(`${this.id}님의 현재 정보를 불러오는데 실패하였습니다. 저장을 다시 시도합니다. 현재 재시도 횟수 : ${retryCount}`);
                    return this.flush(box, equip, friends, flags, retryCount+1);
                }
            } else {
                IOLog.debug(`${this.id}님의 현재 정보를 불러왔습니다.`);
            }
            if (isNaN(this.money) || !this.data || isNaN(this.data.score)) {
                IOLog.warn(`${this.id}님의 현재 정보에 문제가 있는것 같습니다. 데이터 손실 방지를 위해 작업을 취소합니다.`);
                return;
            }
            DB.users.upsert(['_id', this.id]).set(
                !isNaN(this.money) ? ['money', this.money] : undefined,
                (this.data && !isNaN(this.data.score)) ? ['kkutu', this.data] : undefined,
                box ? ['box', this.box] : undefined,
                equip ? ['equip', this.equip] : undefined,
                friends ? ['friends', this.friends] : undefined,
                flags ? ['flags', this.flags] : undefined,
            ).on((__res) => {
                DB.redis.getGlobal(this.id).then((_res) => {
                    DB.redis.putGlobal(this.id, this.data.score).then((res) => {
                        DB.users.findOne(['_id', this.id]).on((resultUser) => {
                            if (!resultUser) {
                                if (retryCount >= 3) {
                                    IOLog.warn(`${this.id}님의 새로운 정보를 불러오는데 실패하였습니다. 데이터 손실 방지를 위해 작업을 취소합니다.`);
                                } else {
                                    IOLog.warn(`${this.id}님의 새로운 정보를 불러오는데 실패하였습니다. 저장을 다시 시도합니다. 현재 재시도 횟수 : ${retryCount}`);
                                    return this.flush(box, equip, friends, flags, retryCount+1);
                                }
                            } else {
                                IOLog.notice(`${resultUser.nickname}(${this.id}) 님의 데이터를 저장했습니다. ${currentUser.kkutu.score} -> ${this.data.score} EXP / ${currentUser.money} -> ${this.money} 핑 (차이| ${this.data.score - currentUser.kkutu.score} EXP / ${this.money - currentUser.money}핑)`);
                                R.go({id: this.id, prev: _res});
                            }
                        });
                    });
                });
            });
        });

        return R;
    };
    
    invokeWordPiece (text, coef) {
        if (!this.game.wpc) return;
        let v;

        if (Math.random() <= 0.04 * coef) {
            v = text.charAt(Math.floor(Math.random() * text.length));
            if (!v.match(/[a-z가-힣]/)) return;
            this.game.wpc.push(v);
        }
    };
    
    invokeEventPiece (text, coef) {
        if (!this.game.wpe) return;
        let v;

        if (Math.random() <= EVENT_WORDPIECE.DROP_RATE * coef) {
            v = text.charAt(Math.floor(Math.random() * text.length));
            if (!v.match(/[a-z가-힣]/)) return;
            this.game.wpe.push(v);
        }
    };

    static teamLenCache = EVENT_POINT.TEAM_LIST.length;
    static lastTeamIndex = Math.floor(Math.random() * Client.teamLenCache);

    joinNewTeam () {
        if (EVENT_POINT.TEAM_LIST.length != Client.teamLenCache)
            Client.lastTeamIndex = Math.floor(Math.random() * Client.teamLenCache);
        let i = Client.lastTeamIndex = (Client.lastTeamIndex + 1) % Client.teamLenCache;
        this.setFlag("eventTeam", i + 1); // 팀 번호는 항상 +1
        return i + 1;
    }
    
    equipItem (item, slot) {
        if (EQUIP_SLOTS.indexOf(slot) == -1) return this.sendError(400); // 없는 슬롯에 장착 시도
        if (EQUIP_GROUP[slot].indexOf(item.group) == -1) return this.sendError(400); // 잘못된 슬롯에 장착 시도

        if (this.equip.hasOwnProperty(slot) && this.equip[slot] == item._id) {
            // 이미 그 슬롯에 장착중임 = 해제 요청
            delete this.equip[slot];
        } else {
            let checkAlt; // 두 슬롯에 장착 가능한 아이템일 때 추가로 검사할 슬롯
            if (slot == "Mlhand") checkAlt = "Mrhand";
            else if (slot == "Mrhand") checkAlt = "Mlhand";

            let reqAmount = 1;
            if (checkAlt !== undefined && this.equip.hasOwnProperty(checkAlt) &&
                this.equip[checkAlt] == item._id) reqAmount = 2;

            if (this.box[item._id].value < reqAmount) return this.sendError(439);
            this.equip[slot] = item._id;
        }

        this.send('obtain', {
            equip: this.equip
        });
        this.flush(this.box, this.equip);
    };
    
    consume (item, count) {
        if (!item.options.hasOwnProperty("gives")) return this.sendError(556);
        if (!this.box.hasOwnProperty(item._id) || this.box[item._id].value < count) return this.sendError(434);
        if (!count || count < 1) count = 1;
        this.box[item._id].value -= count;
        if (this.box[item._id].value < 1) delete this.box[item._id];

        let money = 0;
        let exp = 0;
        let ep = 0;

        let addResult = (id, value) => {
            if (id == "money") {
                this.money += value;
                money += value;
            } else if (id == "exp") {
                this.data.score += value;
                exp += value;
            } else if (id == "ep") {
                this.event.ep += value;
                this.setFlag("eventPoint", this.event.ep);
                let total = this.getFlag("epTotal") + value;
                this.setFlag("epTotal", total);
                ep += value;
            }
            else this.obtain(id, {q: value.q, x: value.x, mx: value.mx});
            // 아이템은 obtain 함수에서 준 것으로 처리한다
        }

        for (let curr of item.options.gives) {
            let res = {};
            let i, r = (curr.roll || 1) * count;

            if (curr.type == "money" || curr.type == "exp" || curr.type == "ep") {
                if (curr.from == "fix") addResult(curr.type, curr.value * r)
                else if (curr.from == "wei") {
                    while (r-- > 0) {
                        i = getWeightedRandom(curr.pool);
                        addResult(curr.type, i);
                    }
                } else {
                    let base = (curr.type == "money" ? this.money : this.data.score);
                    if (curr.from == "per") {
                        addResult(curr.type, base * curr.per);
                    } else if (curr.from == "dict") {
                        while (r-- > 0) {
                            let base;
                            if (curr.type == "money") base = this.money;
                            else if (curr.type == "exp") base = this.data.score;
                            else if (curr.type == "ep") base = this.event.ep;
                            else continue; // 여기로 오면 안된다.
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
                while (r-- > 0) {
                    i = getWeightedRandom(curr.pool);
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

        this.send('obtain', {
            money: money,
            exp: exp,
            box: this.box,
            data: this.data,
            event: this.event
        });
        this.flush(this.box, this.equip);
    };
    
    migrateEquips () {
        if (this.getFlag("equipMigrate")) return this.sendError(400);
        this.setFlag("equipMigrate", 2);
        for (let i in this.equip) {
            let k = this.equip[i];
            delete this.equip[i];
            if (!this.box.hasOwnProperty(k)) this.box[k] = {value: 0};
            this.box[k].value += 1;
        }
        this.send('obtain', {
            box: this.box,
            equip: this.equip
        });
        this.send('alert', {
            value: "시스템 업데이트로 인해 착용 중이던 아이템이 모두 장착 해제되었습니다.<br>아이템 개수 또는 항목에 문제가 있다면 <a href='https://support.kkutu.io' target='_blank'><u>끄투리오 고객센터</u></a>를 통해 문의해주세요.",
            isOverlayEnabled: true
        });
        this.flush(true, true, false, true);
    };

    exchange (id) {
        if (!isEventGoing()) {
            if (!this.admin || !EVENT_FORCE_FOR_ADMIN) return this.sendError(400);
        }
        const index = EVENT_ITEMPIECE.EXCHANGE.findIndex((data) => data.id == id);
        const target = EVENT_ITEMPIECE.EXCHANGE[index];
        let k;

        for (k in target.cost) { // 검사부터 진행, 클라이언트에서 한번 걸러서 응답받기 때문에 아이템이 부족하면 잘못된 요청임
            if (k == "ep" && this.event.point < target.cost[k]) return this.sendError(400);
            else if (k == "ping" && this.money < target.cost[k]) return this.sendError(400);
            else if (!this.box.hasOwnProperty(k) || this.box[k].value < target.cost[k]) return this.sendError(400);
        }

        for (k in target.cost) {
            if (k == "ep") {
                this.event.point -= target.cost[k];
                this.setFlag("eventPoint", this.event.point);
                continue;
            } else if (k == "ping") {
                this.money -= target.cost[k];
                continue;
            } else {
               this.box[k].value -= target.cost[k];
               if (!this.box[k].value) delete this.box[k];
               continue;
            }
        }

        for (k in target.gives) {
            if (k == "ep") {
                this.event.point += target.gives[k];
                this.setFlag("eventPoint", this.event.point);
                let total = this.getFlag("epTotal") + target.gives[k];
                this.setFlag("epTotal", total);
                continue;
            } else if (k == "ping") {
                this.money += target.gives[k];
                continue;
            } else {
                if (target.isConvert) this.obtain(k, {q: target.gives[k], x: EVENT_EXPIRE_AT, mx: true});
                else this.obtain(k, {q: target.gives[k]});
                continue;
            }
        }
        this.flush(true, false, false, true);
        this.send('obtain', {
            money: target.gives.hasOwnProperty('ping') ? target.gives.ping : 0,
            box: this.box,
            data: this.data,
            event: this.event
        });
    }
    
    migrateFlags () {
        if (this.getFlag("flagSystem")) return this.sendError(400);
        this.setFlag("flagSystem", 1);
        for (let i in this.box) {
            if (i.charAt() != "#") continue;
            this.setFlag(i.slice(1), this.box[i].value);
            delete this.box[i];
        }
        this.flush(true, false, false, true);
    };
    
    hasFlag (name) {
        if (!this.flags) return false;
        return this.flags.hasOwnProperty(name);
    };
    
    getFlag (name) {
        if (!this.flags) return false;
        return this.flags.hasOwnProperty(name) ? this.flags[name].value : false;
    };
    
    setFlag (name, value, recordtime) {
        if (!this.flags) return false;
        if (!this.flags.hasOwnProperty(name)) this.flags[name] = {};
        let f = this.flags[name];
        f.value = value;
        if (recordtime) f.time = Math.floor(new Date().getTime() / 1000);
        IOLog.info(`${this.id} 님의 플래그가 설정되었습니다. ${name} = ${f.value}`);
        return f.value;
    };
    
    removeFlag (name) {
        if (!this.flags) return false;
        if (!this.flags.hasOwnProperty(name)) return true;
        return (delete this.flags[name]);
    }
    
    getFlagTime (name) {
        if (!this.flags) return 0;
        if (!this.flags.hasOwnProperty(name)) return 0;
        let time = this.flags[name].time;
        if (!time) return 0;
        else return new Date(time * 1000);
    };
    
    enter (room, spec, pass) {
        let $room, i;

        if (this.place) {
            this.send('roomStuck');
            IOLog.warn(`Enter the room ${room.id} in the place ${this.place} by ${this.id}!`);
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
                return this.sendError(466, room.id);
            }
            if ($room.opts.onlybeginner && (this.getLevel() >= 50 || this.guest) && !this.admin) {
                if (this.guest) return this.sendError(700);
                else return this.sendError(702);
            }
            if ($room.opts.etiquette && getRatingLevel(this) < 1) {
                if (this.guest) return this.sendError(703);
                else return this.sendError(704);
            }
            if (!spec) {
                if ($room.gaming) return this.send('error', {code: 416, target: $room.id});
                else if (!GUEST_PERMISSION.enter) return this.sendError(401);
            }
            if ($room.opts.noguest && this.guest) return this.sendError(701);
            if ($room.players.length >= $room.limit + (spec && $room.gaming ? MAX_OBSERVER : 0)) {
                return this.sendError(429);
            }
            if ($room.players.indexOf(this.id) != -1) {
                return this.sendError(409);
            }
            if (Cluster.isMaster) {
                this.send('preRoom', {id: $room.id, pw: room.password, channel: $room.channel});
                CHAN[$room.channel].send({type: "room-reserve", session: this.sid, room: room, spec: spec, pass: pass});

                $room = undefined;
            } else {
                if (!pass && $room) {
                    if ($room.kicked.indexOf(this.id) != -1) {
                        return this.sendError(406);
                    }
                    if ($room.password != room.password && $room.password) {
                        $room = undefined;
                        return this.sendError(403);
                    }
                }
            }
        } else if (this.guest && !GUEST_PERMISSION.enter) {
            this.sendError(401);
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
                this.send('preRoom', {id: _rid, channel: av});
                CHAN[av].send({type: "room-reserve", create: true, session: this.sid, room: room});

                do {
                    if (++_rid > 999) _rid = 100;
                } while (ROOM[_rid]);
            } else {
                if (room._id) {
                    room.id = room._id;
                    delete room._id;
                }
                if (this.place != 0) {
                    this.sendError(409);
                }
                $room = new Room(room, getFreeChannel());

                if ($room.opts.onlybeginner && (this.getLevel() >= 50 || this.guest) && !this.admin) {
                    if (this.guest) return this.sendError(700);
                    else return this.sendError(702);
                }

                if ($room.opts.noguest && this.guest) return this.sendError(701);

                process.send({type: "room-new", target: this.id, room: $room.getData()});
                ROOM[$room.id] = $room;
                spec = false;
            }
        }
        if ($room) {
            if (spec) $room.spectate(this, room.password);
            else $room.come(this, room.password, pass);
        }
    };
    
    leave (kickVote) {
        let $room = ROOM[this.place];

        if (this.subPlace) {
            this.pracRoom.go(this);
            if ($room) this.send('room', {target: this.id, room: $room.getData()});
            this.publish('user', this.getData());
            if (!kickVote) return;
        }
        if ($room) $room.go(this, kickVote);
    };
    
    setForm (mode) {
        let $room = ROOM[this.place];

        if (!$room) return;

        this.form = mode;
        this.ready = false;
        this.publish('user', this.getData());
    };
    
    setTeam (team) {
        this.team = team;
        this.publish('user', this.getData());
    };
    
    kick (target, kickVote) {
        let $room = ROOM[this.place];
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

                $c.timers.kick = setTimeout(runAs, 10000, $c, $c.kickVote, $c, true);
            }
            this.publish('kickVote', $room.kickVote, true);
        }
    };
    
    kickVote (client, agree) {
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
    
    toggle () {
        let $room = ROOM[this.place];

        if (!$room) return;
        if ($room.master == this.id) return;
        if (this.form != "J") return;

        this.ready = !this.ready;
        this.publish('user', this.getData());
    };
    
    start () {
        let $room = ROOM[this.place];

        if (!$room) return;
        if ($room.master != this.id) return;
        if ($room.players.length < 2) return this.sendError(411);

        $room.ready();
    };
    
    practice (level) {
        let $room = ROOM[this.place];
        let ud;
        let pr;

        if (!$room) return;
        if (this.subPlace) return;
        if (this.form != "J") return;

        this.team = 0;
        this.ready = false;
        ud = this.getData();
        this.pracRoom = new Room($room.getData());
        this.pracRoom.id = $room.id + 1000;
        ud.game.practice = this.pracRoom.id;
        if (pr = $room.preReady()) return this.sendError(pr);
        this.publish('user', ud);
        this.pracRoom.time /= this.pracRoom.rule.time;
        this.pracRoom.limit = 1;
        this.pracRoom.password = "";
        this.pracRoom.practice = true;
        this.subPlace = this.pracRoom.id;
        this.pracRoom.come(this);
        this.pracRoom.start(level);
        this.pracRoom.game.hum = 1;
    };
    
    setRoom (room) {
        let $room = ROOM[this.place];

        if ($room) {
            if (!$room.gaming) {
                if ($room.master == this.id) {
                    $room.set(room);
                    publish('room', {target: this.id, room: $room.getData(), modify: true}, room.password);
                } else {
                    this.sendError(400);
                }
            }
        } else {
            this.sendError(400);
        }
    };
    
    applyEquipOptions (rw) {
        let $obj;
        let i, j;
        let pm = rw.playTime / 60000;

        rw._score = Math.round(rw.score);
        rw._money = Math.round(rw.money);
        rw._blog = [];
        this.checkExpire();
        for (i in this.equip) {
            $obj = DB.shop[this.equip[i]];
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
        if (rw.together && this.okgCount > 0) {
            i = 0.05 * this.okgCount;
            j = 0.05 * this.okgCount;

            rw.score += rw._score * i;
            rw.money += rw._money * j;
            rw._blog.push("kgEXP" + i);
            rw._blog.push("kgMNY" + j);
        }
        rw.score = Math.round(rw.score);
        rw.money = Math.round(rw.money);
    };
    
    obtain (k, {q, x, mx}) {
        if (this.guest) return;
        let data = {};
        // 기존 아이템의 구조 변경
        if (this.box[k] && Number.isInteger(this.box[k])) this.box[k] = {value: this.box[k]};
        if (this.box[k]) data = this.box[k];
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

        this.box[k] = data;

        this.send('obtain', {gain: [{key: k, q: q}], noref: true});
        // if (flush) this.flush(true);
    };
    
    addFriend (id) {
        let fd = DIC[id];

        if (!fd) return;
        this.friends[id] = fd.profile.title || fd.profile.name;
        this.flush(false, false, true);
        this.send('friendEdit', {friends: this.friends});
    };
    
    removeFriend (id) {
        DB.users.findOne(['_id', id]).limit(['friends', true]).on(($doc) => {
            if (!$doc) return;

            let f = $doc.friends;

            delete f[this.id];
            DB.users.update(['_id', id]).set(['friends', f]).on();
        });
        delete this.friends[id];
        this.flush(false, false, true);
        this.send('friendEdit', {friends: this.friends});
    };
};

export class Room {
    constructor (room, channel) {
        this.id = room.id || _rid;
        this.channel = channel;
        this.opts = {};
        /*my.title = room.title;
        this.password = room.password;
        this.limit = Math.round(room.limit);
        this.mode = room.mode;
        this.rule = RULE[GAME_TYPE[room.mode]];
        this.round = Math.round(room.round);
        this.time = room.time * my.rule.time;
        this.opts = {
            manner: room.opts.manner,
            extend: room.opts.injeong,
            mission: room.opts.mission,
            loanword: room.opts.loanword,
            injpick: room.opts.injpick || []
        };*/
        this.master = null;
        this.tail = [];
        this.players = [];
        this.kicked = [];
        this.kickVote = null;

        this.gaming = false;
        this.game = {};

        this.set(room);
    }

    getData () {
        let i, readies = {};
        let pls = [];
        let seq = this.game.seq ? this.game.seq.map(filterRobot) : [];
        let o;

        for (i in this.players) {
            if (o = DIC[this.players[i]]) {
                readies[this.players[i]] = {
                    r: o.ready || o.game.ready,
                    f: o.form || o.game.form,
                    t: o.team || o.game.team
                };
            }
            pls.push(filterRobot(this.players[i]));
        }
        return {
            id: this.id,
            channel: this.channel,
            title: this.title,
            password: !!this.password,
            limit: this.limit,
            mode: this.mode,
            round: this.round,
            time: this.time,
            master: this.master,
            lastTitle: this.lastTitle,
            players: pls,
            readies: readies,
            gaming: this.gaming,
            game: {
                round: this.game.round,
                turn: this.game.turn,
                seq: seq,
                title: this.game.title,
                mission: this.game.mission
            },
            practice: !!this.practice,
            opts: this.opts
        };
    };
    
    addAI (caller, level) {
        if (this.players.length >= this.limit) {
            return caller.sendError(429);
        }
        if (this.gaming) {
            return caller.send('error', {code: 416, target: this.id});
        }
        if (!this.rule.ai) {
            return caller.sendError(415);
        }
        this.players.push(new Robot(null, this.id, level));
        this.export();
    };
    
    setAI (target, level, team) {
        let i;

        for (i in this.players) {
            if (!this.players[i]) continue;
            if (!this.players[i].robot) continue;
            if (this.players[i].id == target) {
                this.players[i].setLevel(level);
                this.players[i].setTeam(team);
                this.export();
                return true;
            }
        }
        return false;
    };
    
    removeAI (target, noEx) {
        let i, j;

        for (i in this.players) {
            if (!this.players[i]) continue;
            if (!this.players[i].robot) continue;
            if (!target || this.players[i].id == target) {
                if (this.gaming) {
                    j = this.game.seq.indexOf(this.players[i]);
                    if (j != -1) this.game.seq.splice(j, 1);
                }
                this.players.splice(i, 1);
                if (!noEx) this.export();
                return true;
            }
        }
        return false;
    };
    
    come (client) {
        if (!this.practice) client.place = this.id;

        if (this.players.push(client.id) == 1) {
            this.master = client.id;
            this.lastTitle = client.id;
        }
        if (Cluster.isWorker) {
            client.ready = false;
            client.team = 0;
            client.cameWhenGaming = false;
            client.form = "J";

            if (!this.practice) process.send({type: "room-come", target: client.id, id: this.id});
            this.export(client.id);
        }
    };
    
    spectate (client, password) {
        if (!this.practice) client.place = this.id;
        let len = this.players.push(client.id);

        if (Cluster.isWorker) {
            client.ready = false;
            client.team = 0;
            client.cameWhenGaming = true;
            client.form = (len > this.limit) ? "O" : "S";

            process.send({type: "room-spectate", target: client.id, id: this.id, pw: password});
            this.export(client.id, false, true);
        }
    };
    
    go (client, kickVote) {
        let x = this.players.indexOf(client.id);
        let me;

        if (x == -1) {
            client.place = 0;
            if (this.players.length < 1) delete ROOM[this.id];
            return client.sendError(409);
        }
        this.players.splice(x, 1);
        client.game = {};
        if (client.id == this.master) {
            while (this.removeAI(false, true)) ;
            this.master = this.players[0];
        }
        if (DIC[this.master]) {
            DIC[this.master].ready = false;
            if (this.gaming) {
                x = this.game.seq.indexOf(client.id);
                if (x != -1) {
                    if (this.game.seq.length <= 2) {
                        this.game.seq.splice(x, 1);
                        this.roundEnd();
                    } else {
                        me = this.game.turn == x;
                        if (me && this.rule.ewq) {
                            clearTimeout(this.game._rrt);
                            this.game.loading = false;
                            if (Cluster.isWorker) this.turnEnd();
                        }
                        this.game.seq.splice(x, 1);
                        if (this.game.turn > x) {
                            this.game.turn--;
                            if (this.game.turn < 0) this.game.turn = this.game.seq.length - 1;
                        }
                        if (this.game.turn >= this.game.seq.length) this.game.turn = 0;
                    }
                }
            }
        } else {
            if (this.gaming) {
                this.interrupt();
                this.game.late = true;
                this.gaming = false;
                this.game = {};
            }
            delete ROOM[this.id];
        }
        if (this.practice) {
            clearTimeout(this.game.turnTimer);
            client.subPlace = 0;
        } else client.place = 0;

        if (Cluster.isWorker) {
            if (!this.practice) {
                client.socket.close();
                process.send({type: "room-go", target: client.id, id: this.id, removed: !ROOM.hasOwnProperty(this.id)});
            }
            this.export(client.id, kickVote);
        }
    };
    
    setTitle (title) {
        this.title = title;
    };
    
    set (room) {
        let i, k, ijc, ij;

        if (this.title !== room.title) this.lastTitle = this.master;
        this.title = room.title;
        this.password = room.password;
        this.limit = Math.max(Math.min(8, this.players.length), Math.round(room.limit));
        this.mode = room.mode;
        this.rule = RULE[GAME_TYPE[room.mode]];
        this.round = Math.round(room.round);
        this.time = room.time * this.rule.time;
        if (room.opts && this.opts) {
            for (i in OPTIONS) {
                k = OPTIONS[i].name.toLowerCase();
                this.opts[k] = room.opts[k] && this.rule.opts.includes(i);
            }
            if (ijc = this.rule.opts.includes("ijp")) {
                ij = IJP[this.rule.lang];
                this.opts.injpick = (room.opts.injpick || []).filter((item) => {
                    return ij.includes(item);
                });
            } else this.opts.injpick = [];
        }
        if (!this.rule.ai) {
            while (this.removeAI(false, true)) ;
        }
        for (i in this.players) {
            if (DIC[this.players[i]]) DIC[this.players[i]].ready = false;
        }
    };
    
    preReady (teams) {
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
                this._avTeam = shuffle(avTeam);
            }
        }
        // 인정픽 검사
        if (!this.rule) return 400;
        if (this.rule.opts.includes("ijp")) {
            if (!this.opts.injpick) return 400;
            if (!this.opts.injpick.length) return 413;
            if (!this.opts.injpick.every((item) => {
                return !IJP_EXCEPT.includes(item);
            })) return 414;
        }
        return false;
    };
    
    ready () {
        let i, all = true;
        let len = 0;
        let teams = [[], [], [], [], []];

        for (i in this.players) {
            if (this.players[i].robot) {
                len++;
                teams[this.players[i].game.team].push(this.players[i]);
                continue;
            }
            if (!DIC[this.players[i]]) continue;
            if (DIC[this.players[i]].form == "S") continue;

            len++;
            teams[DIC[this.players[i]].team].push(this.players[i]);

            if (this.players[i] == this.master) continue;
            if (!DIC[this.players[i]].ready) {
                all = false;
                break;
            }
        }
        if (!DIC[this.master]) return;
        if (len < 2) return DIC[this.master].sendError(411);
        if (i = this.preReady(teams)) return DIC[this.master].sendError(i);
        if (all) {
            this._teams = teams;
            this.start();
        } else DIC[this.master].sendError(412);
    };
    
    start (pracLevel) {
        let i, j, o, hum = 0;
        let now = (new Date()).getTime();
        this.game.event = EVENT_START < now && now < EVENT_UNTIL;

        this.gaming = true;
        this.game.late = true;
        this.game.round = 0;
        this.game.turn = 0;
        this.game.seq = [];
        this.game.robots = [];
        this.game.rev = false;
        if (this.practice) {
            this.game.robots.push(o = new Robot(this.master, this.id, pracLevel));
            this.game.seq.push(o, this.master);
        } else {
            for (i in this.players) {
                if (this.players[i].robot) {
                    this.game.robots.push(this.players[i]);
                } else {
                    if (!(o = DIC[this.players[i]])) continue;
                    if (o.form != "J") continue;
                    hum++;
                }
                if (this.players[i]) this.game.seq.push(this.players[i]);
            }
            if (!this.rule.ewq) {
                // 섞을 필요가 없다.
            } else if (this._avTeam) {
                o = this.game.seq.length;
                j = this._avTeam.length;
                this.game.seq = [];
                for (i = 0; i < o; i++) {
                    let v = this._teams[this._avTeam[i % j]].shift();

                    if (!v) continue;
                    this.game.seq[i] = v;
                }
            } else {
                this.game.seq = shuffle(this.game.seq);
            }
        }
        this.game.mission = null;
        this.game.initseq = this.game.seq;
        this.game.initusers = this.game.seq.filter( (u) => { return !u.robot } ) || [];
        for (i in this.game.seq) {
            o = DIC[this.game.seq[i]] || this.game.seq[i];
            if (!o) continue;
            if (!o.game) continue;

            o.playAt = now;
            o.ready = false;
            o.game.score = 0;
            o.game.bonus = 0;
            o.game.item = [/*0, 0, 0, 0, 0, 0*/];
            o.game.wpc = [];
            delete o.game.wpe;
            if (this.game.event || (EVENT_FORCE_FOR_ADMIN && o.admin)) {
                if (EVENT_WORDPIECE.IS_ENABLED) o.game.wpe = [];
            }
        }
        this.game.hum = hum;
        this.getTitle().then((title) => {
            this.game.title = title;
            this.export();
            setTimeout(runAs, 2000, this, this.roundReady);
        });
        this.byMaster('starting', {target: this.id});
        delete this._avTeam;
        delete this._teams;
        delete this.game.pool;
    };
    
    roundReady () {
        if (!this.gaming) return;
        if (!this.game.seq || this.game.seq.length < 2) return this.roundEnd();
        return this.route("roundReady");
    };
    
    interrupt () {
        clearTimeout(this.game._rrt);
        clearTimeout(this.game.turnTimer);
        clearTimeout(this.game.hintTimer);
        clearTimeout(this.game.hintTimer2);
        clearTimeout(this.game.qTimer);
    };
    
    roundEnd (data) {
        let i, o, rw;
        let res = [];
        let users = {};
        let rl;
        let pv = -1;
        let suv = [];
        let teams = [null, [], [], [], []];
        let sumScore = 0;
        let now = (new Date()).getTime();
        if (this.game === undefined) return;
        if (this.game.seq === undefined) return;
        if (this.game.robots === undefined) {
            this.game.robots = [];
            for (i in this.players) {
                if(this.players[i].robot) {
                    this.game.robots.push(this.players[i]);
                }
            }
        }

        this.interrupt();
        for (i in this.players) {
            o = DIC[this.players[i]];
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
        for (i in this.game.seq) {
            o = DIC[this.game.seq[i]] || this.game.seq[i];
            if (!o) continue;
            if (o.robot) {
                if (o.game.team) teams[o.game.team].push(o.game.score);
            } else if (o.team) teams[o.team].push(o.game.score);
        }
        for (i = 1; i < 5; i++) if (o = teams[i].length) teams[i] = [o, teams[i].reduce((p, item) => {
            return p + item;
        }, 0)];
        for (i in this.game.initseq) {
            let currscore = -1;
            o = DIC[this.game.initseq[i]];
            if (!o) continue;
            if (this.game.seq.indexOf(o.id) != -1) currscore = o.game.score
            if (currscore >= 0) sumScore += currscore;
            res.push({id: o.id, score: o.team ? teams[o.team][1] : currscore, dim: o.team ? teams[o.team][0] : 1});
        }
        res.sort((a, b) => {
            return b.score - a.score;
        });

        if (this.game.initusers === undefined) rl = 1;
        else rl = this.game.initusers.length;
        if ((this.game.seq.length - this.game.robots.length) < 2) rl = 1;

        for (i in res) {
            if (this.opts.rankmode && res[i].score === -1) continue;

            if (!this.opts.rankmode && DIC[res[i].id] === undefined) {
                DB.users.findOne(['_id', res[i].id]).on((user) => {
                    user.kkutu.record[this.mode][0]++
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
            rw = getRewards(this.mode, o.game.score / res[i].dim, o.game.bonus, res[i].rank, rl, sumScore);
            rw.playTime = now - o.playAt;
            o.applyEquipOptions(rw); // 착용 아이템 보너스 적용
            if (rw.together) {
                let isEvent = this.game.event || (EVENT_FORCE_FOR_ADMIN && o.admin);
                if (o.game.wpc) o.game.wpc.forEach((item) => {
                    o.obtain("$WPC" + item, {q: 1});
                }); // 글자 조각 획득 처리
                if (isEvent) { // 이벤트 보상 처리
                    let border;
                    if (o.game.wpe) o.game.wpe.forEach ((item) => { // 이벤트 글자 조각
                        o.obtain("$WPE" + item, {q: 1, x: EVENT_EXPIRE_AT, mx: true});
                    });
                    if (EVENT_POINT.IS_ENABLED) { // 이벤트 포인트
                        let pool = [0];
                        let add = 0;
                        for (border of EVENT_POINT.REWARD_BORDER) {
                            if (border <= pv) pool = EVENT_POINT.REWARD_AMOUNT[border];
                            else break;
                        }
                        rw.ep = pool[Math.floor(Math.random() * pool.length)] || 0
                        if (rw.ep) {
                            let amount = o.getFlag("eventPoint") + rw.ep;
                            o.setFlag("eventPoint", amount);
                            o.event.point = amount;

                            let total = o.getFlag("epTotal") + rw.ep;
                            o.setFlag("epTotal", total);
                            o.event.epTotal = amount;
                        }
                    }
                    if (EVENT_ITEMPIECE.IS_ENABLED) { // 이벤트 아이템 조각
                        let pool = [0]
                        for (border of EVENT_ITEMPIECE.REWARD_BORDER) {
                            if (border <= pv) pool = EVENT_ITEMPIECE.REWARD_AMOUNT[border];
                            else break;
                        }
                        let amount = pool[Math.floor(Math.random() * pool.length)] || 0;
                        while (amount--) {
                            let item = getWeightedRandom(EVENT_ITEMPIECE.PIECE_LIST);
                            o.obtain(item, {q: 1, x: EVENT_EXPIRE_AT, mx: true});
                        }
                    }
                }
                o.onOKG(rw.playTime);
            }

            res[i].reward = rw;
            o.data.score += rw.score || 0;
            o.money += rw.money || 0;
            o.data.record[GAME_TYPE[this.mode]][2] += rw.score || 0;
            o.data.record[GAME_TYPE[this.mode]][3] += rw.playTime;
            if (!this.practice && rw.together) {
                o.data.record[GAME_TYPE[this.mode]][0]++;
                if (res[i].rank == 0) o.data.record[GAME_TYPE[this.mode]][1]++;
                rewardRating(o, pv);
            }
            users[o.id] = o.getData();
            suv.push(o.flush(true, false, false, true));
        }
        LizardAll(suv).then((uds) => {
            let o = {};

            suv = [];
            for (i in uds) {
                o[uds[i].id] = {prev: uds[i].prev};
                suv.push(DB.redis.getSurround(uds[i].id));
            }
            LizardAll(suv).then((ranks) => {
                let i, j;

                for (i in ranks) {
                    if (!o[ranks[i].target]) continue;

                    o[ranks[i].target].list = ranks[i].data;
                }
                this.byMaster('roundEnd', {result: res, users: users, ranks: o, data: data}, true);
            });
        });
        this.gaming = false;
        this.export();
        delete this.game.seq;
        delete this.game.wordLength;
        delete this.game.dic;
    };
    
    byMaster (type, data, nob) {
        if (DIC[this.master]) DIC[this.master].publish(type, data, nob);
    };
    
    export (target, kickVote, spec) {
        let obj = {room: this.getData()};
        let i, o;

        if (!this.rule) return;
        if (target) obj.target = target;
        if (kickVote) obj.kickVote = kickVote;
        if (spec && this.gaming) {
            if (this.rule.rule == "Classic") {
                if (this.game.chain) obj.chain = this.game.chain.length;
            } else if (this.rule.rule == "Jaqwi") {
                obj.theme = this.game.theme;
                obj.conso = this.game.conso;
            } else if (this.rule.rule == "Crossword") {
                obj.prisoners = this.game.prisoners;
                obj.boards = this.game.boards;
                obj.means = this.game.means;
            }
            obj.spec = {};
            for (i in this.game.seq) {
                if (o = DIC[this.game.seq[i]]) obj.spec[o.id] = o.game.score;
            }
        }
        if (this.practice) {
            if (DIC[this.master || target]) DIC[this.master || target].send('room', obj);
        } else {
            publish('room', obj, this.password);
        }
    };
    
    turnStart (force) {
        if (!this.gaming) return;
        if (!this.game.seq || this.game.seq.length < 2) return this.roundEnd();
        return this.route("turnStart", force);
    };
    
    readyRobot (robot) {
        if (!this.gaming) return;

        return this.route("readyRobot", robot);
    };
    
    turnRobot (robot, text, data) {
        if (!this.gaming) return;

        this.submit(robot, text, data);
        //return this.route("turnRobot", robot, text);
    };
    
    turnNext (force) {
        if (!this.gaming) return;
        if (!this.game.seq) return;
        let additional = 0;
        if (this.game.queue) {
            /* queue가..
             * 1이면 다음 사람 건너뜀
             * -1이면 턴을 넘기지 않음
             */
            additional = this.game.queue;
            this.game.queue = 0;
        }
        if (this.game.rev) { // 역방향 진행인 경우
            this.game.turn = this.game.turn - 1 + this.game.seq.length - additional; // 인덱싱이 넘어가지 않도록
        } else {
            this.game.turn = this.game.turn + 1 + additional;
        }
        this.game.turn = this.game.turn % this.game.seq.length;
        this.turnStart(force);
    };
    
    turnEnd () {
        return this.route("turnEnd");
    };
    
    submit (client, text, data) {
        return this.route("submit", client, text, data);
    };
    
    useItem (client, id) {
        return this.route("useItem", client, id);
    }
    
    getScore (text, delay, ignoreMission) {
        return this.routeSync("getScore", text, delay, ignoreMission);
    };
    
    getTurnSpeed (rt) {
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
    
    getTitle () {
        return this.route("getTitle");
    };

    /*route (func, ...args){
        let cf;

        if(!(cf = this.checkRoute(func))) return;
        return Slave.run(this, func, args);
    };*/
    
    route (func, ...args) {
        let cf;

        if (!(cf = this.checkRoute(func))) return;
        return cf.apply(this, args);
    };

    routeSync (func, ...args) {
        let cf;

        if (!(cf = this.checkRoute(func))) return;
        return cf.apply(this, args);
    };
    
    checkRoute (func) {
        let c;

        if (!this.rule) return IOLog.warn("Unknown mode: " + this.mode), false;
        if (!(c = Rule[this.rule.rule])) return IOLog.warn("Unknown rule: " + this.rule.rule), false;
        if (!c[func]) return IOLog.warn("Unknown function: " + func), false;
        return c[func];
    };
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
    switch (GAME_TYPE[mode]) {
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
