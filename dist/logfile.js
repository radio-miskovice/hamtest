"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLogs = void 0;
const path = require("path");
const fs = require("fs");
const cabrillo_1 = require("./cabrillo");
const settings = require("./settings.json");
const TEMPLATE = require("./cabrillo-templates.json");
const database_1 = require("./database");
const GET_CONTEST_KEY = "select CTST_PK from contest where CTST_NAME = $1 ";
const INSERT_LOG_HEADER = "insert into LOGFILE (CTST_PK, LOGF_FILENAME, UPLOADED_TS, CALLSIGN, NOTE) values ($1, $2, now(), $3, $4) returning LOGF_PK";
const INSERT_QSO = "insert into QSO (LOGF_PK, LOGF_FILENAME, UPLOADED_TS, CALLSIGN, NOTE) values ($1, $2, now(), $3, $4) returning LOGF_PK";
async function addLogs(argv) {
    console.log("in add log");
    if (argv.length < 2) {
        console.log(`'add log' action expects at least two parameters, contest ID and at least one log file name. Got ${argv.length}`);
        process.exit(1);
    }
    const contestId = argv.shift();
    const db = database_1.getDatabaseClient();
    try {
        await db.connect();
    }
    catch (e) {
        console.log(`${e.toString()} in add log, connecting database`);
    }
    let contestKey;
    try {
        const res = await db.query(GET_CONTEST_KEY, [contestId]);
        if (res.rowCount < 1) {
            console.log(`Contest key for contest ${contestId} not found in database.`);
            return;
        }
        contestKey = res.rows[0].ctst_pk;
    }
    catch (e) {
        console.log(`${e.toString()} in add log, looking up contest key for ${contestId}`);
    }
    let recNum = 0;
    while (contestKey && argv.length > 0) {
        const logfile = argv.shift();
        const cbrLog = prepareLog(logfile);
        // create logfile header
        try {
            await db.query('begin');
            const res = await db.query(INSERT_LOG_HEADER, [contestKey, logfile, cbrLog.callsign, cbrLog.email]);
            if (res.rowCount < 1) {
                console.log(`Could not create log file header in database for file '${logfile}'. Giving up this file.`);
                continue;
            }
            const headerKey = parseInt(res.rows[0].logf_pk);
            for (const rec of cbrLog.dataArray) {
                recNum++;
                rec.logf_pk = headerKey;
                const fields = Object.keys(rec);
                let sql = `insert into QSO ( ${fields.join(', ')} ) values (`;
                let vals = [];
                for (let i = 0; i < fields.length; i++)
                    vals.push(`$${i + 1}`);
                sql = sql + vals.join(', ') + ')';
                vals = [];
                for (const f of fields) {
                    vals.push(rec[f]);
                }
                await db.query(sql, vals);
            }
            await db.query('commit');
        }
        catch (e) {
            await db.query('rollback');
            console.log(e.toString(), `in add logs, adding individual log '${logfile}' record number ${recNum}, to database table logfile`);
            continue;
        }
    }
}
exports.addLogs = addLogs;
function prepareLog(logfile) {
    let fullpath = path.join(settings.incoming, logfile);
    try {
        let fstat = fs.statSync(fullpath, { throwIfNoEntry: true });
        if (!fstat.isFile()) {
            throw (`Cannot process input '${logfile}', it is not a file`);
        }
    }
    catch (e) {
        throw (e);
    }
    console.log(`Processing file ${logfile}.`);
    let textContent = fs.readFileSync(fullpath, 'utf-8');
    let formatVersion = null;
    /* process cabrillo log */
    if (formatVersion = cabrillo_1.default.isCabrilloVersion(textContent)) {
        console.log(`Processing ${logfile} in Cabrillo format V${formatVersion}.`);
        let cblog = new cabrillo_1.default(textContent);
        cblog.loadObjectData();
        cblog.rescanQsoFieldTypes();
        // guess map
        let TT = cblog.guessTemplate();
        // TODO: create template by pattern
        if (!TT.match(/^FMDT/i))
            throw "Log format is invalid";
        const olpTemplate = TEMPLATE['OL-PARTY'];
        const tpl = olpTemplate[TT.slice(4)];
        if (tpl)
            cblog.setTemplateArray(tpl.split(','));
        cblog.convertQsoArray2Data();
        return cblog;
    }
}
//# sourceMappingURL=logfile.js.map