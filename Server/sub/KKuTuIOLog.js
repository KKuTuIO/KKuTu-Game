import * as winston from 'winston';
await import('winston-daily-rotate-file');

const {combine, timestamp, printf, colorize} = winston.format;
const colorizer = colorize();

/*
0       Emergency: system is unusable
1       Alert: action must be taken immediately
2       Critical: critical conditions
3       Error: error conditions
4       Warning: warning conditions
5       Notice: normal but significant condition
6       Informational: informational messages
7       Debug: debug-level messages
 */
const customLevels = {
    levels: {
        emerg: 0,
        alert: 1,
        crit: 2,
        error: 3,
        warn: 4,
        notice: 5,
        info: 6,
        debug: 7
    },
    colors: {
        emerg: 'redBG white',
        alert: 'redBG white',
        crit: 'red',
        error: 'red bold',
        warn: 'yellow',
        notice: 'cyan',
        info: 'grey',
        debug: 'magenta'
    }
};

winston.addColors(customLevels.colors);

const logger = winston.createLogger({
    level: 'debug',
    levels: customLevels.levels,
    transports: [
        new winston.transports.Console({
            format: combine(
                timestamp({format: 'HH:mm:ss'}),
                printf(({label, timestamp, level, message}) => {
                    return `[${timestamp}]${colorizer.colorize(level, `[${(global.serverIdentity + '').toUpperCase()}/${level.toUpperCase()}]: ${message}`)}`;
                })
            )
        }),
        new winston.transports.DailyRotateFile({
            filename: './logs/game/game-%DATE%.log',
            datePattern: 'YYYY-MM-DD HH',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '100d',
            tailable: true,
            format: combine(
                timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
                printf(({label, timestamp, level, message}) => {
                    return `[${timestamp}][${(global.serverName + '-' + global.serverIdentity).toUpperCase()}/${level.toUpperCase()}]: ${message}`;
                })
            )
        }),
        new winston.transports.DailyRotateFile({
            level: 'error',
            filename: './logs/error/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD HH',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '100d',
            tailable: true,
            format: combine(
                timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
                printf(({label, timestamp, level, message}) => {
                    return `[${timestamp}][${(global.serverName + '-' + global.serverIdentity).toUpperCase()}/${level.toUpperCase()}]: ${message}`;
                })
            )
        })
    ],
    exitOnError: false
});

export function emerg (text) {
    logger.emerg(text);
}
export function alert (text) {
    logger.alert(text);
}
export function crit (text) {
    logger.crit(text);
}
export function error (text) {
    logger.error(text);
}
export function warn (text) {
    logger.warn(text);
}
export function notice (text) {
    logger.notice(text);
}
export function info (text) {
    logger.info(text);
}
export function debug (text) {
    logger.debug(text);
}