import * as Pg from 'pg';
import * as hamtest from './db.json';

export type HamtestQSORecord = {
  logf_pk? : number,
  qso_time : string,
  qso_band : string,
  qso_mode : string,
  calls: string,
  rsts?: string,
  nrs?: number | string,
  exc1s?: string,
  exc2s?: string,
  callr: string,
  rstr?: string,
  nrr?: number | string ,
  exc1r?: string,
  exc2r?: string,
  is_ignored? : boolean,
  is_processed? : boolean ,
  is_valid? : boolean,
  error_type? : string
};

export function getDatabaseClient() : Pg.Client {
  // @ts-ignore
  const client = new Pg.Client( hamtest );
  return client ;
}