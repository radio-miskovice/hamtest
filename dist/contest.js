"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addContest = void 0;
const database_1 = require("./database");
const INSERT_CONTEST = 'insert into CONTEST (CTST_NAME, UTC_FROM, UTC_TO, NOTE) values ($1, $2, $3, $4) returning CTST_PK';
async function addContest(argv) {
    if (argv.length < 3)
        throw (`'add contest' expects 3 parameters (contest id, start timestamp, end timestamp), but got only ${argv.length}`);
    let [id, start, end] = argv;
    let note;
    if (argv.length >= 4) {
        note = argv[3];
    }
    else {
        note = null;
    }
    let patternIsoDatetime = /^\d{4}(-\d{2}){2}T\d{2}(\:\d{2})+z?$/i;
    if (!start.match(patternIsoDatetime))
        throw (`'add contest' start parameter format is invalid, must be yyyy-mm-ddThh:mm[:ss][z]`);
    if (!end.match(patternIsoDatetime)) {
        if (end.match(/^\d{2}(\:\d{2})+z?$/)) {
            const m = start.match(/^(\d{4}(-\d{2}){2}T)/i);
            if (m)
                end = m[1] + end;
        }
        else
            throw (`'add contest' end parameter format is invalid, must be yyyy-mm-ddThh:mm[:ss][z]`);
    }
    console.log(`Contest '${id} starting ${start.toUpperCase()} and ending ${end.toUpperCase()} will be added.`);
    const db = database_1.getDatabaseClient();
    try {
        await db.connect();
        const key = await db.query(INSERT_CONTEST, [id, start, end, note]);
        console.log(`Contest '${id}', database key is ${key.rows[0].ctst_pk}`);
    }
    catch (e) {
        if (e.toString().match('duplicate key')) {
            console.log(`Contest '${id}' starting at ${start} is already in the database`);
        }
        else
            console.log(`${e} in add contest '${id}'`);
    }
    finally {
        await db.end();
    }
}
exports.addContest = addContest;
//# sourceMappingURL=contest.js.map