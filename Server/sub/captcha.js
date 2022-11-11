import fetch, { FormData } from 'node-fetch'
import GLOBAL from "./global.json" assert { type: "json" };

export default async function verifyCaptcha (responseToken, remoteIp, callback) {
    // const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${GLOBAL.CAPTCHA_SECRET_KEY}&response=${responseToken}&remoteip=${remoteIp}`;
    const verifyUrl = `https://challenges.cloudflare.com/turnstile/v0/siteverify`;
    const formData = new FormData();
    formData.set('secret', GLOBAL.CAPTCHA_SECRET_KEY);
    formData.set('response', responseToken);
    formData.set('remoteip', remoteIp);

    const response = await fetch(verifyUrl, { method: 'POST', body: formData })
    const data = await response.json()

    try {
        const responseBody = JSON.parse(data);
        callback(responseBody.success);
    } catch (e) {
        callback(false);
    }
}