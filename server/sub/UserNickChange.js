import * as IOLog from './KKuTuIOLog.js';
import * as DB from './db.js';
import * as KKuTu from "../game/kkutu.js";

import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const nickConf = JSON.parse(readFileSync(`${__dirname}/../config/nick.json`, 'utf8'));

const pattern = RegExp(nickConf.pattern['pattern'], nickConf.pattern['flags']['pattern']),
badpatterns = nickConf.pattern['bad'],
badflag = nickConf.pattern['flags']['bad'],
badList = badpatterns.map(pattern => new RegExp(pattern, badflag)),
black = RegExp(nickConf.pattern['black'], nickConf.pattern['flags']['black']),
sPattern = RegExp(nickConf.pattern['similarity'], nickConf.pattern['flags']['similarity']);

const nickMin = nickConf.nick['min'],
nickMax = nickConf.nick['max'];

const term = nickConf.nick['term'] * 24 * 60 * 60 * 1000;

export async function processUserNickChange ($c, userNick, fixedNick) {
    userNick = userNick ? userNick.trim() : undefined;
    fixedNick = fixedNick ? fixedNick : false;

    const userId = $c.id;

    if (!userId || !userNick) {
        return 600
    }

    const length = userNick.length;

    if (length < nickMin || length > nickMax || length === 0 || isBlank(userNick)) {
        return 600
    }
    if (!userNick.replace(' ', '').match(pattern)) {
        return 601
    }

    const userNick_rep = userNick.replace(sPattern, '').toLowerCase();

    for (const bad of badList) {
        if (userNick_rep.match(bad)) {
            return 602
        }
    }

    if (userNick_rep.match(black)) {
        return 603
    }

    if(!fixedNick) userNick = userNick + "#" + userId.split("-")[1].substring(0, 5);

    try {
        const $body = await DB.users.findOne(['_id', userId]).on();
        if (!$body) {
            IOLog.warn(`유저를 찾을 수 없습니다. (${userId})`);
            return 500;
        }
        const currentNick = $body.nickname;
        const meanableNick = userNick.replace(sPattern, '').toLowerCase();
        const currentDate = Date.now();

        if (currentNick === userNick) {
            return 610
        }

        if ($body.isLimitModifyNick) {
            return 611;
        }

        if (!isChangeableNickname($body.lastModifiedNickAt)) {
            return 612;
        }

        const $o = await DB.users.findOne(['meanableNick', meanableNick]).on();
        if ($o) {
            const lastLogin = parseInt($o.lastLogin) || 0;
            const sixMonths = 1000 * 60 * 60 * 24 * 180;

            if (lastLogin + sixMonths > currentDate) {
                return 620;
            } else {
                if ($o['_id'].startsWith('facebook-') && 1733011200000 > currentDate) { // 2024년 12월 1일까지 유예
                    return 621;
                }

                await DB.users.update(['_id', $o['_id']]).set(['nickname', userNick + "#" + $o['_id'].split("-")[1].substring(0, 5)], ['meanableNick', '']).on();
            }
        }

        if(fixedNick && !$c.membership && $body.money < 100) {
            return 407;
        }

        await DB.users.update(['_id', userId]).set(['money', fixedNick ? ($c.membership ? $body.money : $body.money - 100) : $body.money], ['nickname', userNick], ['meanableNick', meanableNick], ['lastModifiedNickAt', currentDate]).on();

        IOLog.info(`${userId}님이 별명을 변경하셨습니다. 기존: ${currentNick} / 신규: ${userNick}`);

        $c.profile.title = userNick;
        KKuTu.publish('nickUpdate', {user: $c.getData()});

        return 630;
    } catch (e) {
        IOLog.error("닉네임 변경 중 오류:", e)
        return 500;
    }
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