import { Request, Response, Router, NextFunction } from 'express';
import { Pool, QueryResult } from 'pg';
import * as dbConfig from './db.json';

const pool = new Pool(dbConfig);

export const dbRouter = Router();

dbRouter.use(checkUser);
dbRouter.get('/logs', getLogs );
dbRouter.get('/contest(/:id)?', getContests);
dbRouter.get('/contest/:id/logs', getLogs);

function checkUser(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  if (req.session.loggedIn && req.session.user == 'ok4rm') next();
  else {
    res.status(401).json({ status: 'error', error: 'User not authorized.', redirect: [req.protocol, req.hostname].join('://') + '/login' });
  }
}

async function getContests(req: Request, res: Response) {
  try {
    let sql = "select ctst_pk, ctst_name, utc_from, utc_to, note from contest";
    let result: QueryResult;
    if (req.params.id) {
      sql += " where ctst_pk = $1 ";
      result = await pool.query(sql, [req.params.id]);
    }
    else result = await pool.query(sql);
    res.status(200).json({ status: 'OK', result: result.rows });
  }
  catch (e) {
    res.status(500).json({ status: 'Database error', error: e.toString() })
  }
}

async function getLogs(req: Request, res: Response) {
  try {
    let sql = "select lf.ctst_pk, lf.logf_pk, lf.logf_filename, lf.uploaded_ts, lf.callsign, lf.category, lf.note from logfile lf";
    let result: QueryResult;
    if (req.params.id) {
      sql += " where lf.ctst_pk = $1 ";
      result = await pool.query(sql, [req.params.id]);
    }
    else result = await pool.query(sql);
    res.status(200).json({ status: 'OK', result: result.rows });
  }
  catch (e) {
    res.status(500).json({ status: 'Database error', error: e.toString() })
  }
}
