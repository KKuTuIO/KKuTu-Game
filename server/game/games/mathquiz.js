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

import { Tail } from '../../sub/lizard.js';
import { DB, DIC, runAs, traverse } from './_common.js';

let LIST_LENGTH = 50;
let OPERATORS = ["＋", "－", "×", "÷"];
let MAX_NUMBER = 10;

export function getTitle() {
    let R = new Tail();
    let my = this;
    let i, j;

    let data = [];
    for (i = 0; i < my.round; i++) {
        let arr = [];
        for (j = 0; j < LIST_LENGTH; j++) {
            arr.push(generateMathProblem());
        }
        data.push(arr);
    }
    my.game.lists = data;
    my.game.answers = data.map(round => round.map(problem => calculateAnswer(problem)));
    
    R.go("①②③④⑤⑥⑦⑧⑨⑩");

    traverse.call(my, function (o) {
        o.game.spl = 0;
    });
    return R;
}

function generateMathProblem() {
    const num1 = Math.floor(Math.random() * (MAX_NUMBER + 1));
    const num2 = Math.floor(Math.random() * (MAX_NUMBER + 1));
    const operator = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
    
    if (operator === '÷') {
        if (num2 === 0) return `${num1} ＋ ${num2} = ?`;
        const adjustedNum1 = num2 * Math.floor(Math.random() * 10 + 1);
        return `${adjustedNum1} ${operator} ${num2} = ?`;
    }
    
    if (operator === '－' && num1 < num2) {
        return `${num2} ${operator} ${num1} = ?`;
    }
    
    return `${num1} ${operator} ${num2} = ?`;
}

function calculateAnswer(problem) {
    const expression = problem.split('=')[0].trim();
    const [leftStr, operator, rightStr] = expression.split(' ');
    const left = parseInt(leftStr);
    const right = parseInt(rightStr);
    
    switch (operator) {
        case '＋': return (left + right).toString();
        case '－': return (left - right).toString();
        case '×': return (left * right).toString();
        case '÷': return (left / right).toString();
        default: return "0";
    }
}

export function roundInfo(client) {
    // IOLog.info(client.id + "님이 게임 도중 입장하였습니다.");
    let my = this;
    client.send('roundReady', {
        round: my.game.round,
        list: my.game.clist,
        enter: true
    }, true);
}

export function roundReady() {
    let my = this;
    let scores = {};

    if (!my.game.lists || !my.game.answers) return;

    my.game.round++;
    my.game.roundTime = my.time * 1000;
    if (my.game.round <= my.round) {
        my.game.clist = my.game.lists.shift();
        my.game.alist = my.game.answers.shift();
        my.byMaster('roundReady', {
            round: my.game.round,
            list: my.game.clist
        }, true);
        setTimeout(runAs, 2400, my, my.turnStart);
    } else {
        traverse.call(my, function (o) {
            scores[o.id] = Math.round(o.game.spl / my.round);
        });
        my.roundEnd({scores: scores});
    }
}

export function turnStart() {
    let my = this;

    my.game.late = false;
    traverse.call(my, function (o) {
        o.game.miss = 0;
        o.game.index = 0;
        o.game.semi = 0;
    });
    my.game.qTimer = setTimeout(runAs, my.game.roundTime, my, my.turnEnd);
    my.byMaster('turnStart', {roundTime: my.game.roundTime}, true);
}

export function turnEnd() {
    let my = this;
    let spl = {};
    let sv;

    my.game.late = true;
    traverse.call(my, function (o) {
        sv = (o.game.semi + o.game.index - o.game.miss) / my.time * 60;
        spl[o.id] = Math.round(sv);
        o.game.spl += sv;
    });
    my.byMaster('turnEnd', {
        ok: false,
        speed: spl
    });
    my.game._rrt = setTimeout(runAs, (my.game.round == my.round) ? 3000 : 10000, my, my.roundReady);
}

export function submit(client, text) {
    let my = this;
    let score;

    if (!client.game) return;

    if (my.game.alist[client.game.index] === text) {
        score = my.getScore(my.game.clist[client.game.index], text, true);

        client.game.semi += score;
        client.game.score += score;
        client.publish('turnEnd', {
            target: client.id,
            ok: true,
            value: text,
            score: score,
            problem: my.game.clist[client.game.index]
        }, true);
    } else {
        score = my.getScore(my.game.clist[client.game.index], text, false);
        
        client.game.miss++;
        client.game.semi += score;
        client.game.score += score;
        if (client.game.semi < 0 || client.game.score < 0) {
            score = 0;
            if (client.game.semi < 0) client.game.semi = 0;
            if (client.game.score < 0) client.game.score = 0;
        }

        client.send('turnEnd', {
            target: client.id,
            error: true, 
            score: score,
            correctAnswer: my.game.alist[client.game.index],
            problem: my.game.clist[client.game.index]
        });
    }
    
    if (!my.game.clist[++client.game.index]) client.game.index = 0;
}

export function getScore(problem, answer, isCorrect) {
    let my = this;
    let difficulty = calculateDifficulty(problem);
    if (isCorrect) return Math.round(difficulty * 5);
    else return Math.round(-5 * difficulty);
}

function calculateDifficulty(problem) {
    const expression = problem.split('=')[0].trim();
    const [leftStr, operator, rightStr] = expression.split(' ');
    const left = parseInt(leftStr);
    const right = parseInt(rightStr);
    
    switch (operator) {
        case '+': return 1; break;
        case '-': return 1.2; break;
        case '*': return 1.4; break;
        case '/': return 1.6; break;
        default: return 1;
    }
}