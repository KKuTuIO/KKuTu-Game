import * as IOLog from './KKuTuIOLog.js';

let database;

export function initDatabase (_database) {
    database = _database;
}

export function checkBlockUser(id, callback) {
    let query = "SELECT * FROM block_user WHERE user_id=$1;";

    database.query(query, [id], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }

        if (callback === undefined) {
            return;
        }

        let rows = result.rows;
        if (rows.length === 0) {
            callback({
                block: false
            });
            return;
        }

        let row = rows[0];

        let resultJson = {
            block: true,
            id: row.id,
            time: row.time,
            pardonTime: row.pardon_time,
            reason: row.reason,
            punishFrom: row.punish_from,
            admin: row.admin
        };

        if (resultJson.pardonTime === null) {
            resultJson.permanency = true;
        } else {
            resultJson.permanency = false;

            if (isPardon(resultJson.pardonTime)) {
                removeBlockUser(resultJson.id);
                addPardonBlockUserLog(id, resultJson.id, resultJson.time, resultJson.pardonTime, resultJson.reason, resultJson.punishFrom, resultJson.admin);

                resultJson = {
                    block: false
                };
            }
        }

        callback(resultJson);
    })
}

export function checkBlockIp(ipAddress, callback) {
    let query = "SELECT * FROM block_ip WHERE ip_address=$1;";

    database.query(query, [ipAddress], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }

        if (callback === undefined) {
            return;
        }

        let rows = result.rows;
        if (rows.length === 0) {
            callback({
                block: false
            });
            return;
        }

        let row = rows[0];

        let resultJson = {
            block: true,
            id: row.id,
            time: row.time,
            pardonTime: row.pardon_time,
            reason: row.reason,
            punishFrom: row.punish_from,
            onlyGuestPunish: row.only_guest_punish,
            admin: row.admin
        };

        if (resultJson.pardonTime === null) {
            resultJson.permanency = true;
        } else {
            resultJson.permanency = false;

            if (isPardon(resultJson.pardonTime)) {
                removeBlockIp(resultJson.id);
                addPardonBlockIpLog(ipAddress, resultJson.id, resultJson.time, resultJson.pardonTime, resultJson.reason, resultJson.punishFrom, resultJson.admin);

                resultJson = {
                    block: false
                };
            }
        }

        callback(resultJson);
    })
}

export function checkBlockChat(id, callback) {
    let query = "SELECT * FROM block_chat WHERE user_id=$1;";

    database.query(query, [id], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }

        if (callback === undefined) {
            return;
        }

        let rows = result.rows;
        if (rows.length === 0) {
            callback({
                block: false
            });
            return;
        }

        let row = rows[0];

        let resultJson = {
            block: true,
            id: row.id,
            time: row.time,
            pardonTime: row.pardon_time,
            reason: row.reason,
            punishFrom: row.punish_from,
            admin: row.admin
        };

        if (resultJson.pardonTime === null) {
            resultJson.permanency = true;
        } else {
            resultJson.permanency = false;

            if (isPardon(resultJson.pardonTime)) {
                removeBlockChat(resultJson.id);
                addPardonBlockChatLog(id, resultJson.id, resultJson.time, resultJson.pardonTime, resultJson.reason, resultJson.punishFrom, resultJson.admin);

                resultJson = {
                    block: false
                };
            }
        }

        callback(resultJson);
    })
}

function isPardon(pardonTime) {
    return new Date(pardonTime).getTime() < new Date().getTime();
}

const removeBlockUser = (caseId) => {
    let query = "DELETE FROM block_user WHERE id=$1";

    database.query(query, [caseId], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }
    })
}

const removeBlockIp = (caseId) => {
    let query = "DELETE FROM block_ip WHERE id=$1";

    database.query(query, [caseId], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }
    })
}

const removeBlockChat = (caseId) => {
    let query = "DELETE FROM block_chat WHERE id=$1";

    database.query(query, [caseId], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }
    })
}

const addPardonBlockUserLog = (userId, caseId, time, pardonTime, reason, punishFrom, admin) => {
    let query = "INSERT INTO block_log (log_time, log_type, block_type, user_id, case_id, ip_address, block_time, pardon_time, reason, punish_from, admin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)";

    database.query(query, [new Date(), 'AUTO_REMOVE', 'USER', userId, caseId, null, time, pardonTime, reason, punishFrom, admin], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }
    })
}

const addPardonBlockIpLog = (ipAddress, caseId, time, pardonTime, reason, punishFrom, admin) => {
    let query = "INSERT INTO block_log (log_time, log_type, block_type, user_id, case_id, ip_address, block_time, pardon_time, reason, punish_from, admin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)";

    database.query(query, [new Date(), 'AUTO_REMOVE', 'IP', null, caseId, ipAddress, time, pardonTime, reason, punishFrom, admin], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }
    })
}

const addPardonBlockChatLog = (userId, caseId, time, pardonTime, reason, punishFrom, admin) => {
    let query = "INSERT INTO block_log (log_time, log_type, block_type, user_id, case_id, ip_address, block_time, pardon_time, reason, punish_from, admin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)";

    database.query(query, [new Date(), 'AUTO_REMOVE', 'CHAT', userId, caseId, null, time, pardonTime, reason, punishFrom, admin], (err, result) => {
        if (err) {
            return IOLog.error(`Error executing query ${err.stack}`);
        }
    })
}