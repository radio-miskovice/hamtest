import * as Pg from 'pg';
import * as hamtest from './db.json';

export type HamtestQSORecord = {
  ctst_pk? : number,  // contest key for database record
  logf_pk? : number,  // log file key for the database record
  qso_time : string,  // QSO datetime in ISO format or PostgreSQL timestamp format (like ISO, but space separates date and time)
  qso_band : string,  // QSO band as text
  qso_mode : string,  // QSO mode as specified by log format
  calls: string,      // callsign sent
  rsts?: string,      // report sent
  nrs?: number,       // serial number sent
  exc1s?: string,     // exchange 1 sent 
  exc2s?: string,     // exchange 2 sent
  callr: string,      // callsign received
  rstr?: string,      // report received
  nrr?: number,       // serial number received 
  exc1r?: string,     // exchange 1 received
  exc2r?: string,     // exchange 2 received
  is_ignored? : boolean,    // processing flag - do not process
  is_processed? : boolean,  // processing flag - has been processed
  is_valid? : boolean,      // evaluation flag - is valid
  error_type? : string      // evaluation error - what kind of error
};

export function getDatabaseClient() : Pg.Client {
  // @ts-ignore
  const client = new Pg.Client( hamtest );
  return client ;
}