import request from 'request';
import GLOBAL from "./global.json" assert { type: "json" };

export default function verifyRecaptcha (responseToken, remoteIp, callback) {
    const verifyUrl = `https://google.com/recaptcha/api/siteverify?secret=${GLOBAL.GOOGLE_RECAPTCHA_SECRET_KEY}&response=${responseToken}&remoteip=${remoteIp}`;
    request(verifyUrl, (err, response, body) => {
        try {
            const responseBody = JSON.parse(body);
            callback(responseBody.success);
        } catch (e) {
            callback(false);
        }
    });
}