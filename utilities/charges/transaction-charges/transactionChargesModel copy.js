const path = require("path");
require("dotenv").config({ path: "../.env" });
const env = process.env.ENVIRONMENT;
const config = require("../../../config/config.json")[env];
const pool = require("../../../config/database");
const momentFormat = require("../../date_formatter");
const enc_dec = require("../../../utilities/decryptor/decryptor");
const helpers = require("../../helper/general_helper");

async function makeLower(str) {
  return await str.toLocaleLowerCase();
}

async function removeUnderScore(str) {
  //return await str.toLocaleLowerCase().replaceAll('_', ' ');
  return str.split("_").join(" ").toLocaleLowerCase();
}

async function getPsp(psp) {
  let sql = `SELECT id FROM pg_psp WHERE LOWER(credentials_key) = '${psp}'`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response?.[0].id;
}
async function fetchMerchantDetails(psp) {
  let sql = `SELECT id FROM pg_psp WHERE LOWER(credentials_key) = '${psp}'`;
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.query(sql);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response?.[0].id;
}

async function getMerchantSellRate(
  { merchant_id, currency, scheme, payment_method, terminal_id,is_mobile_wallet },
  is_domestic_international
) {
  const mid_table = `${config.table_prefix}mid`;
  const master_sellrate = `${config.table_prefix}master_mid_sellrate`;

  const currentDate = await momentFormat.current_date();
  const select_fields = [];

  let promo_response = null;

  let condition
  let enc_payment_scheme_id = await helpers.getPaymentSchemeEnc(scheme);
    console.log(enc_payment_scheme_id);
    condition= {
      "LOWER(pricing_plan.payment_methods)": `${await makeLower(payment_method)}`,
      "pricing_plan.payment_schemes": enc_payment_scheme_id,
      "LOWER(pricing_plan.dom_int)": `${await makeLower(is_domestic_international)}`,
      "pricing_plan.deleted": 0,
      "mid.deleted": 0,
      "mid.submerchant_id": merchant_id,
      "mid.terminal_id": terminal_id,
      "pricing_plan.currency": `${currency}`,
      "p.is_default":0
    };


  // async function getPromoSellRate() {
  //   const sellrate = `${config.table_prefix}mid_promo_sellrate`;
  //   const date_condition = {
  //     "master_sellrate.promo_period_start <=": `${currentDate}`,
  //     "master_sellrate.promo_period_end >=": `${currentDate}`,
  //   };
  //   let qb = await pool.get_connection();
  //   let promo_response;
  //   try {
  //     promo_response = await qb
  //       .select(
  //         `
  //           sellrate.promo_sell_rate_fix, 
  //           sellrate.promo_sell_rate_per,
  //           sellrate.paydart_rate_fix, 
  //           sellrate.paydart_rate_per,
  //           sellrate.promo_tax,
  //           master_sellrate.refund_fees_per,
  //           master_sellrate.refund_fees_fix,
  //           `
  //       )
  //       .from(`${mid_table} mid`)
  //       .join(
  //         `${master_sellrate} master_sellrate`,
  //         "mid.id = master_sellrate.mid"
  //       )
  //       .join(
  //         `${sellrate} sellrate`,
  //         "master_sellrate.id = sellrate.master_mid_sellrate_id"
  //       )
  //       .where(condition)
  //       .where(date_condition)
  //       .get();
  //   } catch (error) {
  //     console.error("Database query failed:", error);
  //   } finally {
  //     qb.release();
  //   }
  //   console.log(qb.last_query());
  //   /*
  //       let sql = `SELECT
  //               sellrate.*, master_sellrate.refund_fees_per, master_sellrate.refund_fees_fix,master_sellrate.promo_period_start, master_sellrate.promo_period_start
  //               FROM
  //                   ${mid_table} mid
  //               JOIN ${master_sellrate} master_sellrate ON
  //                   mid.id = master_sellrate.mid
  //               JOIN ${sellrate} sellrate ON
  //                   master_sellrate.id = sellrate.master_mid_sellrate_id
  //               WHERE LOWER(sellrate.payment_methods) ='${await makeLower(payment_method)}'
  //               AND LOWER(sellrate.payment_schemes) = '${await removeUnderScore(scheme)}'
  //               AND LOWER(sellrate.dom_int) = '${await makeLower(is_domestic_international)}'
  //               AND sellrate.deleted = 0
  //               AND mid.deleted = 0
  //               AND mid.submerchant_id = ${merchant_id}
  //               AND mid.terminal_id = ${terminal_id}
  //               AND master_sellrate.currency ='${currency}'
  //               AND (master_sellrate.promo_period_start <= '${currentDate}' AND master_sellrate.promo_period_end >= '${currentDate}')
  //               `;
        
  //       let qb = await pool.get_connection();
  //       response = await qb.query(sql);
  //       qb.release();
  //       */
  // }


    const sellrate = `${config.table_prefix}mid_sellrate`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
      .select(
        `
        pricing_plan.sale_rate_fix,
        pricing_plan.sale_rate_per,
        pricing_plan.tax
        `
      )
      .from(`${mid_table} mid`)
      .join(
        `pg_master_mid_sellrate mms`,
        "mid.id = mms.mid",
        "left"
      ).join(`pg_master_pricing_plan p`,
        "mms.plan_id=p.id",
        "left"
      ).join(`pg_pricing_plan_txn_rate pricing_plan`,
        "p.id=pricing_plan.master_pricing_plan_id",
        "left"
      )
      .where(condition)
      .where(`pricing_plan.psp = mid.psp_id`) 
      .get();
      console.log(`here we are getting sale rate for merchant over rided plan`);
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    /*
    let sql = `SELECT
    sellrate.*, master_sellrate.refund_fees_per, master_sellrate.refund_fees_fix,master_sellrate.promo_period_start, master_sellrate.promo_period_start
    FROM
    ${mid_table} mid
    JOIN ${master_sellrate} master_sellrate ON
    mid.id = master_sellrate.mid
    JOIN ${sellrate} sellrate ON
    master_sellrate.id = sellrate.master_mid_sellrate_id
    WHERE LOWER(sellrate.payment_methods) ='${await makeLower(payment_method)}'
    AND LOWER(sellrate.payment_schemes) = '${await removeUnderScore(scheme)}'
    AND LOWER(sellrate.dom_int) = '${await makeLower(is_domestic_international)}'
    AND sellrate.deleted = 0
    AND mid.deleted = 0
    AND mid.submerchant_id = ${merchant_id}
    AND mid.terminal_id = ${terminal_id}
    AND master_sellrate.currency ='${currency}'`;
    
    let qb = await pool.get_connection();
    response = await qb.query(sql);
    qb.release();*/
    
    console.log("🚀 ~ response:", response)
    
    const {
      sale_rate_fix = 0,
      sale_rate_per = 0,
      tax = 0,
      refund_fees_per = 0,
      refund_fees_fix = 0,
      paydart_rate_fix = 0,
      paydart_rate_per = 0,
    } = response && response[0] ? response[0] : {};
    console.log(`sale rate fix`);
    console.log(sale_rate_fix);

  // if (
  //   promo_period_end !== "0000-00-00" &&
  //   promo_period_start !== "0000-00-00"
  // ) {
  //   const date_result = await momentFormat.checkBetween(
  //     currentDate,
  //     promo_period_start,
  //     promo_period_end
  //   );

  //   if (date_result) {
  //     await getPromoSellRate();
  //     if (promo_response && promo_response.length > 0) {
  //       const {
  //         id,
  //         promo_sell_rate_fix,
  //         promo_sell_rate_per,
  //         promo_tax,
  //         refund_fees_per,
  //         refund_fees_fix,
  //         paydart_rate_fix,
  //         paydart_rate_per,
  //       } = promo_response[0];
  //       return {
  //         rate_fix: promo_sell_rate_fix || 0,
  //         rate_per: promo_sell_rate_per || 0,
  //         paydart_rate_fix: paydart_rate_fix || 0,
  //         paydart_rate_per: paydart_rate_per || 0,
  //         tax: promo_tax || 0,
  //         refund_fees_per,
  //         refund_fees_fix,
  //       };
  //     }
  //   }
  // }
  return {
    rate_fix: sale_rate_fix || 0,
    rate_per: sale_rate_per || 0,
    paydart_rate_fix: paydart_rate_fix || 0,
    paydart_rate_per: paydart_rate_per || 0,
    tax: tax || 0,
    refund_fees_per,
    refund_fees_fix,
  };
}

