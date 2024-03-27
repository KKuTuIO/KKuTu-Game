import * as IOLog from './KKuTuIOLog.js';
import * as DB from './db.js';
import * as KKuTu from "../game/kkutu.js";

import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const nickConf = JSON.parse(readFileSync(`${__dirname}/../config/nick.json`, 'utf8'));

const pattern = RegExp(nickConf.pattern['pattern'], nickConf.pattern['flags']['pattern']);
const bad = RegExp(nickConf.pattern['bad'], nickConf.pattern['flags']['bad']);
const black = RegExp(nickConf.pattern['black'], nickConf.pattern['flags']['black']);
const sPattern = RegExp(nickConf.pattern['similarity'], nickConf.pattern['flags']['similarity']);

const nickMin = nickConf.nick['min'];
const nickMax = nickConf.nick['max'];

const term = nickConf.nick['term'] * 24 * 60 * 60 * 1000;

export function processUserNickChange ($c, userNick, fixedNick, callback) {
    userNick = userNick ? userNick.trim() : undefined;
    fixedNick = fixedNick ? fixedNick : false;

    const userId = $c.id;

    if (!userId || !userNick) {
        callback(600);
        return
    }

    const length = userNick.length;

    if (length < nickMin || length > nickMax || length === 0 || isBlank(userNick)) {
        callback(600);
        return
    }
    if (!userNick.replace(' ', '').match(pattern)) {
        callback(601);
        return
    }

    if (userNick.replace(' ', '').toLowerCase().match(bad)) {
        callback(602);
        return
    }

    if (userNick.replace(' ', '').toLowerCase().match(black)) {
        callback(603);
        return
    }

    if(!fixedNick) userNick = userNick + "#" + userId.split("-")[1].substring(0, 5);

    DB.users.findOne(['_id', userId]).on(function ($body) {
        const currentNick = $body.nickname;
        const meanableNick = userNick.replace(sPattern, '').toLowerCase();

        const date = Date.now();

        if (currentNick === userNick) {
            callback(610);
            return;
        }

        if ($body.isLimitModifyNick) {
            callback(611);
            return;
        }

        if (!isChangeableNickname($body.lastModifiedNickAt)) {
            callback(612);
            return;
        }

        DB.users.findOne(['meanableNick', meanableNick]).on(function ($o) {
            if ($o) {
                if ($o.lastLoginAt > Date.now() + (1000 * 60 * 60 * 24 * 180)) {
                    callback(620);
                    return;
                } else {
                    if(1717200000000 > Date.now()) { // 2024년 6월 1일까지 임시 적용
                        callback(620);
                        return;
                    }

                    DB.users.update(['_id', $o['_id']]).set(['nickname', userNick + "#" + $o['_id'].split("-")[1].substring(0, 5)], ['meanableNick'], '');
                }
            }

            if($body.money < 500) {
                callback(621);
                return;
            }

            DB.users.update(['_id', userId]).set(['money', $body.money - 500], ['nickname', userNick], ['meanableNick', meanableNick], ['lastModifiedNickAt', date]).on();

            IOLog.info(`${userId}님이 별명을 변경하셨습니다. 기존: ${currentNick} / 신규: ${userNick}`);
            callback(630);

            $c.profile.title = userNick;
            KKuTu.publish('nickUpdate', {user: $c.getData()});
        })
    })
}

const isChangeableNickname = (nickChangeTime) => {
    const number = parseInt(nickChangeTime);
    return nickChangeTime === undefined
        || isNaN(number)
        || number + term < Date.now();
}

const isBlank = (str) => {
    return (!str || /^\s*$/.test(str));
}