const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../config/config.json")[env];
const server_addr = process.env.SERVER_LOAD;
const port = process.env.SERVER_PORT;
const DBRun = require("../../models/DBRun");
const fs = require("fs");
const enc_dec = require("../../utilities/decryptor/decryptor");
const logger = require('../../config/logger');

const AppCache = require("./AppCache");
const KEY_ALL_LANGUAGE_LIST = "key_all_lang_list";
const KEY_LANGUAGE_LIST = "key_lang_list";

let nodeCache = {
  /**
   * Language Master Cache
   * Load Languages
   * @returns All language list with all columns
   */
  loadAllLanguages: async () => {
    let search_condition = {};
    search_condition.status = 0;
    search_condition.deleted = 0;
    let response = await DBRun.exec_condition(
      "*",
      search_condition,
      config.table_prefix + "master_language"
    );

    let LanguageList = [];
    for (let index = 0; index < response.length; index++) {
      let languageItem = response?.[index];
      let data = "{}";
      try {
        let isExists = fs.existsSync(
          path.resolve("public/language/" + languageItem.file)
        );
        if (isExists) {
          data = fs.readFileSync(
            path.resolve("public/language/" + languageItem.file)
          );
        }
      } catch (error) {
        console.error("Error reading file:", error.message);
        logger.error(500,{message: error,stack: error?.stack});
      }

      let langData = {
        language_id: enc_dec.cjs_encrypt(languageItem.id),
        data: JSON.parse(data),
        name: languageItem.name,
        direction: languageItem.direction,
        status: languageItem.status ? "Deactivated" : "Active",
        flag: server_addr + "/static/language/" + languageItem.flag,
        file: server_addr + "/static/language/" + languageItem.file,
        deleted: languageItem.deleted,
      };
      LanguageList.push(langData);
    }
    return await AppCache.set(KEY_ALL_LANGUAGE_LIST, LanguageList);
  },
  /**
   * Get all language list and data
   * @returns Return Cached All Language List With All Columns
   */
  getAllLanguageList: async () => {
    let list = await AppCache.get(KEY_ALL_LANGUAGE_LIST);
    if (list == null) {
      list = await nodeCache.loadAllLanguages();
      // console.log("DB List......");
    } else {
      // console.log("Cached List......");
    }
    return list;
  },
  /**
   *
   * @param {*} languageId
   * @returns Get language item by language id
   */
  getActiveLanguageById: async (languageId) => {
    let list = await nodeCache.getAllLanguageList();
    for (let index = 0; index < list.length; index++) {
      const row = list[index];
      if (
        row.language_id == languageId &&
        row.status == "Active" &&
        row.deleted == 0
      ) {
        return row;
      }
    }
    return {};
  },
  reload: async () => {
    await nodeCache.del(KEY_ALL_LANGUAGE_LIST);
    nodeCache.loadAllLanguages();
  },
  del: async (key) => {
    await AppCache.del(key);
  },
};

module.exports = nodeCache;