async function getMerchantDefaultSellRate( details, is_domestic_international ) {
  console.log("🚀 ~ getMerchantDefaultSellRate ~ details:", details)
  const { merchant_id, currency, scheme, payment_method, terminal_id, psp_id, country_id } = details;

  const master_pricing_plan = `${config.table_prefix}master_pricing_plan`;
  const pricing_plan_txn_rate = `${config.table_prefix}pricing_plan_txn_rate`;

   
  let encrypted_scheme = enc_dec.cjs_decrypt(scheme);
  console.log("🚀 ~ getMerchantDefaultSellRate ~ encrypted_scheme:", encrypted_scheme)

    let enc_payment_scheme_id = await helpers.getPaymentSchemeEnc(scheme);
    console.log(enc_payment_scheme_id);
    condition= {
      "LOWER(pricing_plan.payment_methods)": `${await makeLower(payment_method)}`,
      "pricing_plan.payment_schemes": enc_payment_scheme_id,
      "LOWER(pricing_plan.dom_int)": `${await makeLower(is_domestic_international)}`,
      "pricing_plan.deleted": 0,
      "pricing_plan.currency": `${currency}`,
      "p.is_default":1
    };
  console.log("🚀 ~ getMerchantDefaultSellRate ~ condition:", condition)

   
  let qb = await pool.get_connection();
    let response;
    try {
     response = await qb
      .select(
        `
        pricing_plan.sale_rate_fix,
        pricing_plan.sale_rate_per,
        pricing_plan.tax
        `
      )
      .from(`pg_master_pricing_plan p`)
      .join(`pg_pricing_plan_txn_rate pricing_plan`,
        "p.id=pricing_plan.master_pricing_plan_id",
        "left"
      )
      .where(condition)
      .get();
      console.log(`here we are getting sale rate for default plan`);
      console.log(qb.last_query());
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    
    // console.log("🚀 ~ response:", response)
    
    const {
      sale_rate_fix = 0,
      sale_rate_per = 0,
      tax = 0,
      refund_fees_per = 0,
      refund_fees_fix = 0,
      paydart_rate_fix = 0,
      paydart_rate_per = 0,
    } = response && response[0] ? response[0] : {};

  return {
    rate_fix: sale_rate_fix || 0,
    rate_per: sale_rate_per || 0,
    paydart_rate_fix: paydart_rate_fix || 0,
    paydart_rate_per: paydart_rate_per || 0,
    tax: tax || 0,
    refund_fees_per,
    refund_fees_fix,
  };
}

async function getMerchantByRate({ merchant_id, currency, scheme, payment_method, psp_id, terminal_id }, is_domestic_international
) {
  const mid_table = `${config.table_prefix}mid`;
  const master_buyrate = `${config.table_prefix}master_buyrate`;
  const currentDate = await momentFormat.current_date();
  //const psp_id = await getPsp(psp);

  let promo_response = null;
  let response = null;

  const condition = {
    "mid.submerchant_id": merchant_id,
    "mid.terminal_id": terminal_id,
    "mid.deleted": 0,
    "LOWER(psp_buyrate.payment_methods)": `${await makeLower(payment_method)}`,
    "LOWER(psp_buyrate.payment_schemes)": `${await removeUnderScore(scheme)}`,
    "LOWER(psp_buyrate.dom_int)": `${await makeLower(
      is_domestic_international
    )}`,
    "psp_buyrate.deleted": 0,
    //'master_buyrate.currency': `${currency}`,
    "master_buyrate.psp": psp_id,
  };

  async function getBuyRatePromoData() {
    const buy_rate = `${config.table_prefix}psp_promo_buyrate`;
    const date_condition = {
      "master_buyrate.promo_period_start <=": `${currentDate}`,
      "master_buyrate.promo_period_end >=": `${currentDate}`,
    };
    let qb = await pool.get_connection();
    let promo_response;
    try {
      promo_response = await qb
        .select(
          `
            psp_buyrate.promo_buy_rate_fix,
            psp_buyrate.promo_buy_rate_per,
            psp_buyrate.promo_tax,
            master_buyrate.refund_fees_per,
            master_buyrate.refund_fees_fix`
        )
        .from(`${mid_table} mid`)
        .join(
          `${master_buyrate} master_buyrate`,
          "mid.psp_id = master_buyrate.psp"
        )
        .join(
          `${buy_rate} psp_buyrate`,
          "master_buyrate.id = psp_buyrate.master_buyrate_id"
        )
        .where(condition)
        .where(date_condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    /*
        let sql = `SELECT
                psp_buyrate.*,
                mater_buyrate.refund_fees_per,
                mater_buyrate.refund_fees_fix
            FROM
                ${mid_table} mid
            JOIN ${master_buyrate} master_buyrate ON
                mid.psp_id = mater_buyrate.psp
            JOIN ${buy_rate} psp_buyrate ON
                mater_buyrate.id = psp_buyrate.master_buyrate_id
            WHERE
                mid.submerchant_id = ${merchant_id}
                AND mid.terminal_id = ${terminal_id}
                AND mid.deleted = 0 
                AND LOWER(psp_buyrate.payment_methods) = '${await makeLower(payment_method)}' 
                AND LOWER(psp_buyrate.payment_schemes) = '${await removeUnderScore(scheme)}'
                AND LOWER(psp_buyrate.dom_int) = '${await makeLower(is_domestic_international)}' 
                AND psp_buyrate.deleted = 0 
                AND mater_buyrate.currency = '${currency}' 
                AND mater_buyrate.psp = ${psp_id}
                AND (mater_buyrate.promo_period_start <= '${currentDate}' AND mater_buyrate.promo_period_end >= '${currentDate}')`;
        
        let qb = await pool.get_connection();
        promo_response = await qb.query(sql);
        qb.release()
        */
  }

  async function getBuyRateData() {
    const buy_rate = `${config.table_prefix}psp_buyrate`;
    let qb = await pool.get_connection();
    let response;
    try {
      response = await qb
        .select(
          `
            psp_buyrate.buy_rate_fix,
            psp_buyrate.buy_rate_per,
            psp_buyrate.tax,
            master_buyrate.refund_fees_per,
            master_buyrate.refund_fees_fix,
            master_buyrate.promo_period_start,
            master_buyrate.promo_period_end`
        )
        .from(`${mid_table} mid`)
        .join(
          `${master_buyrate} master_buyrate`,
          "mid.psp_id = master_buyrate.psp"
        )
        .join(
          `${buy_rate} psp_buyrate`,
          "master_buyrate.id = psp_buyrate.master_buyrate_id"
        )
        .where(condition)
        .get();
    } catch (error) {
      console.error("Database query failed:", error);
    } finally {
      qb.release();
    }
    /*
        let sql = `SELECT
                psp_buyrate.*,
                master_buyrate.refund_fees_per,
                master_buyrate.refund_fees_fix,
                master_buyrate.promo_period_start,
                master_buyrate.promo_period_end

            FROM
                ${mid_table} mid
            JOIN ${master_buyrate} master_buyrate ON
                mid.psp_id = mater_buyrate.psp
            JOIN ${buy_rate} psp_buyrate ON
                master_buyrate.id = psp_buyrate.master_buyrate_id
            WHERE
                mid.submerchant_id = ${merchant_id}
                AND mid.terminal_id = ${terminal_id}
                AND mid.deleted = 0 
                AND LOWER(psp_buyrate.payment_methods) = '${await makeLower(payment_method)}' 
                AND LOWER(psp_buyrate.payment_schemes) = '${await removeUnderScore(scheme)}'
                AND LOWER(psp_buyrate.dom_int) = '${await makeLower(is_domestic_international)}' 
                AND psp_buyrate.deleted = 0 
                AND master_buyrate.currency = '${currency}' 
                AND master_buyrate.psp = ${psp_id}`;

        
        let qb = await pool.get_connection();
        response = await qb.query(sql);
        qb.release();
        */
  }

  await getBuyRateData();

  if (!response || response.length === 0) {
    return {};
  }

  const {
    promo_period_end,
    promo_period_start,
    buy_rate_fix,
    buy_rate_per,
    tax,
    refund_fees_per,
    refund_fees_fix,
  } = response[0];

  if (
    promo_period_end !== "0000-00-00" &&
    promo_period_start !== "0000-00-00"
  ) {
    const date_result = await momentFormat.checkBetween(
      currentDate,
      promo_period_start,
      promo_period_end
    );

    if (date_result) {
      await getBuyRatePromoData();

      if (promo_response && promo_response.length > 0) {
        const {
          id,
          promo_buy_rate_fix,
          promo_buy_rate_per,
          promo_tax,
          refund_fees_per,
          refund_fees_fix,
        } = promo_response[0];
        return {
          rate_fix: promo_buy_rate_fix || 0,
          rate_per: promo_buy_rate_per || 0,
          paydart_rate_fix: 0,
          paydart_rate_per: 0,
          tax: promo_tax || 0,
          refund_fees_per,
          refund_fees_fix,
        };
      }
    }
  }

  return {
    rate_fix: buy_rate_fix || 0,
    rate_per: buy_rate_per || 0,
    paydart_rate_fix: 0,
    paydart_rate_per: 0,
    tax: tax || 0,
    refund_fees_per,
    refund_fees_fix,
  };
}

async function storeTransaction(data) {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .returning("id")
      .insert(`${config.table_prefix}transaction_charges`, data);
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  return response;
}

async function getMidData(data) {
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb
      .select("*")
      .from(`${config.table_prefix}mid`)
      .where({
        submerchant_id: data.merchant_id,
        deleted: 0,
        psp_id: data.psp_id,
        env: data.mode,
      })
      .like("payment_schemes", data.scheme)
      .get();
      console.log(qb.last_query());
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }

  return response?.[0];
}

module.exports = {
  getMerchantSellRate,
  storeTransaction,
  getMerchantByRate,
  getMidData,
  fetchMerchantDetails,
  getMerchantDefaultSellRate
};
