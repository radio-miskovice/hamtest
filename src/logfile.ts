import * as path from 'path';
import * as fs from 'fs';
import CabrilloObject from './cabrillo';
import * as settings from './settings.json';
import * as TEMPLATE from "./cabrillo-templates.json";
import { getDatabaseClient } from './database';

const GET_CONTEST_KEY =
  "select CTST_PK from contest where CTST_NAME = $1 ";

const INSERT_LOG_HEADER =
  "insert into LOGFILE (CTST_PK, LOGF_FILENAME, UPLOADED_TS, CALLSIGN, EMAIL, LOG_FORMAT, ALL_HEADERS ) values ($1, $2, now(), $3, $4, $5, $6) returning LOGF_PK";

const INSERT_QSO =
  "insert into QSO (LOGF_PK, LOGF_FILENAME, UPLOADED_TS, CALLSIGN, NOTE) values ($1, $2, now(), $3, $4) returning LOGF_PK";

export async function addLogs(argv: string[]) {
  if (argv.length < 2) {
    console.log(`'add log' action expects at least two parameters, contest ID and at least one log file name. Got ${argv.length}`);
    process.exit(1);
  }
  const contestId = argv.shift();
  const db = getDatabaseClient();
  try {
    await db.connect();
  }
  catch (e) {
    console.log(`${e.toString()} in add log, connecting database`);
  }
  let contestKey: number;
  try {
    const res = await db.query(GET_CONTEST_KEY, [contestId]);
    if( res.rowCount < 1) {
      console.log(`Contest key for contest ${contestId} not found in database.`);
      await db.end();
      return ;
    }
    contestKey = res.rows[0].ctst_pk ;
  }
  catch(e) {
    console.log(`${e.toString()} in add log, looking up contest key for ${contestId}`);
  }
  let recNum = 0 ;
  while (contestKey && argv.length > 0) {
    const logfile = argv.shift();
    const cbrLog = prepareLog(logfile);
    // create logfile header
    try {
      await db.query('begin');
      const res = await db.query(INSERT_LOG_HEADER, [contestKey, logfile, cbrLog.callsign, cbrLog.email, cbrLog.format, JSON.stringify(cbrLog.headers)]);
      if( res.rowCount<1 ) {
        console.log(`Could not create log file header in database for file '${logfile}'. Giving up this file.`);
        continue ;
      }
      const headerKey = parseInt(res.rows[0].logf_pk) ;
      for( const rec of cbrLog.dataArray ) {
        recNum++ ;
        rec.logf_pk = headerKey ;
        rec.ctst_pk = contestKey ;
        const fields = Object.keys(rec) ;
        let sql = `insert into QSO ( ${fields.join(', ')} ) values (`;
        let vals = [] ;
        for( let i = 0; i< fields.length; i++ ) vals.push(`$${i+1}`);
        sql = sql + vals.join(', ') + ')';
        vals = [] ;
        for( const f of fields ) {
          vals.push(rec[f]);
        } 
        await db.query( sql, vals );
      }
      await db.query('commit');
    }
    catch (e) {
      await db.query( 'rollback' );
      console.log(e.toString(), `in add logs, adding individual log '${logfile}' record number ${recNum}, to database table logfile`);
      continue;
    }
  }
  await db.end();
}

function prepareLog(logfile: string): CabrilloObject {
  let fullpath = path.join(settings.incoming, logfile);
  try {
    let fstat = fs.statSync(fullpath, { throwIfNoEntry: true });
    if (!fstat.isFile()) {
      throw (`Cannot process input '${logfile}', it is not a file`);
    }
  }
  catch (e: any) {
    throw (e);
  }
  console.log(`Processing file ${logfile}.`);
  let textContent = fs.readFileSync(fullpath, 'utf-8');
  let formatVersion: string | null = null;
  /* process cabrillo log */
  if (formatVersion = CabrilloObject.isCabrilloVersion(textContent)) {
    console.log(`Processing ${logfile} in Cabrillo format V${formatVersion}.`);
    let cblog = new CabrilloObject(textContent);
    cblog.loadObjectData();
    cblog.rescanQsoFieldTypes();
    // guess map
    let TT = cblog.guessTemplate();
    // TODO: create template by pattern
    if (!TT.match(/^FMDT/i)) throw "Log format is invalid";
    const olpTemplate = TEMPLATE['OL-PARTY'];
    let tpl: string ;
    while( !tpl && TT.length > 5) {
      tpl = olpTemplate[TT.slice(4)];
      TT = TT.slice(0, TT.length - 1);
    }
    if (tpl) cblog.setTemplateArray(tpl.split(','));
    else throw `Template for log file '${logfile}' with pattern '${TT}' not found!` ;
    cblog.convertQsoArray2Data();
    return cblog;
  }
}