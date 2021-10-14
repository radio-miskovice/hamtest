import { HamtestQSORecord } from "./database";

export type BasicObject = { [key: string]: string | string[] | null };

/**
 * 
 */
export default class LogObject {
  callsign:  string = '' ;        // station callsign
  email:     string = '' ;        // contact email
  format:    string = 'N/A';      // format/version
  contest:   string = '' ;        // type of contest (key to select cabrillo template)
  category:  string = 'CHECKLOG'; // contest category
  dataArray: HamtestQSORecord[];  // logged QSOs converted to database-compatible records
  logArray:  string[] = [];       // split, unprocessed lines of the log file
  qsoArray:  string[][] = [];     // QSO lines split to elements, not yet mapped 
  headers:   BasicObject = {};    // any header items including callsign and email. 

  constructor(text?: string) {
    this.headers = {};
    this.logArray = [];
    if (text) this.loadText(text);
  }

  /**
   * 1. convert log text into array of lines
   * 2. scan the text and create autotemplate
   * @param text the input text
   */
  loadText(text: string) {
    this.logArray = text.split(/\r\n|\r|\n/);
  }
  /**
   * Dummy method. Sets qsoArray to empty array an sets 
   * callsign, email and contest to empty string,
   * sets format to 'N/A'
   */
  loadObjectData() {
    this.callsign = '' ;
    this.email    = '' ;
    this.contest  = '' ;
    this.format   = 'N/A';
    this.qsoArray = [] ;
  }
  prepareMapping( options? : { [key:string]: any }): boolean {
    return false ;
  }
  convertQsoArray2Data(): number { this.dataArray = []; return this.dataArray.length }
  hasData() : boolean { return (this.dataArray.length > 0); }
}