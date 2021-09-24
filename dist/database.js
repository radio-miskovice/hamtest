"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseClient = void 0;
const Pg = require("pg");
const hamtest = require("./db.json");
function getDatabaseClient() {
    // @ts-ignore
    const client = new Pg.Client(hamtest);
    return client;
}
exports.getDatabaseClient = getDatabaseClient;
//# sourceMappingURL=database.js.map