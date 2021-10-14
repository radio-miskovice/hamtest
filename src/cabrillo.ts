import { HamtestQSORecord } from "./database";
import LogObject, { BasicObject } from "./log-object";
import cbrTemplates from './cabrillo-templates.json';

const BANDS = [
  '160m', '80m', '40m', '20m', '15m', '10m', '6m'
];

type TemplateMaskItem = {
  start: number,
  type: string,
  maxlen: number,
  mappedTo?: string
};

const FREQUENCY = [1800, 2000, 3500, 4000, 7000, 7300, 14000, 14350, 21000, 21450, 28000, 29700];

/** Cabrillo contest log class */
export default class CabrilloObject extends LogObject {
  // logObject: BasicObject;
  private templateMask: TemplateMaskItem[];
  private field: Map<string, number>;

  /**
   * Check if the supplied text is in Cabrillo format and if it is, read the version
   * @param text Input text (log file content)
   * @returns version string if the text is Cabrillo log, null otherwise
   */
  static isCabrilloVersion(text: string): string | null {
    let f = text.match(/^START-OF-LOG:\s*(\d+\.\d+)/);
    if (f) return f[1];
    else return null
  }

  /**
   * Convert frequency in Cabrillo logs to band identifier 
   * @param freq frequency in KHz
   * @returns band as string or empty string if no band fits the frequency
   */
  static frequencyToBand(freq: number): string {
    for (let i = 0; i < BANDS.length; i++) {
      if (freq >= FREQUENCY[2 * i] && freq <= FREQUENCY[2 * i + 1]) return BANDS[i];
    }
    return '';
  }
  /**
   * 
   * @param text log text, lines separated by CR, LF or CR+LF
   */
  constructor(text?: string) {
    super(text);
    if (this.logArray.length > 0) {
      this.autotemplate();
    }
  }

  getTemplateFieldCount(): number {
    return this.templateMask.length;
  }

  /**
   * Scan the content (QSO lines) and find starting positions of fields
   * The result is stored in templateMask as array of starting positions
   */
  private autotemplate() {
    let spaces = [];
    let lineWidth = 0;
    for (let line of this.logArray) {
      if (line.match(/^QSO:/)) {
        if (lineWidth < line.length) lineWidth = line.length;
        if (spaces.length == 0) {
          for (let i = 0; i < line.length; i++) {
            if (line[i] == ' ') spaces.push(i);
          }
        }
        else {
          for (let n = 0; n < spaces.length && spaces[n] < line.length; n++) {
            if (line[spaces[n]] !== ' ') {
              spaces = [...spaces.slice(0, n), ...spaces.slice(n)];
            }
          }
        }
      }
    }
    // convert spaces to template
    let template = [];
    for (let n = 0; n < spaces.length; n++) {
      if (((n < spaces.length - 1) && (spaces[n + 1] > spaces[n] + 1))
        || ((n == spaces.length - 1) && spaces[n] < lineWidth)) template.push(spaces[n] + 1);
    }

    this.templateMask = [];
    for (let p of template) {
      this.templateMask.push({ start: p, type: null, maxlen: 0 });
    }
  }

  /**
   * Scans QSO data and determines data type of each field:
   * F -> frequency (the first numeric field)
   * D -> date (ISO pattern)
   * T -> four digit time HHMM that can be interpreted as valid time
   * C -> callsign pattern
   * L -> WWLOC pattern
   * N -> number
   * S -> string
   * Types D, T, C, L are determined only if the respective field in *all* records comply, otherwise they become N or S  
   * @param opt options. parameter *template* determines which template set will be loaded
   * @returns true if a template was loaded
   */
  prepareMapping(opt?: { [key: string]: string }): boolean {
    this.rescanQsoFieldTypes();
    let tpl = '';
    let result = null;
    for (let t of this.templateMask) {
      tpl = tpl + (t.type || '?');
    }
    // load template set according to 
    console.log(`Cabrillo pattern detected: ${tpl}`);
    if( tpl.match(/^FMDTL/)) {
      console.log('Anomalous callsign in column 4 detected as WW-LOC. Fixing.');
      tpl = tpl.replace(/^FMDTL/, 'FMDTC');
      console.log(`Fixed. New pattern = ${tpl}.`);
    }
    let templates = cbrTemplates[ opt.template || this.contest ];
    if( !templates )
      templates = cbrTemplates['GENERAL'];
    if (templates) {
      let tplist = Object.keys(templates);
      tplist.sort((a, b) => (a.length - b.length));
      for (let tpKey of tplist) {
        let re = new RegExp('^FMDT' + tpKey);
        if (tpl.match(re)) {
          console.log(`TPL match: '${tpl}' vs '${tpKey}'`)
          result = templates[tpKey];
          this.setTemplateArray(templates[tpKey].split(','));
          break;
        }
      }
    }
    return (result != null);
  }

