"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const contest_1 = require("./contest");
const logfile_1 = require("./logfile");
parseCommandLine(process.argv.slice(2));
/**
 * Do ADD action
 * @param argv paremeters
 */
function doAdd(argv) {
    let object = argv.shift();
    switch (object) {
        case 'contest':
            contest_1.addContest(argv);
            break;
        case 'log':
            logfile_1.addLogs(argv);
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
//# sourceMappingURL=hamtest.js.map