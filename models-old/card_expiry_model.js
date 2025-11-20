const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../config/config.json")[env];
const pool = require("../config/database");

const checkType = {
  expired: 2,
  aboutToExpired: 1,
  block: 3,
  subscription: 4,
};

var card_expiry_model = {
  get_data: async (data) => {
    let qb = await pool.get_connection();
    let result;
    try {
      let sql = `
        SELECT
            sp.order_no,
            mmd.company_name,
            mm.email,
            o.card_id,
            o.customer_name,
            o.customer_email,
            o.cid,
            psp.plan_name
        FROM
            pg_subs_payment sp
        LEFT JOIN pg_master_merchant mm ON
            sp.merchant_id = mm.id
        LEFT JOIN pg_master_merchant_details mmd  ON
            sp.merchant_id = mmd.merchant_id    
        LEFT JOIN pg_orders o ON
            sp.order_no = o.order_id
        LEFT JOIN pg_subs_plans psp ON
            sp.plan_id = psp.id    
        GROUP BY
            sp.plan_id,
            sp.subscription_id,
            sp.order_no
        ORDER BY
            sp.id
        DESC;
    `;
      result = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return result;
  },
  get_customer_card_about_expire: async (ids, flag) => {
    let sql = `SELECT 
                    id, 
                    card_expiry, 
                    email as customer_email , 
                    card_number,
                    cipher_id
                    FROM pg_customers_cards 
                    WHERE id in (${ids.join(",")}) `;
    if (flag == "current") {
      sql += `and  CONCAT( SUBSTRING(card_expiry, 1, 2), '/', SUBSTRING(card_expiry, 4, 4) ) = DATE_FORMAT(NOW(), '%m/%Y')`;
    } else {
      sql += `and CONCAT(SUBSTRING(card_expiry, 1, 2), '/', SUBSTRING(card_expiry, 4, 4)) = DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 1 MONTH), '%m/%Y')`;
    }

    let result;
    let qb = await pool.get_connection();
    try {
      result = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return result;
  },
  get_customer_expired_card: async (ids, flag) => {
    let sql = `SELECT
                        id,
                        card_expiry,
                        card_number,
                        email as customer_email,
                        cipher_id
                    FROM
                        pg_customers_cards
                    WHERE
                        STR_TO_DATE(
                            CONCAT(
                                SUBSTRING(card_expiry, 1, 2),
                                '/01/',
                                SUBSTRING(card_expiry, 4, 4)
                            ),
                            '%m/%d/%Y'
                        ) < DATE_FORMAT(NOW(), '%Y-%m-01') and id in (${ids.join(
                          ","
                        )})`;

    let result;
    let qb = await pool.get_connection();
    try {
      let result = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return result;
  },
  getAboutToExpireCards: async () => {
    let sql = getQuery(checkType.aboutToExpired);
    let qb = await pool.get_connection();
    let result;
    try {
      result = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return result;
  },
  getExpiredCard: async () => {
    let sql = getQuery(checkType.expired);
    console.log(sql);
    let qb = await pool.get_connection();
    let result;
    try {
      result = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return result;
  },
  getBlockCardDetail: async (order_id) => {
    let sql = getQuery(checkType.block, order_id);

    let qb = await pool.get_connection();
    let result;
    try {
      result = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return result?.[0];
  },
  getExpiredCardDetail: async (subscription_id) => {
    let sql = getQuery(checkType.subscription, null, subscription_id);

    let qb = await pool.get_connection();
    let result;
    try {
      result = await qb.query(sql);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return result?.[0];
  },
  DeclinedCards: async (subscription_id) => {
    query =
      `
            SELECT
                sp.order_no,
                mmd.company_name,
                cc.cipher_id,
                mm.email as merchant_email,
                o.card_id,
                o.customer_name,
                o.customer_email,
                o.cid,
                psp.plan_name,
                cc.card_expiry,
                cc.last_4_digit,
                cc.card_number,
                cc.remark,sp.subscription_id
            FROM
                pg_subs_payment sp
                LEFT JOIN pg_master_merchant mm ON
                sp.merchant_id = mm.id
            LEFT JOIN pg_master_merchant_details mmd  ON
                sp.merchant_id = mmd.merchant_id
        
            LEFT JOIN pg_orders o ON
                sp.order_no = o.order_id
            LEFT JOIN pg_subs_plans psp ON
                sp.plan_id = psp.id
                LEFT JOIN pg_subscription s ON
                sp.subscription_id = s.subscription_id
                LEFT JOIN pg_declined_cards cc ON
                o.card_no = cc.last_4_digit
                where s.status=1 and cc.status = 0 and cc.deleted=0 and  STR_TO_DATE(CONCAT(SUBSTRING(card_expiry, 1, 2),'/01/',SUBSTRING(card_expiry, 4, 4)
                ),'%m/%d/%Y') > DATE_FORMAT(NOW(), '%Y-%m-01') and sp.subscription_id=` +
      subscription_id +
      `  
        
            ORDER BY
                sp.id
            DESC `;

    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb.query(query);
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    return response?.[0];
  },
};

function getQuery(expired = null, order_id = null, subscription_id = null) {
  let str = "";
  if (expired === checkType.expired) {
    str = `STR_TO_DATE(
            CONCAT(
                SUBSTRING(card_expiry, 1, 2),
                '/01/',
                SUBSTRING(card_expiry, 4, 4)
            ),
            '%m/%d/%Y'
        ) < DATE_FORMAT(NOW(), '%Y-%m-01')`;
  }
  if (expired === checkType.aboutToExpired) {
    str = `CONCAT(
            SUBSTRING(card_expiry, 1, 2),
            '/',
            SUBSTRING(card_expiry, 4, 4)
        ) = DATE_FORMAT(NOW(), '%m/%Y')`;
  }
  if (expired === checkType.block) {
    str = `o.order_id = ${order_id}`;
  }

  if (expired === checkType.subscription) {
    str = `sp.subscription_id = ${subscription_id}`;
  }

  return `SELECT
                    mmd.company_name,
                    mm.email,
                    o.card_id,
                    o.customer_name,
                    o.customer_email,
                    psp.plan_name,
                    psp.ref_no,
                    cc.card_expiry,
                    cc.last_4_digit,
                    cc.card_number,
                    cc.cipher_id,
                    sp.subscription_id
                FROM
                    pg_subs_payment sp
                LEFT JOIN pg_subscription s ON
                    sp.subscription_id = s.subscription_id
                LEFT JOIN pg_master_merchant mm ON
                    sp.merchant_id = mm.id    
                LEFT JOIN pg_master_merchant_details mmd ON
                    sp.merchant_id = mmd.merchant_id
                LEFT JOIN pg_orders o ON
                    sp.order_no = o.order_id
                LEFT JOIN pg_subs_plans psp ON
                    sp.plan_id = psp.id
                LEFT JOIN pg_customers_cards cc ON
                    o.card_no = cc.last_4_digit
                WHERE
                    ${str}
                AND cc.deleted = 0
                AND cc.status = 0    
                AND s.status = 1
                GROUP BY
                    sp.plan_id,
                    sp.subscription_id,
                    cc.last_4_digit`;
}

module.exports = card_expiry_model;