  /**
   * Scan all loaded QSO records using templateMask.
   * Check every 
   */
  rescanQsoFieldTypes() {
    for (let qsoRec of this.qsoArray) {
      for (let i = 0; i < this.templateMask.length && i < qsoRec.length; i++) {
        let f = qsoRec[i].replace(/^\s+|\s$/g, '');
        let ti = this.templateMask[i];
        // update maximum length
        if (f.length > ti.maxlen) ti.maxlen = f.length;
        // set data type if not set
        // Check for Cabrillo date string YYYY-MM-DD
        if (f.match(/^\d{4}-\d{2}-\d{2}$/)) { if (ti.type == null) ti.type = 'D'; }// date string
        // check for Cabrillo time string HHMM 
        else if (f.match(/^([01]\d|2[0-3])[0-5]\d$/)) {
          if (ti.type == null) {
            ti.type = (i == 0) ? 'F' : 'T'; // the first field is, however, frequency
          }
        }
        // check for RST or RS 
        else if (f.match(/^[3-5][1-9][5-9]?$/)) {
          if (ti.type == null) ti.type = 'R';
        }
        // check for Cabrillo mode string 
        else if (f.match(/^(CW|PH|RY|DG|PS|PM|PO)$/)) {
          if (ti.type == null) ti.type = 'M';
        }
        // check for integer number
        else if (f.match(/^\d+$/)) {
          if (i == 0 && ti.type == null) ti.type = 'F'; // the first field is frequency
          else if (ti.type == null || 'RT'.match(ti.type)) ti.type = 'N'; // previously recognized as R or T is in fact not that
        }
        // check for WW Locator
        else if (f.match(/^[A-R]{2}[0-9]{2}([A-X]{2})?$/)) {
          if (ti.type == null) ti.type = 'L';
        }
        // check for callsign pattern
        else if (f.match(/^([A-Z0-9]+\/)?[A-Z0-9]+(\/[A-Z0-9]+)?$/)) {
          if (ti.type == null || ti.type == 'L') ti.type = 'C';
        }
        else if (f.length > 0) {
          ti.type = 'S'; // if it does not fit any pattern, it is general string
        }
      }
    }
  }
  /**
   * Load logArray of lines into object headers and QSO array
   */
  loadObjectData() {
    this.headers = {};
    this.qsoArray = [];
    for (let line of this.logArray) {
      if (line.match(/^QSO:/i)) {
        let qso = [];
        let f: string = '';
        for (let i = 0; i < this.templateMask.length; i++) {
          if (i + 1 == this.templateMask.length) {
            f = line.slice(this.templateMask[i].start)
          }
          else f = line.slice(this.templateMask[i].start, this.templateMask[i + 1].start)
          f = f.replace(/^\s+/, '').replace(/\s+$/, '');
          qso.push(f.toUpperCase());
        }
        this.qsoArray.push(qso);
      }
      else {
        let m = line.match(/^(.*?):\s*(.*)\s*$/)
        if (m) {
          let key = m[1].toUpperCase();
          if (this.headers.hasOwnProperty(key)) {
            if (!(this.headers[key] instanceof Array)) {
              let single = this.headers[key];
              // @ts-ignore
              this.headers[key] = [single];
            }
            // @ts-ignore
            this.headers[key].push(m[2]);
          }
          else this.headers[key] = m[2];
          switch (key) {
            case 'CALLSIGN':
              this.callsign = m[2].toUpperCase();
              break;
            case 'CATEGORY':
              this.category = m[2].toUpperCase();
              break;
            case 'CONTEST':
              this.contest = m[2].toUpperCase();
              break;
            case 'START-OF-LOG':
              this.format = 'Cabrillo/' + m[2];
              break;
            case 'EMAIL':
              this.email = m[2].toLowerCase();
          }
        }
      }
    }
  }

  setTemplateArray(templateArray: string[], ignoreUnusedFields: boolean = true) {
    if (templateArray.length > this.templateMask.length) throw "Template array has more elements than the detected template mask";
    if (!ignoreUnusedFields && (templateArray.length < (this.templateMask.length - 4))) throw "Template array has more elements than the detected template mask";
    const fieldMap = new Map<string, number>();
    for (let i = 0; i < templateArray.length; i++) {
      fieldMap.set(templateArray[i], i + 4);
    }
    this.field = fieldMap;
  }
  /**
   * Convert QSO array of array of strings to array of records ready for database
   */
  convertQsoArray2Data(): number {
    this.dataArray = [];
    if (this.field.size > 0) {
      for (let qsoRecord of this.qsoArray) {
        this.dataArray.push(this.convertQsoRecord2Data(qsoRecord));
      }
    }
    return this.dataArray.length
  }

  /**
   * Convert QSO string array to QSO record using current template 
   * @param qso QSO array 
   * @returns QSO object for database
   */
  convertQsoRecord2Data(qso: string[]): HamtestQSORecord {
    const qso_band = CabrilloObject.frequencyToBand(parseInt(qso[0])); // the first field is always frequency
    const qso_mode = qso[1];
    const qso_time = qso[2] + ' ' + qso[3].slice(0, 2) + ':' + qso[3].slice(2);
    let data: HamtestQSORecord = { qso_band, qso_mode, qso_time, calls: '', callr: '' };
    for (let key of this.field.keys()) {
      const index = this.field.get(key);
      if (key.match(/^(nrr|nrs)$/)) data[key] = parseInt(qso[index]);
      else data[key] = qso[index];
    }
    return data;
  }
};
