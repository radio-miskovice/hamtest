import { Request, Response, Router, NextFunction } from 'express';
import { Pool, QueryResult } from 'pg';
import CabrilloObject from './cabrillo';
import * as dbConfig from './db.json';
import LogObject from './log-object';

const pool = new Pool(dbConfig);
const SQL_GET_CONTESTS = `select C.CTST_PK as ID, C.CTST_NAME as NAME,\
  to_char(C.UTC_FROM,'YYYY-MM-DDT') || to_char(C.UTC_FROM,'HH24:MIz') as UTC_FROM,\
  to_char(C.UTC_TO,'YYYY-MM-DDT') || to_char(C.UTC_TO,'HH24:MIz') as UTC_TO,\
  C.NOTE, C.CTST_STATUS as STATUS,\
  C.CABR_TEMPLATE_ID as TEMPLATE,\
  CS.STATUS_NAME\
  from CONTEST C\
  left join CONTEST_STATUS CS on CS.CTST_STATUS = C.CTST_STATUS\
  `;

export const dbRouter = Router();

dbRouter.use(checkUser);
dbRouter.get('/', (req: Request, res: Response) => { res.status(200).json({ status: 'OK' }); })
dbRouter.get('/logs', getLogs);
dbRouter.get('/status', getStatusList);
dbRouter.get('/templates', getTemplates);
dbRouter.post('/contest', createContest);
dbRouter.get('/contest(/:id)?', getContests);
dbRouter.delete('/contest/:id', deleteContest);
dbRouter.get('/contest/:id/logs', getLogs);
dbRouter.post('/contest/:id/logs/new', uploadLog);
dbRouter.post('/contest/:id/category/power', updateCategory);
dbRouter.post('/logs', uploadLogJson );

/**
 * 
 * @param req   Request
 * @param res   Response
 * @param next  Next middleware
 */
function checkUser(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  if (req.session.loggedIn && req.session.user == 'ok4rm') next();
  else {
    res.status(200).json({ status: 'error', code: 401, error: 'User not authenticated', redirect: [req.protocol, req.hostname].join('://') + '/login' });
  }
}

/**
 * Get list if contest_status values
 * @param req   Request
 * @param res   Response
 */
async function getStatusList(req: Request, res: Response) {
  try {
    let sql = "select CTST_STATUS, STATUS_NAME from CONTEST_STATUS";
    const result = await pool.query(sql);
    res.status(200).json({ status: 'OK', result: result.rows });
  }
  catch (e) {
    res.status(200).json({ status: 'error', code: 5001, error: e.toString() })
  }
}

/**
 * 
 * @param req   Request
 * @param res   Response
 */
async function getTemplates(req: Request, res: Response) {
  try {
    let sql = "select distinct TPL_NAME as TEMPLATE_ID from CABRILLO_TEMPLATE";
    const result = await pool.query(sql);
    res.status(200).json({ status: 'OK', result: result.rows });
  }
  catch (e) {
    res.status(200).json({ status: 'error', code: 5002, error: e.toString() })
  }
}

/**
 * 
 * @param req 
 * @param res 
 */
async function createContest(req: Request, res: Response) {
  const { ctst_name, utc_from, utc_to, cabr_template_id, note, ctst_status } = req.body;
  console.log(req.body);
  try {
    const r = await pool.query("insert into CONTEST( CTST_NAME, UTC_FROM, UTC_TO, CABR_TEMPLATE_ID, NOTE, CTST_STATUS ) "
      + "values ($1, $2, $3, $4, $5, $6)", [ctst_name, utc_from, utc_to, cabr_template_id, note, ctst_status || 'W']);
    console.log(r);
    res.status(200).json({ status: 'OK', result: 'Contest created' });
  }
  catch (e) {
    console.log(e);
    res.status(200).json({ status: 'error', code: 6101, error: e.toString() });
  }
}

/**
 * 
 * @param req 
 * @param res 
 */
async function getContests(req: Request, res: Response) {
  try {
    let sql = SQL_GET_CONTESTS;
    let result: QueryResult;
    if (req.params.id) {
      sql += " where C.CTST_PK = $1 ";
      result = await pool.query(sql, [req.params.id]);
    }
    else result = await pool.query(sql + ' order by C.CTST_PK desc');
    res.status(200).json({ status: 'OK', result: result.rows });
  }
  catch (e) {
    res.status(200).json({ status: 'error', code: 6001, error: e.toString() })
  }
}

async function deleteContest(req: Request, res: Response) {
  try {
    console.log(`Delete contest: ${req.params.id}`)
    let sql = "delete from contest where ctst_pk = $1";
    let result: QueryResult;
    result = await pool.query(sql, [req.params.id]);
    res.status(200).json({ status: 'OK' });
  }
  catch (e) {
    res.status(200).json({ status: 'error', code: 6003, error: e.toString() })
  }
}

async function getLogs(req: Request, res: Response) {
  const fields = 'lf.ctst_pk, lf.logf_pk, lf.logf_filename, lf.log_format, lf.email, lf.uploaded_ts, lf.callsign, lf.category, lf.note';
  try {
    let sql = `select ${fields}, count(qso.qso_pk) as qso_count from logfile lf left join qso on qso.logf_pk = lf.logf_pk `;
    let result: QueryResult;
    if (req.params.id) {
      sql += " where lf.ctst_pk = $1 ";
      sql += ` group by ${fields} `;
      sql += " order by lf.callsign ";
      result = await pool.query(sql, [req.params.id]);
    }
    else {
      sql += ` group by ${fields} `;
      sql += " order by lf.callsign ";
      result = await pool.query(sql);
    }
    console.log(`getLogs: [${req.params.id || ''}] Success.`);
    res.status(200).json({ status: 'OK', result: result.rows });
  }
  catch (e) {
    console.log(`getLogs: [${req.params.id || ''}] ${e.toString()}`);
    res.status(200).json({ status: 'error', code: 6002, error: e.toString() });
  }
}

