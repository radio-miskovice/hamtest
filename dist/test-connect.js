"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Pg = require("pg");
const path = require("path");
const fs = require("fs");
const cabrillo_1 = require("./cabrillo");
const hamtest = require("./db.json");
const settings = require("./settings.json");
const TEMPLATE = require("./cabrillo-templates.json");
parseCommandLine(process.argv.slice(2));
function testDatabase() {
  console.log(`DB name: ${hamtest.database}`);
  console.log('Testing database connection');
  // @ts-ignore
  const client = new Pg.Client(hamtest);
  client.connect().then(() => {
    console.log('Connected OK');
    client.end().then(() => console.log('Disconnected successfully'))
      .catch((e) => console.log('Error when disconnecting: ', e));
  }).catch((e) => console.log('Error during connect: ', e));
}
function addContest(argv) {
  if (argv.length < 3)
    throw (`'add contest' expects 3 parameters (contest id, start timestamp, end timestamp), but got only ${argv.length}`);
  let [id, start, end] = argv;
  let patternIsoDatetime = /^\d{4}(-\d{2}){2}T\d{2}(\:\d{2})+z?$/i;
  if (!start.match(patternIsoDatetime))
    throw (`'add contest' start parameter format is invalid, must be yyyy-mm-ddThh:mm[:ss][z]`);
  if (!end.match(patternIsoDatetime))
    throw (`'add contest' end parameter format is invalid, must be yyyy-mm-ddThh:mm[:ss][z]`);
  console.log(`Contest '${id} starting ${start.toUpperCase()} and ending ${end.toUpperCase()} will be added.`);
}
function addLogs(argv) {
  while (argv.length > 0) {
    addLog(argv.shift());
  }
}
function addLog(logfile) {
  if (logfile == undefined)
    throw ("'add log' action expects one parameter, log file name.");
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
    console.log(cblog.headers);
    console.log(cblog.dataArray);
  }
}
/**
 * Do ADD action
 * @param argv paremeters
 */
function doAdd(argv) {
  let object = argv.shift();
  switch (object) {
    case 'contest':
      addContest(argv);
      break;
    case 'log':
      addLogs(argv);
      break;
    default:
      throw (`Unknown object type '${object}' in action 'add'.`);
  }
}
/**
 * Parse command line parameters
 * @param argv parameters <verb> <object> [...]
 */
function parseCommandLine(argv) {
  let verb = argv.shift();
  switch (verb) {
    case 'add':
      doAdd(argv);
      break;
    default:
      throw (`Unknown verb '${verb}'.`);
  }
}
//# sourceMappingURL=test-connect.js.map