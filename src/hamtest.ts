import { addContest } from './contest';
import { addLogs } from './logfile';

parseCommandLine( process.argv.slice(2));

/**
 * Do ADD action
 * @param argv paremeters
 */
function doAdd( argv: string[] ) {
  let object = argv.shift();
  switch( object ) {
    case 'contest':
      addContest( argv );
      break;
    case 'log':
      addLogs( argv );
      break;
    default:
      throw( `Unknown object type '${object}' in action 'add'.`)
  }
}

/**
 * Parse command line parameters
 * @param argv parameters <verb> <object> [...]
 */
function parseCommandLine(argv: string[]) {
  let verb = argv.shift();
  switch( verb ) {
    case 'add': doAdd( argv ); break;
    default:
      throw ( `Unknown verb '${verb}'.`);
  }
}
