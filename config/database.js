const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("./config.json")[env];
const QueryBuilder = require("node-querybuilder");
const pool = new QueryBuilder(
    {
        connectionLimit: 10,
        user: config.username,
        password: config.password,
        host: config.host,
        database: config.database,
        timezone: "Asia/Kolkata",
        acquireTimeout: 10000,
        connectTimeout: 5000,
    },
    "mysql",
    "pool"
);
module.exports = pool;
