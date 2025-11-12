const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("./config.json")[env];
const QueryBuilder = require("node-querybuilder");
const pool = new QueryBuilder(
    {
        connectionLimit: 10,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        timezone:"utc+0:00",
        acquireTimeout: 10000,
        connectTimeout: 5000,
        debug: false
    },
    "mysql",
    "pool"
);
module.exports = pool;