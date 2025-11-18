import * as IOLog from './KKuTuIOLog.js';

let database;

export function initDatabase(_database) {
    database = _database;
}

export function processVendorMigration(userId, callback) {
    if (!userId || userId.indexOf('-') === -1) {
        if (callback) callback(false);
        return;
    }

    let oldUserId = userId.split('-')[1];

    hasUser(oldUserId, function (result) {
        if (result) {
            modifyOldUserId(oldUserId, userId, function (err, result) {
                if (!err && result && result.rowCount > 0) {
                    IOLog.info(`[Migration] ${oldUserId}의 식별번호가 ${userId}(으)로 이전되었습니다.`);
                    if (callback) callback(true);

                } else if (err && err.code === '23505') {
                    IOLog.warn(`[Migration] ${userId} 계정이 이미 존재합니다. ${oldUserId} 데이터와 합산을 시도합니다.`);

                    mergeAccounts(oldUserId, userId, function (mergeSuccess) {
                        if (callback) callback(mergeSuccess);
                    });

                } else {
                    if (err) IOLog.error(`Migration Error: ${err.stack}`);
                    if (callback) callback(false);
                }
            });
        } else {
            if (callback !== undefined) callback(false);
        }
    });
}

function hasUser(userId, callback) {
    const query = "SELECT _id FROM users WHERE _id = $1";

    database.query(query, [userId], (err, result) => {
        if (err) {
            IOLog.error(`Error executing query ${err.stack}`);
            if (callback !== undefined) callback(false);
            return;
        }

        if (callback !== undefined) {
            callback(result && result.rows && result.rows.length === 1);
        }
    })
}

function modifyOldUserId(oldUserId, userId, callback) {
    const query = "UPDATE users SET _id = $1 WHERE _id = $2";
    database.query(query, [userId, oldUserId], callback);
}

function mergeAccounts(oldId, newId, callback) {
    const query = "SELECT _id, money, kkutu, box, equip, flags FROM users WHERE _id IN ($1, $2)";

    database.query(query, [oldId, newId], (err, res) => {
        if (err || res.rows.length < 2) {
            IOLog.error(`[Migration] ${newId} 계정을 불러오는 도중 문제가 발생하였습니다: ${err ? err.stack : '계정 정보 없음'}`);
            return callback(false);
        }

        const userA = res.rows[0];
        const userB = res.rows[1];
        const oldUser = userA._id === oldId ? userA : userB;
        const newUser = userA._id === newId ? userA : userB;

        // --- 1. Money 합산 ---
        const mergedMoney = (BigInt(newUser.money || 0) + BigInt(oldUser.money || 0)).toString();

        // --- 2. Box 합산 ---
        const newBox = newUser.box || {};
        const newFlags = newUser.flags || {};
        const oldBox = oldUser.box || {};
        const oldEquip = oldUser.equip || {};
        const itemsToAdd = {};

        for (const [itemId, itemData] of Object.entries(oldBox)) {
            // expire(기간제) 아이템은 합산 제외
            if (itemData && typeof itemData === 'object' && itemData.expire) {
                continue;
            }

            let count = 0;
            if (typeof itemData === 'number') {
                count = itemData;
            } else if (itemData && typeof itemData === 'object') {
                count = itemData.value || 0;
            }

            for (const [key, value] of Object.entries(oldEquip)) {
                if (value === itemId) {
                    count += 1;
                }
            }

            if (count <= 0) count = 1;
            itemsToAdd[itemId] = (itemsToAdd[itemId] || 0) + count;
        }

        // 아이템 합산
        for (const [itemId, count] of Object.entries(itemsToAdd)) {
            if (!newBox[itemId]) {
                newBox[itemId] = { value: 0 };
            }

            // 기존 값 가져오기
            let currentVal = newBox[itemId].value || 0;
            if (currentVal < 0) currentVal = 1;

            // 합산 적용
            newBox[itemId].value = currentVal + count;
        }

        // --- 4. Kkutu 합산 ---
        const newKkutu = newUser.kkutu || {};
        const oldKkutu = oldUser.kkutu || {};

        newKkutu.score = (newKkutu.score || 0) + (oldKkutu.score || 0);

        if (oldKkutu.record) {
            if (!newKkutu.record) newKkutu.record = {};

            for (const [mode, stats] of Object.entries(oldKkutu.record)) {
                if (Array.isArray(stats)) {
                    if (!newKkutu.record[mode]) {
                        newKkutu.record[mode] = stats.slice();
                    } else {
                        const newStats = newKkutu.record[mode];
                        for (let i = 0; i < stats.length; i++) {
                            const oldVal = parseInt(stats[i]) || 0;
                            const newVal = parseInt(newStats[i]) || 0;
                            newStats[i] = newVal + oldVal;
                        }
                    }
                }
            }
        }

        newFlags["vendorMigrate"] = {
            value: 1,
            time: Math.floor(new Date().getTime() / 1000)
        };

        // DB 업데이트 (items -> box)
        const updateQuery = "UPDATE users SET money = $1, kkutu = $2, box = $3, flags = $4 WHERE _id = $5";
        database.query(updateQuery, [mergedMoney, newKkutu, newBox, newFlags, newId], (updateErr) => {
            if (updateErr) {
                IOLog.error(`[Merge] 계정 데이터 합산에 실패하였습니다: ${updateErr.stack}`);
                return callback(false);
            }

            const deleteQuery = "DELETE FROM users WHERE _id = $1";
            database.query(deleteQuery, [oldId], (deleteErr) => {
                if (!deleteErr) {
                    IOLog.info(`[Merge] ${oldId} 계정과 ${newId} 계정이 합산 처리되었습니다.`);
                }
                callback(true);
            });
        });
    });
}