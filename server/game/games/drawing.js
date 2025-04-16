/**
 * Rule the words! KKuTu Online
 * Copyright (C) 2017 JJoriping(op@jjo.kr)
 * Copyright (C) 2018 dalbodeule(webmaster@mori.space)
 * Copyright (C) 2018 Dohoon Kim(op@kdh.io)
 * Copyright (C) 2024 KKuTuIO(admin@kkutu.io)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Tail } from '../../sub/lizard.js';
import { DB, DIC, runAs, KOR_GROUP, INIT_SOUNDS, getTheme } from './_common.js';

export function getTitle (){
    const R = new Tail();
    const my = this;

    my.game.done = [];
    setTimeout(function(){
        R.go("①②③④⑤⑥⑦⑧⑨⑩");
    }, 500);
    return R;
};

export function roundInfo (client) {
    // IOLog.info(client.id + "님이 게임 도중 입장하였습니다.");
    let my = this;
    client.send('roundReady', {
        round: my.game.round,
        theme: my.game.theme,
        painter: my.game.painter,
        length: my.game.answer._id.length,
        enter: true
    }, true);
}

export function roundReady (){
    const my = this;
    let ijl = my.opts.injpick.length;

    function getRandomIntInclusive(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    clearTimeout(my.game.qTimer);
    clearTimeout(my.game.hintTimer);
    clearTimeout(my.game.hintTimer2);
    my.game.themeBonus = 0.3 * Math.log(0.6 * ijl + 1);
    my.game.winner = [];
    my.game.giveup = [];
    my.game.round++;
    my.game.roundTime = my.time * 1000;
    my.game.fullImageString = "";
    if (my.game.round <= my.round) {
        my.game.theme = getTheme.call(my);
        getAnswer.call(my, my.game.theme).then(function($ans){
            if(!my.game.done) return;

            // $ans가 null이면 골치아프다...
            my.game.late = false;
            my.game.answer = $ans || {};
            my.game.done.push($ans._id);
            $ans.mean = ($ans.mean.length > 20) ? $ans.mean : getConsonants($ans._id, Math.round($ans._id.length / 2));
            my.game.hint = getHint($ans, my.game.theme);
            if(my.opts.order) {
                if (my.game.turn === undefined) {
                    my.game.turn = 0;
                    // console.debug("initTurn", my.game.turn);
                } else {
                    my.game.turn += 1;
                    // console.debug("turnAdd", my.game.turn, my.game.seq.length);
                    if(my.game.turn >= my.game.seq.length) my.game.turn = 0;
                }
                my.game.painter = my.game.seq[my.game.turn];
            } else {
                if(my.game.seq) {
                    my.game.painter = my.game.firstWinner ? my.game.firstWinner : my.game.seq[getRandomIntInclusive(0, my.game.seq.length - 1)];
                } else my.roundEnd();
            }
            my.game.firstWinner = null;
            my.byMaster('roundReady', {
                round: my.game.round,
                theme: my.game.theme,
                length: my.game.answer._id.length,
                painter: my.game.painter
            }, true);
            setTimeout(runAs, 2400, my, my.turnStart);
        });
    } else {
        my.roundEnd();
    }
};

export function turnStart (){
    const my = this;
    let i;

    if(!my.game.answer) return;

    my.game.conso = getConsonants(my.game.answer._id, 1);
    my.game.roundAt = (new Date()).getTime();
    my.game.meaned = 0;
    my.game.primary = 0;
    my.game.qTimer = setTimeout(runAs, my.game.roundTime, my, my.turnEnd);
    my.game.hintTimer = setTimeout(function(){ turnHint.call(my); }, my.game.roundTime * 0.4);
    my.game.hintTimer2 = setTimeout(function(){ turnHint.call(my); }, my.game.roundTime * 0.8);

    my.byMaster('turnStart', {
        roundTime: my.game.roundTime,
        theme: my.game.theme
    }, true);

    let target = DIC[my.game.painter];
    if (target && target.send) {
        target.send('drawingContent', {
            word: my.game.answer._id,
            theme: my.game.theme
        }, true);
    }
};
function turnHint(){
    const my = this;
    if (my.game.hint && !my.opts.removehint) {
        my.byMaster('turnHint', {
            hint: my.game.hint[my.game.meaned++]
        }, true);
    }
}

export function turnEnd(){
    const my = this;

    if(my.game.answer) {
        my.game.late = true;
        my.byMaster('turnEnd', {
            answer: my.game.answer ? my.game.answer._id : ""
        });
    }

    my.game._rrt = setTimeout(runAs, 2500, my, my.roundReady);
};

export function submit(client, text){
    const my = this;
    let score, t, i;
    let $ans = my.game.answer;
    let now = (new Date()).getTime();
    let play = (my.game.seq ? my.game.seq.includes(client.id) : false) || client.robot;
    let gu = my.game.giveup ? my.game.giveup.includes(client.id) : true;

    if(!my.game.winner) return;
    if(my.game.winner.indexOf(client.id) == -1
        && text == $ans._id
        && play && !gu
    ){
        t = now - my.game.roundAt;
        if(my.game.primary == 0) if(my.game.roundTime - t > 10000) { // 가장 먼저 맞힌 시점에서 10초 이내에 맞히면 점수 약간 획득
            clearTimeout(my.game.qTimer);
            my.game.qTimer = setTimeout(runAs, 10000, my, my.turnEnd);
        }

        clearTimeout(my.game.hintTimer);
        clearTimeout(my.game.hintTimer2);

        score = my.getScore(text, t);
        my.game.primary++;
        my.game.winner.push(client.id);
        if(!my.game.firstWinner) {
            my.game.firstWinner = client.id;
        }
        client.game.score += score;
        client.publish('turnEnd', {
            target: client.id,
            ok: true,
            value: text,
            score: score,
            bonus: 0
        }, true);
        client.invokeWordPiece(text, 0.9);
        if (!my.opts.removehint) {
            while(my.game.meaned < my.game.hint.length) {
                turnHint.call(my);
            }
        }
    }else if(play && !gu && (text == "gg" || text == "ㅈㅈ")){
        my.game.giveup.push(client.id);
        client.publish('turnEnd', {
            target: client.id,
            giveup: true
        }, true);
    }else{
        client.chat(text);
    }
    if(play) if(my.game.primary + my.game.giveup.length + 1 >= my.game.seq.length){
        clearTimeout(my.game.hintTimer);
        clearTimeout(my.game.hintTimer2);
        clearTimeout(my.game.qTimer);
        my.game.fullImageString = ""
        my.turnEnd();
    }
};

export function getScore(text, delay){
    const my = this;
    let rank = my.game.hum - my.game.primary + 3;
    let tr = 1 - delay / my.game.roundTime;
    let score = 30 * Math.pow(rank, 1.4) * ( 0.5 + 0.5 * tr );

    return Math.round(score * my.game.themeBonus);
};

function getConsonants(word, lucky){
    let R = "";
    let i, len = word.length;
    let c;
    let rv = [];

    lucky = lucky || 0;
    while(lucky > 0){
        c = Math.floor(Math.random() * len);
        if(rv.includes(c)) continue;
        rv.push(c);
        lucky--;
    }
    for(let i=0; i<len; i++){
        c = /[가-힣a-zA-Z]/.test(word.charAt(i));

        if(!c || rv.includes(i)){
            R += word.charAt(i);
            continue;
        } else {
            if(/[가-힣]/.test(word.charAt(i))) {
                c = Math.floor((word.charCodeAt(i)  - 44032) / 588);
            } else {
                c = INIT_SOUNDS.length - 1
            }
        }
        R += INIT_SOUNDS[c];
    }
    return R;
}

function getHint($ans, theme){
    let R = [];
    let h1 = $ans.mean.replace(new RegExp($ans._id, "g"), "★");
    let h2;

    R.push([theme]);
    R.push(getConsonants($ans._id, Math.ceil($ans._id.length / 2)));

    R.push(h1);
    do{
        h2 = getConsonants($ans._id, Math.ceil($ans._id.length / 2));
    }while(h1 == h2);
    R.push(h2);

    return R;
}

function getAnswer(theme, nomean){
    const my = this;
    const R = new Tail();
    if(my.rule.lang == 'ko') {
        let args = [ [ '_id', { $nin: my.game.done } ] ];

        args.push([ 'theme', new RegExp("(,|^)(" + theme + ")(,|$)") ]);
        args.push([ 'type', KOR_GROUP ]);
        args.push([ 'flag', { $lte: 7 } ]);
        if (!my.opts.unlimited) {
            if (my.opts.short) {
                args.push([ 'length(_id)', { $gte: 1}]);
                args.push([ 'length(_id)', { $lte: 4}]);
            } else {
                args.push([ 'length(_id)', { $gte: 2}]);
                args.push([ 'length(_id)', { $lte: 10}]);
            }
        }
        DB.kkutu['ko'].find.apply(my, args).on(function($res){
            if(!$res) return R.go(null);
            let pick;
            let len = $res.length;

            if (!len) return R.go(null);
            do{
                pick = Math.floor(Math.random() * len);
                if($res[pick]._id.length >= 2) if($res[pick].type == "INJEONG" || $res[pick].mean.length >= 0){
                    return R.go($res[pick]);
                }
                $res.splice(pick, 1);
                len--;
            }while(len > 0);
            R.go(null);
        });
        return R;
    } else if(my.rule.lang == 'en') {
        let args = [ [ '_id', { $nin: my.game.done } ] ];

        args.push([ 'theme', new RegExp("(,|^)(" + theme + ")(,|$)") ]);
        if (!my.opts.unlimited) {
            if (my.opts.short) {
                args.push([ 'length(_id)', { $gte: 2}]);
                args.push([ 'length(_id)', { $lte: 8}]);
            } else {
                args.push([ 'length(_id)', { $gte: 4}]);
                args.push([ 'length(_id)', { $lte: 16}]);
            }
        }
        DB.kkutu['en'].find.apply(my, args).on(function($res){
            if(!$res) return R.go(null);
            let pick;
            let len = $res.length;

            if(!len) return R.go(null);
            do{
                pick = Math.floor(Math.random() * len);
                if($res[pick]._id.length >= 2) if($res[pick].type == "INJEONG" || $res[pick].mean.length >= 0){
                    return R.go($res[pick]);
                }
                $res.splice(pick, 1);
                len--;
            }while(len > 0);
            R.go(null);
        });
        return R;
    }
}