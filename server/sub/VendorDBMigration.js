import * as IOLog from './KKuTuIOLog.js';

let database;

export function initDatabase (_database) {
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
            modifyOldUserId(oldUserId, userId, function (err) {
                if (!err) IOLog.info(`${oldUserId} 의 식별번호가 ${userId}(으)로 이전되었습니다.`);
                if (callback !== undefined) {
                    callback(!err);
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

    database.query(query, [userId, oldUserId], (err) => {
        if (err) {
            IOLog.error(`Error executing query ${err.stack}`);
            if (callback !== undefined) callback(err);
            return;
        }

        if (callback !== undefined) {
            callback();
        }
    })
}