async function uploadLog(req: Request, res: Response) {
  const logfile = req.files?.logfile;
  if (logfile) {
    // @ts-ignore
    const filename = logfile.name;
    const ctst_pk = parseInt(req.body.id);
    const template = req.body.template;
    const note = req.body.note;
    console.log(`Incoming log ${filename}`);
    // @ts-ignore
    const data = logfile.data.toString();
    let log: LogObject | CabrilloObject;
    if (CabrilloObject.isCabrilloVersion(data) != null) {
      log = new CabrilloObject(data);
      log.loadObjectData();
      console.log(`Log ${log.callsign}: ${log.logArray.length} text lines`);
      console.log(`Log ${log.callsign}: ${log.qsoArray.length} QSO lines`);
      let hasTemplate = log.prepareMapping({ template });
      if (hasTemplate) {
        log.convertQsoArray2Data();
        console.log(`Log ${log.callsign}: ${log.dataArray.length} data records`);
      }
      else { console.log(`Log ${log.callsign}: data not converted`) }
    }
    try {
      const c = await pool.connect();
      try {
        await c.query("begin");
        let dbres = await c.query(
          "insert into logfile( logf_filename, ctst_pk, callsign, email, log_format, content ) values ( $1, $2, $3, $4, $5, $6 ) returning logf_pk ",
          [filename, ctst_pk, log.callsign || '', log.email || '', log.format || 'N/A', data]);
        const logf_pk = dbres.rows[0].logf_pk;
        for (let ln = 0; ln < log.logArray.length; ln++) {
          await c.query("insert into lograwtext ( logf_pk, linenum, linetext ) values ($1, $2, $3)", [logf_pk, ln + 1, log.logArray[ln]]);
        }
        for (let rec of (log.dataArray || [])) {
          rec.ctst_pk = ctst_pk;
          rec.logf_pk = logf_pk;
          const keys = Object.keys(rec);
          let sql = `insert into qso ( ${keys.join(', ')} ) values (`;
          let par = [];
          for (let i = 0; i < keys.length; i++) {
            par.push(`\$${i + 1}`);
          }
          sql = sql + par.join(', ') + ')';
          let vals = [];
          for (let k of keys) {
            vals.push(rec[k]);
          }
          await c.query(sql, vals);
        }
        await c.query('commit');
        res.status(200).json({ status: 'OK', code: 0, message: 'New log saved in database' });
        console.log(`Log ${log.callsign}: data committed`)
      }
      catch (e) {
        await c.query('rollback');
        console.log(`Log ${log.callsign}: data rolled back`)
        res.status(200).json({ status: "error", code: 6102, error: e.toString() })
      }
      finally {
        c.release();
      }
    }
    catch (e) {
      res.status(500).json({ status: 'error', code: 501, error: e.toString() });
    }
  }
  else {
    res.status(400).json({ status: 'error', error: 'Invalid request' })
  }
}

async function uploadLogJson(req: Request, res: Response) {
  const sql = 'insert into logfile (ctst_pk, logf_filename, callsign, email, log_format, content) '
    + 'values( $1, $2, $3, $4, $5, $6 ) returning logf_pk';
  const body = req.body ;
  let error = 0 ;
  console.log(body);
  const ctst_pk = parseInt( body.contest );
  if( ctst_pk !== ctst_pk ) error = 6100 ;
  if( error === 0 ) {
    try {
      let result = await pool.query( sql, [ctst_pk, body.filename, body.callsign, body.email, body.version, body.filetext ] );
      if( result.rowCount > 0 ) {
        const logf_pk = result.rows[0].logf_pk ;
        result = await pool.query( 'call proc_split_lines_log( $1 )', [logf_pk]);
        res.status(200).json({ status: 'OK', code: 0, result: `Log <${body.filename}> uploaded`} );
      }
      else { 
        res.status(200).json({ status: 'error', code: 6101, error: 'Log file was not stored in database' });
      }
    }
    catch(e) {
      res.status(200).json({status: 'error', code: 6102, error: e.toString()});
    }
  }
  else {res.status(200).json({ status: 'error', code: 6100, error: `Contest ID <${body.contest}> is not numeric` });}
}

async function updateCategory(req: Request, res: Response) {
  let ctst_pk: number;
  try {
    ctst_pk = parseInt(req.params.id);
    if (!ctst_pk) ctst_pk = parseInt(req.body.id);
    if (ctst_pk) {
      const result = await pool.query('call proc_set_category_power($1)', [ctst_pk]);
      console.log(result);
      console.log(`updateCategory[${ctst_pk}] SUCCESS (${result.rowCount})`);
      res.json({ status: 'OK', code: 109, result: `${result.rowCount} categories updated` })
    }
    else res.json( {status:'error', code: 902, error: 'Mandatory parameter ID not received in request'})
  }
  catch (e) {
    console.log(`updateCategory[${ctst_pk}] ERROR: ${e.toString()}`);
    res.json({ status: 'error', error: e.toString(), code: 901 });
  }

}