import fetch, { FormData } from 'node-fetch'
import { CAPTCHA_SECRET_KEY } from "../config.js"

export function verifyCaptcha (responseToken, remoteIp, callback) {
    /* const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${CAPTCHA_SECRET_KEY}&response=${responseToken}&remoteip=${remoteIp}`; */
    const verifyUrl = `https://challenges.cloudflare.com/turnstile/v0/siteverify`;
    const formData = new FormData();
    formData.set('secret', CAPTCHA_SECRET_KEY);
    formData.set('response', responseToken);
    formData.set('remoteip', remoteIp);

    fetch(verifyUrl, { method: 'POST', body: formData }).then(safeParseResponse)

    async function safeParseResponse(response) {
        const body = await response.text();
        try {
            const responseBody = JSON.parse(body);
            callback(responseBody.success);
        } catch (err) {
            callback(false);
        }
    }
}