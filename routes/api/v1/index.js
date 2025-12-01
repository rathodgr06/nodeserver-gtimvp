const express = require("express");
const app = express();
const multerUploader = require("../../../uploads/multer");
const multipleupload = require("../../../uploads/multipleupload");
const invlogoUpload = require("../../../uploads/inv_logoupload");
const supportTicketUpload = require("../../../uploads/ticketUpload");
const commentUpload = require("../../../uploads/comment_upload");
const multipleupload_logo = require("../../../uploads/multipleupload_logo");
const multipleupdateupload = require("../../../uploads/multipleupdateupload");
const multipledocupload = require("../../../uploads/multipledocupload");
const multipleupload_branding = require("../../../uploads/multipleupload_branding");
const multipleupload_owners = require("../../../uploads/multipleupload_owners");
// const multipleupload_owners_indi = require("../../../uploads/multipleupload_indi");
const uploadCustomerProfilePic = require("../../../uploads/uploadcustomerprofile");
/*Validator Imported*/
const invoice = require("../../../controller/invoice");
const responseImport = require("../../../controller/response_import");
const logsController = require("../../../controller/logsController");
const responseCode = require("../../../controller/response_codes");
const QR_payment = require("../../../controller/merchant_qr_payment");
const Validator = require("../../../utilities/validations/index");
const Auth = require("../../../controller/auth");
const Designation = require("../../../controller/designation");
const Documentation = require("../../../controller/documentation");
const Department = require("../../../controller/department");
const Entity = require("../../../controller/entity");
const MccCategory = require("../../../controller/mcc_category");
const Mcc = require("../../../controller/mcc");
const Currency = require("../../../controller/currency");
const Customers = require("../../../controller/customers");
const Type_of_business = require("../../../controller/type_of_business");
const Merchant_user = require("../../../controller/merchant_user");
const Language = require("../../../controller/language");
const merchant = require("../../../controller/merchant");
const cron = require("../../../controller/cronjobs");
const submerchant = require("../../../controller/submerchant");
const PspValidator = require("../../../utilities/validations/psp");
const CustomerValidator = require("../../../utilities/validations/customers");
const MerchantRegisterValidator = require("../../../utilities/validations/merchant_registration");
const MerchantEkycValidator = require("../../../utilities/validations/merchant_ekyc");

const MerchantDetailsById = require("../../../utilities/validations/fetchMerchantDetails");
const MerchantOrderValidator = require("../../../utilities/validations/merchantOrderValidator");
const SecurityQuestions = require("../../../controller/security_questions");
//admin
const admin_user = require("../../../controller/admin_user");
const partner = require("../../../controller/partner");
const Dashboard = require("../../../controller/dashboard");

//merchant
const merchant_category = require("../../../controller/merchant_category");
const countries = require("../../../controller/country");
const bus_reg_countries = require("../../../controller/business_reg_country");
const ph_num_countries = require("../../../controller/ph_num_country");
const states = require("../../../controller/state");
const city = require("../../../controller/city");
const logs = require("../../../controller/logs");
const mobile_logs = require("../../../controller/mobile_logs");
const Setting = require("../../../controller/setting");
const Order = require("../../../controller/order");
/*Psp controller*/
const Psp = require("../../../controller/psp");
/*Merchant Register Controller*/
const MerchantRegister = require("../../../controller/merchant_registration");
const MerchantEkyc = require("../../../controller/merchant_ekyc");
const MerchantOrder = require("../../../controller/merchantOrder");
const telrNew = require("../../../controller/telr_new");
const TestOrder = require("../../../controller/testOrders");
const QR_generate = require("../../../controller/merchant_qr_code");
const Nationality = require("../../../controller/nationality");
const PayoutController = require("../../../controller/PayoutController.js");
const MerchantSetup = require("../../../controller/MerchantSetup.js");

//paydart controller
const ni = require("../../../controller/ni");

/* file upload start*/
//const multerUploader = require('../../../uploads/multer');
const uploadedPanel = require("../../../uploads/uploadedPanel");
/*File upload end*/
/* Transaction setup start*/
const Transaction_setup = require("../../../controller/charges_transaction_setup");
const Transaction_validation = require("../../../utilities/validations/charges_transaction_setup");
const merchant_charges = require("../../../utilities/validations/charges_merchant_maintenance");
const merchantMaintenance = require("../../../controller/charges_merchant_maintenance");
const QR_validation = require("../../../utilities/validations/qr_validation");
const invoiceValidation = require("../../../utilities/validations/invoiceValidation");
// const Transaction_validation = require('../../../utilities/validations/charges_transaction_setup')
/* Transaction setup end*/
/*O Auth2 Manager*/
const CheckHeader = require("../../../utilities/tokenmanager/headers");
const CheckOpenApiHeader = require("../../../utilities/tokenmanager/openAPIHeader");
const CheckAuth = require("../../../utilities/tokenmanager/authmanager");
const CheckToken = require("../../../utilities/tokenmanager/checkToken");
const CheckMerchantToken = require("../../../utilities/tokenmanager/checkMerchantToken");
const CheckCustomerToken = require("../../../utilities/tokenmanager/checkCustomerToken");
const CheckCustomToken = require("../../../utilities/tokenmanager/checkCustomToken");
const checkEKYCToken = require("../../../utilities/tokenmanager/checkEKYCToken");
const RefreshToken = require("../../../utilities/tokenmanager/refreshToken");
const MerchantRegistration = require("../../../controller/merchant_registration");
const Document_type = require("../../../controller/document_type");
const CheckMerchantCred = require("../../../utilities/tokenmanager/checkMerchantCred");
const checkOrderToken = require("../../../utilities/tokenmanager/checkOrderToken");
const FraudCheck = require("../../../utilities/fraud_ip_detector/index.js");
const ChargeCalculator = require("../../../utilities/charges-calculator/index");
/** Referer module */
const ReferrerValidator = require("../../../utilities/validations/referrer_validation");
const MUsersValidator = require("../../../utilities/validations/merchant_users");
const ReferrerUpload = require("../../../uploads/referrer_upload");
const Referrer = require("../../../controller/referrer");
/** Referrer Module end*/
/** Subscription plan and referral bonus module*/
const referral_bonus = require("../../../controller/referral_bonus");
const referralBonusController = require("../../../controller/referralBonusController");
const subs_plan = require("../../../controller/subs_plan");
const ReferralBonusValidator = require("../../../utilities/validations/referral_bonus_validation");
const SubscriptionPlanValidator = require("../../../utilities/validations/subscription_plan_validation");
/** Subscription plan and referral bonus module End*/
const ExcelImportUpload = require("../../../uploads/excel_import");
const { validate } = require("uuid");
const Referral_Bonus_Validator = require("../../../utilities/validations/referral_bonus_validator");
const referral_bonus_invoice = require("../../../controller/referral_bonus_invoice");
const ReferralBonusInvoiceValidator = require("../../../utilities/validations/referral_bonus_invoice_validator.");
const charges_invoice_controller = require("../../../controller/charges_invoice_controller");
const charges_invoice_validator = require("../../../utilities/validations/charges_invoice_validator");
const support_ticket_validator = require("../../../utilities/validations/support_ticket_validator");
const support_ticket_controller = require("../../../controller/support_ticket_controller");
const checkToken = require("../../../utilities/tokenmanager/checkToken");
const ip_lookup = require("../../../utilities/ip-lookup/index");
const transaction = require("../../../controller/charges_transaction_setup");
const webHook = require("../../../controller/webhook_settings");
const webHookValidator = require("../../../utilities/validations/webhook_validation");
const rules_document = require("../../../controller/rule_documents.js");
const payment_validation = require("../../../utilities/validations/payment_validation");
const qr_validation = require("../../../utilities/validations/qr_validation");
const PayTabsValidator = require("../../../utilities/validations/paytabs.validation");
const PayTabsController = require("../../../controller/PaytabsController");
const TerminalController = require("../../../controller/termial.controller");
const NewTerminalController = require("../../../controller/new.termial.controller");
const AppleRoutingController = require("../../../controller/applepay_routing");
const lookupValidatior = require("../../../utilities/validations/lookupvalidation");
const lookup = require("../../../controller/lookup");
const pricing_plan = require("../../../controller/pricing_plan");
const pricing_plan_validator = require("../../../utilities/validations/pricing_plan");
const checkTestMerchantCred = require("../../../utilities/tokenmanager/checkTestMerchantCred");
const checkOpenMerchantCred = require("../../../utilities/tokenmanager/checkOpenMerchantCred");
//const ApplePay = require("../../../controller/ApplePayController");
const bonus_calculation = require("../../../controller/bonus_calculation_controller");
const subscription_card_expired = require("../../../controller/subscription_card_expired_controller");
const ni_apple_pay = require("../../../controller/ni_apple_pay");
const paytabs_apple_pay = require("../../../controller/paytabs_apple_pay");
const minMaxTxnAmountChecker = require("../../../utilities/transactionAmountChecker");

//after some time have to remove it
const calculateTransactionCharges = require("../../../utilities/charges/transaction-charges/index");

const chargesController = require("../../../controller/charges_controller.js");
const rateLimiter = require("../../../utilities/rate-limiter/index.js");
let DapiValidator = require("../../../utilities/validations/dapi.js");
let autoCapture = require("../../../utilities/auto/auto-capture.js");
let autoCaptureTest = require("../../../utilities/auto/auto-capture-test.js");
const DapiController = require("../../../controller/dapi.js");
const RecurringController = require("../../../controller/recurringController.js");
const RoutingController = require("../../../controller/routingController.js");
const RoutingRuleValidator = require("../../../utilities/validations/routing_rule_validator.js");
const telr_apple_pay = require("../../../controller/telr_apple_pay.js");
const fraudEngine = require("../../../utilities/fraud/index.js");
const encrypt_decrypt = require("../../../utilities/decryptor/encrypt_decrypt");
const merchantToken = require("../../../utilities/tokenmanager/merchantToken");

const node_cron = require("node-cron");
const schedule = require("node-schedule");
const TelrAutoCapture = require("../../../utilities/auto/telrAutoCapture.js");
const MPGSValidator = require("../../../utilities/validations/mpgs_validator.js");
const mpgs_session = require("../../../controller/mpgs/session.js");
const mpgs_3ds = require("../../../controller/mpgs/threeds.js");
const directpay = require("../../../controller/myf/directpay.js");
const myf_3ds = require("../../../controller/myf/threeds.js");
const fiserv_pay = require("../../../controller/fiserv/pay.js");
const fiserv_validation = require("../../../utilities/validations/fiserv_validation.js");
const fiserv_3ds = require("../../../controller/fiserv/threeds.js");
const update_3ds = require("../../../controller/fiserv/update3ds.js");
const S2SValidator = require("../../../utilities/validations/s2s.js");
const execuatePayment = require("../../../controller/s2s/execute-payment.js");
const s2s_3ds = require("../../../controller/s2s/threeds.js");
const MtnMomoValidator = require("../../../utilities/validations/mobile_pay_validation.js");
const mtnPay = require("../../../controller/mtn/Pay.js");
const mtnPaySandbox = require("../../../controller/mtn-sandbox/Pay.js");
const fundingDetials = require("../../../utilities/validations/funding_details.js");
const uploadBankDocument = require("../../../uploads/bank_document_upload.js");
const payoutValidator = require("../../../utilities/validations/payout.js");
const orange_verify = require("../../../controller/orange/Verify");
const orange_pay = require("../../../controller/orange/Pay.js");
const orange_confirm = require("../../../controller/orange/confirm.js");
const ipChecker = require('../../../utilities/tokenmanager/ipChecker.js');
const WalletValidator = require("../../../utilities/validations/wallet_list.js");
const wallet = require("../../../controller/wallet.js");
const walletRollout = require("../../../utilities/wallet-snap/index.js");
const APIAuth = require("../../../utilities/API/Auth.js");
const verifyOrangeSandbox = require("../../../controller/orange-sandbox/Verify.js");
const payOrangeSandbox = require("../../../controller/orange-sandbox/Pay.js");
const confirmOrangeSandbox =require("../../../controller/orange-sandbox/confirm.js");
const verifyAlPay= require('../../../controller/AlPay/Verify.js');
const payAlPay = require("../../../controller/AlPay/Pay.js");
const confirmAlpay = require("../../../controller/AlPay/confirm.js");
const superMerchantLogoUpload = require("../../../uploads/merchantLogoUpload.js")
const { apiRateLimiter } = require('../../../utilities/api-ratelimiter/index.js');
app.post("/login", CheckHeader, Validator.login, Auth.login);
app.post("/generate-token", async function (req, res) {
  payload = {
    email: req.email,
    id: req.id,
    super_merchant_id: req.super_merchant_id,
    mode: req.mode,
    name: req.name,
    type: "merchant",
  };
  payload = encrypt_decrypt("encrypt", JSON.stringify(payload));
  const aToken = merchantToken(payload);
  console.log(aToken);
});
app.post(
  "/admin/login/verify-2fa",
  CheckHeader,
  Validator.verify_2fa,
  Auth.verify
);
app.post(
  "/forget-password",
  CheckHeader,
  Validator.forget_password,
  Auth.forget_password
);
app.post("/reset-pwd", CheckHeader, Validator.reset_forget_pwd);
app.post(
  "/reset",
  CheckHeader,
  Validator.reset_forget_password,
  Auth.updateForgetPassword
);
app.post(
  "/change-password",
  CheckHeader,
  CheckToken,
  Validator.change_password,
  Auth.changepassword
);

//app.post('/merchant/login',CheckHeader, Validator.partner_login, Auth.merchantlogin);

// app.post('/token', RefreshToken)
// app.get('/profile', CheckToken, Auth.profile);
// app.post('/update-password', Validator.updatePassword, Auth.updatePassword);

//Dashboard
app.post("/dashboard", CheckHeader, CheckToken, Dashboard.dashboard);
app.post("/dashboard/revenue", CheckHeader, CheckToken, Dashboard.revenue);
app.post(
  "/dashboard/blocked-txn",
  CheckHeader,
  CheckToken,
  Dashboard.blocked_txn
);
app.post("/dashboard/psp-txn", CheckHeader, CheckToken, Dashboard.psp_txn);
//app.post('/transaction-total', CheckHeader, CheckToken, Dashboard.transaction_total);
// app.post('/psp-total', CheckHeader, CheckToken, Dashboard.psp_total);
// app.post('/merchants-total', CheckHeader, CheckToken, Dashboard.merchant_total)
//Admin
app.post(
  "/admin/register",
  // CheckHeader,
  CheckToken,
  multerUploader.uploadUserProfilePic,
  Validator.register,
  admin_user.register
);
app.post(
  "/admin/forget-2fa",
  CheckHeader,
  CheckToken,
  Validator.forgot_2fa,
  admin_user.forgot_2fa
);
app.post(
  "/admin/reset-admin-2fa",
  CheckHeader,
  Validator.reset_admin_2fa,
  admin_user.reset_2fa
);
app.post(
  "/admin/generate-2fa",
  CheckHeader,
  Validator.generate_2fa,
  admin_user.generate_2fa_qr
);
app.post(
  "/admin/verify-2fa",
  CheckHeader,
  Validator.verify_2fa,
  admin_user.verify_2fa
);
app.post("/admin/list", CheckHeader, CheckToken, admin_user.list);
app.post(
  "/admin/password",
  CheckHeader,
  CheckToken,
  Validator.admin_details,
  admin_user.password
);
app.post(
  "/admin/details",
  CheckHeader,
  CheckToken,
  Validator.admin_details,
  admin_user.admin_details
);
app.post(
  "/admin/update",
  CheckHeader,
  CheckToken,
  multerUploader.uploadUserProfilePic,
  Validator.admin_details_update,
  admin_user.update
);
app.post(
  "/admin/deactivate",
  CheckHeader,
  CheckToken,
  Validator.admin_deactivate,
  admin_user.deactivate
);
app.post(
  "/admin/activate",
  CheckHeader,
  CheckToken,
  Validator.admin_activate,
  admin_user.activate
);
app.post(
  "/admin/delete",
  CheckHeader,
  CheckToken,
  Validator.admin_delete,
  admin_user.delete
);
app.post(
  "/admin/block",
  CheckHeader,
  CheckToken,
  Validator.admin_blocked,
  admin_user.blocked
);
app.post(
  "/admin/unblock",
  CheckHeader,
  CheckToken,
  Validator.admin_unblocked,
  admin_user.unblocked
);

//partner
app.post(
  "/partner/add",
  CheckHeader,
  CheckToken,
  Validator.partner_add,
  partner.add
);
app.post("/partner/list", CheckHeader, CheckToken, partner.list);
app.post("/partner/list/filter", CheckHeader, CheckToken, partner.filter_list);
app.post(
  "/partner/details",
  CheckHeader,
  CheckToken,
  Validator.partner_details,
  partner.details
);
app.post(
  "/partner/password",
  CheckHeader,
  CheckToken,
  Validator.partner_details,
  partner.password
);
app.post(
  "/partner/update",
  CheckHeader,
  CheckToken,
  Validator.partner_update,
  partner.update
);
app.post(
  "/partner/deactivate",
  CheckHeader,
  CheckToken,
  Validator.partner_deactivate,
  partner.deactivate
);
app.post(
  "/partner/activate",
  CheckHeader,
  CheckToken,
  Validator.partner_activate,
  partner.activate
);
app.post(
  "/partner/delete",
  CheckHeader,
  CheckToken,
  Validator.partner_delete,
  partner.delete
);
app.post(
  "/partner/block",
  CheckHeader,
  CheckToken,
  Validator.partner_blocked,
  partner.blocked
);
app.post(
  "/partner/unblock",
  CheckHeader,
  CheckToken,
  Validator.partner_unblocked,
  partner.unblocked
);

//merchant
app.post(
  "/merchant/add",
  CheckHeader,
  CheckToken,
  Validator.merchant_add,
  merchant.add
);
app.post("/merchant/list", CheckHeader, CheckToken, merchant.list);
app.post(
  "/merchant/list/filter",
  CheckHeader,
  CheckToken,
  merchant.filter_list
);
app.post(
  "/merchant/details",
  CheckHeader,
  CheckToken,
  Validator.merchant_details,
  merchant.details
);
app.post(
  "/merchant/password",
  CheckHeader,
  CheckToken,
  Validator.merchant_details,
  merchant.password
);
app.post(
  "/merchant/update",
  CheckHeader,
  CheckToken,
  Validator.merchant_update,
  merchant.update
);
app.post(
  "/merchant/deactivate",
  CheckHeader,
  CheckToken,
  Validator.merchant_deactivate,
  merchant.deactivate
);
app.post(
  "/merchant/activate",
  CheckHeader,
  CheckToken,
  Validator.merchant_activate,
  merchant.activate
);
app.post(
  "/merchant/delete",
  CheckHeader,
  CheckToken,
  Validator.merchant_delete,
  merchant.delete
);
app.post(
  "/merchant/block",
  CheckHeader,
  CheckToken,
  Validator.merchant_blocked,
  merchant.blocked
);
app.post(
  "/merchant/unblock",
  CheckHeader,
  CheckToken,
  Validator.merchant_unblocked,
  merchant.unblocked
);
app.post(
  "/merchant/branding",
  CheckHeader,
  CheckMerchantToken,
  multipleupload_branding,
  Validator.merchant_branding,
  merchant.branding_update
);

//sub-merchant
app.post(
  "/submerchant/add",
  CheckHeader,
  CheckMerchantToken,
  Validator.submerchant_add,
  submerchant.add
);
app.post(
  "/submerchant/list",
  CheckHeader,
  CheckMerchantToken,
  submerchant.list
);
app.post("/merchant_adminekyc/list", CheckHeader, merchant.list_merchant);
app.post("/merchant_adminekyc/add", CheckHeader, merchant.add_meeting);
app.post(
  "/merchant_adminekyc/update_meeting",
  CheckHeader,
  merchant.update_meeting
);
app.post(
  "/merchant_ekyc/meeting_list",
  CheckHeader,
  CheckMerchantToken,
  merchant.list_merchant_meeting
);
app.post(
  "/submerchant/features/add",
  CheckHeader,
  CheckToken,
  Validator.submerchant_features_add,
  submerchant.submerchant_features_add
);
app.post(
  "/submerchant/details",
  CheckHeader,
  CheckMerchantToken,
  Validator.submerchant_details,
  submerchant.details
);
app.post(
  "/submerchant/psp-list",
  CheckHeader,
  CheckToken,
  Validator.submerchant_psp,
  submerchant.psp_list
);
app.post(
  "/submerchant/update",
  CheckHeader,
  CheckMerchantToken,
  Validator.submerchant_update,
  submerchant.update
);

app.post(
  "/submerchant/deactivate",
  CheckHeader,
  CheckMerchantToken,
  Validator.submerchant_deactivate,
  submerchant.deactivate
);
app.post(
  "/submerchant/activate",
  CheckHeader,
  CheckMerchantToken,
  Validator.submerchant_activate,
  submerchant.activate
);
app.post(
  "/submerchant/delete",
  CheckHeader,
  CheckMerchantToken,
  Validator.submerchant_delete,
  submerchant.delete
);
app.post(
  "/submerchant/add-mid",
  CheckHeader,
  CheckMerchantToken,
  submerchant.add_mid
);
app.post(
  "/submerchant/delete-mid",
  CheckHeader,
  CheckMerchantToken,
  Validator.submerchant_delete_mid,
  submerchant.delete_mid
);
app.post(
  "/submerchant/branding_details",
  CheckHeader,
  CheckMerchantToken,
  submerchant.branding_details
);
app.post(
  "/submerchant/branding",
  CheckHeader,
  CheckMerchantToken,
  multipleupload_branding,
  // Validator.merchant_branding,
  submerchant.branding_update
);

// app.post(
//   "/submerchant/branding",
//   function(req,res,next) {
//     console.log(`second route`);
//     next();

//   },
//   CheckHeader,
//   CheckMerchantToken,
//   multipleupload_branding,
//   Validator.merchant_branding,
//   submerchant.branding_update
// );

app.post(
  "/submerchant/mid-currency",
  CheckHeader,
  CheckMerchantToken,
  Validator.mid_currency,
  submerchant.mid_currency
);
app.post(
  "/submerchant/draft",
  CheckHeader,
  CheckMerchantToken,
  multipleupload_branding,
  Validator.merchant_draft,
  submerchant.draftSave
);


app.post(
  "/submerchant/reset_branding",
  CheckHeader,
  CheckMerchantToken,
  Validator.reset_branding,
  submerchant.resetBranding
);

// app.post(
//     "/submerchant/card-payment-list",
//     CheckHeader,
//     CheckMerchantToken,
//     submerchant.get_card_payment_method
// );

//designation
app.post(
  "/designation/add",
  CheckHeader,
  CheckToken,
  Validator.designation_add,
  Designation.add
);
app.post("/designation/list", CheckHeader, CheckToken, Designation.list);
app.post(
  "/designation/details",
  CheckHeader,
  CheckToken,
  Validator.designation_details,
  Designation.details
);
app.post(
  "/designation/update",
  CheckHeader,
  CheckToken,
  Validator.designation_update,
  Designation.update
);
app.post(
  "/designation/deactivate",
  CheckHeader,
  CheckToken,
  Validator.designation_deactivate,
  Designation.deactivate
);
app.post(
  "/designation/activate",
  CheckHeader,
  CheckToken,
  Validator.designation_activate,
  Designation.activate
);
app.post(
  "/designation/delete",
  CheckHeader,
  CheckToken,
  Validator.designation_delete,
  Designation.delete
);

//department
app.post(
  "/department/add",
  CheckHeader,
  CheckToken,
  Validator.department_add,
  Department.add
);
app.post("/department/list", CheckHeader, CheckToken, Department.list);
app.post(
  "/department/details",
  CheckHeader,
  CheckToken,
  Validator.department_details,
  Department.details
);
app.post(
  "/department/update",
  CheckHeader,
  CheckToken,
  Validator.department_update,
  Department.update
);
app.post(
  "/department/deactivate",
  CheckHeader,
  CheckToken,
  Validator.department_deactivate,
  Department.deactivate
);
app.post(
  "/department/activate",
  CheckHeader,
  CheckToken,
  Validator.department_activate,
  Department.activate
);
app.post(
  "/department/delete",
  CheckHeader,
  CheckToken,
  Validator.department_delete,
  Department.delete
);

//type_of_business
app.post(
  "/type_of_business/add",
  CheckHeader,
  CheckToken,
  Validator.type_of_business_add,
  Type_of_business.add
);
app.post(
  "/type_of_business/list",
  CheckHeader,
  CheckToken,
  Type_of_business.list
);
app.post(
  "/type_of_business/details",
  CheckHeader,
  CheckToken,
  Validator.type_of_business_details,
  Type_of_business.details
);
app.post(
  "/type_of_business/update",
  CheckHeader,
  CheckToken,
  Validator.type_of_business_update,
  Type_of_business.update
);
app.post(
  "/type_of_business/deactivate",
  CheckHeader,
  CheckToken,
  Validator.type_of_business_deactivate,
  Type_of_business.deactivate
);
app.post(
  "/type_of_business/activate",
  CheckHeader,
  CheckToken,
  Validator.type_of_business_activate,
  Type_of_business.activate
);
app.post(
  "/type_of_business/delete",
  CheckHeader,
  CheckToken,
  Validator.type_of_business_delete,
  Type_of_business.delete
);

//currency
app.post(
  "/currency/add",
  CheckHeader,
  CheckToken,
  Validator.currency_add,
  Currency.add
);
app.post("/currency/list", CheckHeader, Currency.list);
app.post(
  "/currency/list_form_mid",
  CheckHeader,
  CheckToken,
  Currency.list_form_mid
);
app.post(
  "/currency/details",
  CheckHeader,
  CheckToken,
  Validator.currency_details,
  Currency.details
);
app.post(
  "/currency/update",
  CheckHeader,
  CheckToken,
  Validator.currency_update,
  Currency.update
);
app.post(
  "/currency/deactivate",
  CheckHeader,
  CheckToken,
  Validator.currency_deactivate,
  Currency.deactivate
);
app.post(
  "/currency/activate",
  CheckHeader,
  CheckToken,
  Validator.currency_activate,
  Currency.activate
);
app.post(
  "/currency/delete",
  CheckHeader,
  CheckToken,
  Validator.currency_delete,
  Currency.delete
);

// //merchant category
// app.post('/merchant/category/add',CheckToken, Validator.merchant_category_add, merchant_category.add);
// app.post('/merchant/category/list',CheckToken,  merchant_category.list);
// app.post('/merchant/category/details',CheckToken, Validator.merchant_category_details, merchant_category.details);
// app.post('/merchant/category/update',CheckToken, Validator.merchant_category_update, merchant_category.update);

//Business register countries

app.post(
  "/bus-reg-country/add",
  CheckHeader,
  CheckToken,
  Validator.bus_reg_country_add,
  bus_reg_countries.add
);
app.post("/bus-reg-country/list", CheckHeader, bus_reg_countries.list);
app.post(
  "/bus-reg-country/details",
  CheckHeader,
  CheckToken,
  Validator.bus_reg_country_details,
  bus_reg_countries.details
);
app.post(
  "/bus-reg-country/update",
  CheckHeader,
  CheckToken,
  Validator.bus_reg_country_update,
  bus_reg_countries.update
);
app.post(
  "/bus-reg-country/deactivate",
  CheckHeader,
  CheckToken,
  Validator.bus_reg_country_deactivate,
  bus_reg_countries.country_deactivate
);
app.post(
  "/bus-reg-country/activate",
  CheckHeader,
  CheckToken,
  Validator.bus_reg_country_activate,
  bus_reg_countries.country_activate
);
app.post(
  "/bus-reg-country/delete",
  CheckHeader,
  CheckToken,
  Validator.bus_reg_country_delete,
  bus_reg_countries.country_delete
);

//Phone number countries

app.post(
  "/ph-num-country/add",
  CheckHeader,
  CheckToken,
  Validator.ph_num_country_add,
  ph_num_countries.add
);
app.post("/ph-num-country/list", CheckHeader, ph_num_countries.list);
app.post(
  "/ph-num-country/details",
  CheckHeader,
  CheckToken,
  Validator.ph_num_country_details,
  ph_num_countries.details
);
app.post(
  "/ph-num-country/update",
  CheckHeader,
  CheckToken,
  Validator.ph_num_country_update,
  ph_num_countries.update
);
app.post(
  "/ph-num-country/deactivate",
  CheckHeader,
  CheckToken,
  Validator.ph_num_country_deactivate,
  ph_num_countries.country_deactivate
);
app.post(
  "/ph-num-country/activate",
  CheckHeader,
  CheckToken,
  Validator.ph_num_country_activate,
  ph_num_countries.country_activate
);
app.post(
  "/ph-num-country/delete",
  CheckHeader,
  CheckToken,
  Validator.ph_num_country_delete,
  ph_num_countries.country_delete
);

//countries

app.post(
  "/country/add",
  CheckHeader,
  CheckToken,
  Validator.country_add,
  countries.add
);
app.post("/country/list", CheckHeader, countries.list);
app.post(
  "/country/details",
  CheckHeader,
  CheckToken,
  Validator.country_details,
  countries.details
);
app.post(
  "/country/update",
  CheckHeader,
  CheckToken,
  Validator.country_update,
  countries.update
);
app.post(
  "/country/deactivate",
  CheckHeader,
  CheckToken,
  Validator.country_deactivate,
  countries.country_deactivate
);
app.post(
  "/country/activate",
  CheckHeader,
  CheckToken,
  Validator.country_activate,
  countries.country_activate
);
app.post(
  "/country/delete",
  CheckHeader,
  CheckToken,
  Validator.country_delete,
  countries.country_delete
);

//state
app.post(
  "/state/add",
  CheckHeader,
  CheckToken,
  Validator.state_add,
  states.add
);
app.post("/state/list", CheckHeader, Validator.state_list, states.list);
app.post(
  "/state/details",
  CheckHeader,
  CheckToken,
  Validator.state_details,
  states.details
);
app.post(
  "/state/update",
  CheckHeader,
  CheckToken,
  Validator.state_update,
  states.update
);
app.post(
  "/state/deactivate",
  CheckHeader,
  CheckToken,
  Validator.state_deactivate,
  states.states_deactivate
);
app.post(
  "/state/activate",
  CheckHeader,
  CheckToken,
  Validator.state_activate,
  states.states_activate
);
app.post(
  "/state/delete",
  CheckHeader,
  CheckToken,
  Validator.state_delete,
  states.states_delete
);

//city
app.post("/city/add", CheckHeader, CheckToken, Validator.city_add, city.add);
app.post("/city/list", CheckHeader, Validator.city_list, city.list);
app.post(
  "/city/details",
  CheckHeader,
  CheckToken,
  Validator.city_details,
  city.details
);
app.post(
  "/city/update",
  CheckHeader,
  CheckToken,
  Validator.city_update,
  city.update
);
app.post(
  "/city/deactivate",
  CheckHeader,
  CheckToken,
  Validator.city_deactivate,
  city.deactivate
);
app.post(
  "/city/activate",
  CheckHeader,
  CheckToken,
  Validator.city_activate,
  city.activate
);
app.post(
  "/city/delete",
  CheckHeader,
  CheckToken,
  Validator.city_delete,
  city.delete
);

//language
app.post(
  "/language/add",
  CheckHeader,
  CheckToken,
  multipleupload,
  Validator.language_add,
  Language.add
);
app.post("/language/list", CheckHeader, Language.list);
app.post(
  "/language/details",
  //CheckHeader,
  Validator.language_details,
  Language.details
);
app.post(
  "/language/update",
  CheckHeader,
  CheckToken,
  multipleupdateupload,
  Validator.language_update,
  Language.update
);
app.post(
  "/language/deactivate",
  CheckHeader,
  CheckToken,
  Validator.language_deactivate,
  Language.deactivate
);
app.post(
  "/language/activate",
  CheckHeader,
  CheckToken,
  Validator.language_activate,
  Language.activate
);
app.post(
  "/language/delete",
  CheckHeader,
  CheckToken,
  Validator.language_delete,
  Language.delete
);

//setting
app.post(
  "/setting/language/change",
  CheckHeader,
  CheckToken,
  Validator.language_details,
  Setting.change_language
);
app.post("/setting/env/change", CheckHeader, CheckToken, Setting.change_env);
app.post(
  "/setting/merchant/change",
  CheckHeader,
  CheckMerchantToken,
  Setting.change_sub_merchant
);
app.post(
  "/setting/theme/change",
  CheckHeader,
  CheckToken,
  Validator.theme_change,
  Setting.change_theme
);
app.post("/setting/header/info", CheckHeader, CheckToken, Setting.header_info);
app.post("/setting/header/login/info", CheckHeader, Setting.login_info);
app.post(
  "/setting/company/details",
  CheckHeader,
  CheckToken,
  Setting.company_info
);
app.post("/setting/smtp/details", CheckHeader, CheckToken, Setting.smtp_info);
app.post(
  "/setting/company/update",
  CheckHeader,
  CheckToken,
  multipleupload_logo,
  Validator.company_update,
  Setting.company_update
);
app.post(
  "/setting/company/smtp",
  CheckHeader,
  CheckToken,
  Validator.smtp_update,
  Setting.smtp_update
);
app.post(
  "/transaction-limit",
  CheckHeader,
  CheckToken,
  Setting.add_transaction_limit
);
app.post(
  "/transaction-limit-details",
  CheckHeader,
  CheckToken,
  Setting.details_transaction_limit
);
app.post(
  "/transaction-limit/delete",
  CheckHeader,
  CheckToken,
  Setting.delete_transaction
);
app.post(
  "/suspicious-ip/list",
  CheckHeader,
  CheckToken,
  Setting.suspicious_ip_list
);
app.post(
  "/suspicious-ip/delete",
  CheckHeader,
  CheckToken,
  Setting.delete_suspicious_ip
);
app.post(
  "/suspicious-ip/add",
  CheckHeader,
  CheckToken,
  Validator.suspicious_ip_add,
  Setting.add_suspicious_ip
);
app.post(
  "/fraud-detection/details",
  CheckHeader,
  CheckToken,
  Setting.get_fraud_detection
);
app.post(
  "/fraud-detection/update",
  CheckHeader,
  CheckToken,
  Validator.fraud_detection_update,
  Setting.update_fraud_detections
);
//documentation
app.post(
  "/documentation/tc/add",
  CheckHeader,
  CheckToken,
  Validator.tc_add,
  Documentation.add
);
app.post("/documentation/tc/list", CheckHeader, CheckToken, Documentation.list);
app.post(
  "/documentation/tc/details",
  CheckHeader,
  CheckToken,
  Validator.tc_details,
  Documentation.details
);
app.post("/auth/tc/details", CheckHeader, Documentation.auth_tc);
app.post(
  "/documentation/tc/update",
  CheckHeader,
  CheckToken,
  Validator.tc_update,
  Documentation.update
);
app.post(
  "/documentation/tc/delete",
  CheckHeader,
  CheckToken,
  Validator.tc_delete,
  Documentation.delete
);

//Create Order
app.post("/transactions/list", CheckHeader, CheckToken, Order.list);
app.post("/transactions/export-list", CheckHeader, CheckToken, Order.export_list);
app.post("/transactions/requests", CheckHeader, CheckToken, Order.requests);
app.post("/transactions/payment_id", CheckHeader, CheckToken, Order.payment_id);
app.post(
  "/transactions/details",
  CheckHeader,
  CheckToken,
  Validator.transaction_details,
  Order.details
);
app.post("/order/payment/mode", CheckHeader, CheckToken, Order.payment_status);
//update-profile-super-merchant
app.post(
  "/update/supermerchant",
  CheckHeader,
  CheckMerchantToken,
  Validator.update_profile,
  MerchantEkyc.update_profile
);
app.post(
  "/list/supermerchant",
  CheckHeader,
  CheckToken,
  MerchantEkyc.super_merchant_list
);
// super merchant routes
app.post(
  "/master-super-merchant/list",
  CheckHeader,
  CheckToken,
  MerchantEkyc.super_merchant_master
);
app.post(
  "/master-super-merchant/deactivate",
  CheckHeader,
  CheckMerchantToken,
  Validator.supermerchant_deactivate,
  MerchantEkyc.deactivate_supermerchant
);
app.post(
  "/master-super-merchant/activate",
  CheckHeader,
  CheckMerchantToken,
  Validator.supermerchant_activate,
  MerchantEkyc.activate_supermerchant
);
app.post(
  "/master-super-merchant/allow-mid",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkyc.allow_mid
);

app.post("/allow-mid-ticket", CheckHeader, MerchantEkyc.allow_mid_ticket);

app.post(
  "/master-super-merchant/allow-rules",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkyc.allow_rules
);
app.post("/allow-rules-ticket", CheckHeader, MerchantEkyc.allow_rules_ticket);
//logs
app.post("/logs/list", CheckHeader, CheckToken, logs.list);
// mcc code
app.post("/psp/get-mcc-code", CheckHeader, CheckToken, Psp.getMccCodes);
app.post(
  "/psp/currency",
  CheckHeader,
  CheckMerchantToken,
  Validator.psp_currency,
  Psp.psp_currency
);
app.post(
  "/psp/add",
  CheckHeader,
  CheckToken,
  multerUploader.uploadfile,
  uploadedPanel.captureFilename,
  PspValidator.add,
  Psp.add
);
app.post("/psp/list", CheckHeader, CheckToken, Psp.list);
app.post("/psp/details", CheckHeader, CheckToken, PspValidator.get, Psp.get);
app.post(
  "/psp/update",
  CheckHeader,
  CheckToken,
  multerUploader.uploadfile,
  uploadedPanel.captureFilename,
  PspValidator.update,
  Psp.update
);
app.post(
  "/psp/deactivate",
  CheckHeader,
  CheckToken,
  PspValidator.deactivate,
  Psp.deactivate
);
app.post(
  "/psp/activate",
  CheckHeader,
  CheckToken,
  PspValidator.activate,
  Psp.activate
);
app.post(
  "/psp/delete",
  CheckHeader,
  CheckToken,
  PspValidator.delete,
  Psp.delete
);

// Register merchant
app.post(
  "/merchant-onboarding/register",
  CheckHeader,
  MerchantRegisterValidator.register,
  MerchantRegister.register
);

// For open API user
app.post(
  "/merchant/register",
  CheckHeader,
  MerchantRegisterValidator.api_register,
  MerchantRegister.merchant_register
);
app.post(
  "/merchant-onboarding/check-verification-link",
  CheckHeader,
  MerchantRegisterValidator.verify_link
);
app.post(
  "/merchant-onboarding/reset-password",
  CheckHeader,
  MerchantRegisterValidator.reset_password,
  MerchantRegister.reset_password
);
app.post(
  "/merchant-onboarding/generate-2fa-qr",
  CheckHeader,
  MerchantRegisterValidator.twoFA,
  MerchantRegister.generate_2fa_qr
);
app.post(
  "/merchant/read-notification",
  CheckHeader,
  CheckToken,
  MerchantRegister.notificationUpdate
);
app.post(
  "/merchant/read-all-notification",
  CheckHeader,
  CheckToken,
  MerchantRegister.AllnotificationUpdate
);
app.post(
  "/merchant-onboarding/verify-2fa",
  CheckHeader,
  MerchantRegisterValidator.verify_2fa,
  MerchantRegistration.verify_2fa
);
app.post(
  "/merchant-onboarding/resend-verification-link",
  CheckHeader,
  MerchantRegisterValidator.resend_link,
  MerchantRegister.resend_link
);

//Entity type
app.post("/entity/add", CheckHeader, CheckToken, Entity.add);
app.post("/entity/list", CheckHeader, Entity.list);
app.post("/entity/list_for_onboard", CheckHeader, Entity.list_onboard);
app.post(
  "/entity/details",
  CheckHeader,
  CheckToken,
  Validator.entity_details,
  Entity.details
);
app.post("/entity/update", CheckHeader, CheckToken, Entity.update);
app.post(
  "/entity/deactivate",
  CheckHeader,
  CheckToken,
  Validator.entity_deactivate,
  Entity.deactivate
);
app.post(
  "/entity/activate",
  CheckHeader,
  CheckToken,
  Validator.entity_activate,
  Entity.activate
);
app.post(
  "/entity/delete",
  CheckHeader,
  CheckToken,
  Validator.entity_delete,
  Entity.delete
);

//MCC category
app.post(
  "/mcc_category/add",
  CheckHeader,
  CheckToken,
  Validator.mcc_category_add,
  MccCategory.add
);
app.post("/mcc_category/list", CheckHeader, CheckToken, MccCategory.list);
app.post(
  "/mcc_category/details",
  CheckHeader,
  CheckToken,
  Validator.mcc_category_details,
  MccCategory.details
);
app.post(
  "/mcc_category/update",
  CheckHeader,
  CheckToken,
  Validator.mcc_category_update,
  MccCategory.update
);
app.post(
  "/mcc_category/deactivate",
  CheckHeader,
  CheckToken,
  Validator.mcc_category_deactivate,
  MccCategory.deactivate
);
app.post(
  "/mcc_category/activate",
  CheckHeader,
  CheckToken,
  Validator.mcc_category_activate,
  MccCategory.activate
);
app.post(
  "/mcc_category/delete",
  CheckHeader,
  CheckToken,
  Validator.mcc_category_delete,
  MccCategory.delete
);

//Merchant login and ekyc
app.post(
  "/merchant/login",
  rateLimiter,
  CheckHeader,
  MerchantEkycValidator.login,
  MerchantEkyc.login
);
app.post(
  "/merchant/login/verify-2fa",
  CheckHeader,
  MerchantRegisterValidator.verify_2fa,
  MerchantEkyc.verify_2fa
);

app.post(
  "/merchant-ekyc/list-mcc-codes",
  CheckHeader,
  MerchantEkyc.getMccCodes
);
app.post(
  "/merchant-ekyc/psp-by-mcc",
  CheckHeader,
  MerchantEkycValidator.psp_by_mcc,
  MerchantEkyc.getPspByMcc
);

app.post(
  "/merchant-ekyc/business-type",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkycValidator.business_type,
  MerchantEkyc.business_type
); //here

app.post(
  "/merchant/forgot-password",
  CheckHeader,
  MerchantRegisterValidator.reset_merchant_password,
  MerchantRegister.reset_forgot_password
);
app.post(
  "/merchant/forgot-2fa",
  CheckHeader,
  MerchantRegisterValidator.forgot_2fa,
  MerchantRegister.forgot_2fa
);
app.post(
  "/merchant-ekyc/update-business-details",
  CheckHeader,
  CheckMerchantToken,
  multipledocupload,
  MerchantEkycValidator.business_details_document_check,
  MerchantEkyc.business_details
);

app.post(
  "/merchant-ekyc/update-business-representative-details",
  CheckHeader,
  CheckMerchantToken,
  multipledocupload,
  MerchantEkycValidator.business_details_document_check,
  MerchantEkyc.representative_update
);
app.post(
  "/merchant-ekyc/add-business-owner",
  CheckHeader,
  CheckMerchantToken,
  multipledocupload,
  MerchantEkycValidator.business_details_document_check,
  MerchantEkyc.add_business_owner
);
app.post(
  "/merchant-ekyc/add-executives",
  CheckHeader,
  CheckMerchantToken,
  multipledocupload,
  MerchantEkycValidator.business_details_document_check,
  MerchantEkyc.add_executive
);

app.use(function (err, req, res, next) {
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    res.send({
      message: "multiple file for single field not allowed",

      status: "fail",

      code: "E0044",
    });

    return;
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    res.send({
      message: "File size should not be more than 2mb",

      status: "fail",

      code: "E0044",
    });

    return;
  }
});

// app.use(function (err, req, res, next) {
//     if (err.code === "LIMIT_FILE_SIZE") {
//         res.send({
//             message: "File size should not be more than 1 mb",
//             status: "fail",
//             code: "E0044",
//         });
//         return;
//     }
// });
app.post(
  "/merchant-ekyc/copy-owner",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkycValidator.owners_copy,
  MerchantEkyc.business_owner_copy
);

app.post(
  "/merchant-ekyc/update-public-details",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkycValidator.update_public,
  MerchantEkyc.update_public
);
app.post(
  "/merchant-ekyc/add-bank",
  CheckHeader,
  CheckMerchantToken,
  multipledocupload,
  MerchantEkycValidator.add_bank,
  MerchantEkyc.add_bank
);
app.post(
  "/merchant_ekyc/delete-business-owner",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkycValidator.remove_business_owner,
  MerchantEkyc.delete_business_owner
);
app.post(
  "/merchant-ekyc/list-business-owner",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkyc.list_business_owner
);
app.post(
  "/merchant-ekyc/list-business-executives",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkyc.list_business_executives
);
app.post(
  "/merchant_ekyc/delete-business-executive",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkycValidator.remove_business_executive,
  MerchantEkyc.delete_business_executive
);
app.post(
  "/merchant_ekyc/submit-summary",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkyc.submit_summary
);
app.post(
  "/merchant_ekyc/merchant-owner-data",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkyc.merchant_owner_list
);
app.post("/merchant_ekyc/psp-mail", CheckHeader, MerchantEkyc.send_psp_mail);
//app.post("/merchant_ekyc/psp-mail-auto", CheckHeader, MerchantEkyc.send_psp_mail_auto);
app.post(
  "/merchant_ekyc/submit-video-kyc",
  CheckHeader,
  MerchantEkyc.submit_video_kyc
);

app.post(
  "/merchant-ekyc/get-profile",
  CheckHeader,
  CheckMerchantToken,
  MerchantEkyc.get_profile
);
app.post(
  "/merchant-ekyc/get-submerchant-profile",
  CheckHeader,
  CheckMerchantToken,
  Validator.submerchant_profile_details,
  MerchantEkyc.get_sub_merchant_profile
);
app.post(
  "/merchant-ekyc/get-submerchant-profile-kyc",
  CheckHeader,
  Validator.submerchant_profile_details,
  MerchantEkyc.get_sub_merchant_profile
);
/****Merchant Prfoile Fetching from Admin Ekyc*/
app.post(
  "/merchant-ekyc/merchant-profile",
  CheckHeader,
  MerchantEkycValidator.checkMerchant,
  MerchantDetailsById,
  MerchantEkyc.get_profile
);
app.post(
  "/merchant-ekyc/update-merchant-ekyc",
  CheckHeader,
  MerchantEkycValidator.update_merchant_ekyc,
  MerchantDetailsById,
  MerchantEkyc.update_ekyc_status
);

app.post("/merchant-ekyc/check-owner", CheckHeader, MerchantEkyc.owners_data); // for all ekyc data fetched
app.post(
  "/merchant-ekyc/check-merchant",
  CheckHeader,
  MerchantEkyc.merchant_data
); // only for representative
app.post(
  "/merchant-ekyc/update-ekyc-status",
  CheckHeader,
  MerchantEkycValidator.update_owners_status,
  MerchantEkyc.update_owners_status
);
// update executive ekyc status
app.post(
  "/merchant-ekyc/update-ekyc-status-executive",
  CheckHeader,
  MerchantEkycValidator.update_executive_status,
  MerchantEkyc.update_exe_status
);
/**Merchant Profile Fetching from admin ekyc End */
//MCC
app.post("/mcc/add", CheckHeader, CheckToken, Validator.mcc_add, Mcc.add);
app.post("/mcc/list", CheckHeader, CheckToken, Mcc.list);
app.post(
  "/mcc/details",
  CheckHeader,
  CheckToken,
  Validator.mcc_details,
  Mcc.details
);
app.post(
  "/mcc/update",
  CheckHeader,
  CheckToken,
  Validator.mcc_update,
  Mcc.update
);
app.post(
  "/mcc/deactivate",
  CheckHeader,
  CheckToken,
  Validator.mcc_deactivate,
  Mcc.deactivate
);
app.post(
  "/mcc/activate",
  CheckHeader,
  CheckToken,
  Validator.mcc_activate,
  Mcc.activate
);
app.post(
  "/mcc/delete",
  CheckHeader,
  CheckToken,
  Validator.mcc_delete,
  Mcc.delete
);

// CREATE ORDER
app.post("/orders/auth", CheckMerchantCred, MerchantOrder.createOrderAuth); // with NI
// app.post("/orders/void", payment_validation.refund, MerchantOrder.order_cancel); // with NI
// app.post( "/orders/refund",payment_validation.refund, MerchantOrder.order_refund);
app.post(
  "/orders/void",
  CheckHeader,
  checkToken,
  payment_validation.tr_void,
  MerchantOrder.order_void_case
);
app.post(
  "/orders/refund",
  CheckHeader,
  checkToken,
  payment_validation.refund,
  MerchantOrder.order_refund_case
);
// with NI
app.post("/orders/3ds", MerchantOrder.update_3ds); // with NI
app.post("/orders/3ds2", MerchantOrder.update_3ds2);
app.post("/orders/3ds2-NI", MerchantOrder.update_3ds2_ni);
app.post("/orders/capture", payment_validation.refund, MerchantOrder.capture);
app.post(
  "/orders/create",
  Validator.checkRuleHeaders,
  CheckMerchantCred,
  minMaxTxnAmountChecker,
  MerchantOrderValidator.create,
  MerchantOrder.create
);

app.post(
  "/orders/CheckHeader/details",
  CheckHeader,
  MerchantOrderValidator.get,
  MerchantOrder.get
);

app.post(
  "/orders/details",
  //checkOrderToken,
  MerchantOrderValidator.get,
  MerchantOrder.get
);

app.post("/orders/details_status", MerchantOrder.get_details);

app.post(
  "/support/orders/details",
  CheckHeader,
  MerchantOrderValidator.order_details_fetch,
  MerchantOrder.support_orderDetails
);
app.post(
  "/orders/check-order-status",
  /* checkOrderToken,*/ MerchantOrder.status
);

// QR order create
app.post(
  "/orders/qr/create",
  CheckHeader,
  MerchantOrderValidator.create_qr_order,
  minMaxTxnAmountChecker,
  MerchantOrder.create_qr_order
);

// Make a payment for order

app.post(
  "/orders/pay",
  // checkOrderToken,
  MerchantOrderValidator.pay,
  // FraudCheck,
  lookup.routebin,
  MerchantOrder.addOrUpdateCustomer,
  MerchantOrder.saveCard,
  MerchantOrder.pay
);

app.post(
  "/orders/send-notification-for-pay-with-vault",
  MerchantOrderValidator.send_notification_pay_with_vault,
  MerchantOrder.send_notification_for_pay_with_vault
);
app.post(
  "/orders/pay-with-vault",
  checkOrderToken,
  MerchantOrderValidator.pay_with_vault,
  FraudCheck,
  ChargeCalculator,
  MerchantOrder.pay_with_vault
);
app.post(
  "/card/list",
  MerchantOrderValidator.card_list,
  MerchantOrder.cardList
);
app.post(
  "/orders/cancel",
  // checkOrderToken,
  MerchantOrderValidator.cancel,
  MerchantOrder.cancel
);
app.post(
  "/orders/failed",
  // checkOrderToken,
  MerchantOrderValidator.cancel,
  MerchantOrder.failed
);
app.post(
  "/orders/delete-card",
  MerchantOrderValidator.remove,
  MerchantOrder.remove_card
);

//department
app.post(
  "/security-questions/add",
  CheckHeader,
  CheckToken,
  Validator.security_question_add,
  SecurityQuestions.add
);
app.post(
  "/security-questions/list",
  CheckHeader,
  CheckToken,
  SecurityQuestions.list
);
app.post(
  "/security-questions/list-mobile",
  CheckHeader,
  SecurityQuestions.list_all
);
app.post(
  "/security-questions/details",
  CheckHeader,
  CheckToken,
  Validator.security_question_details,
  SecurityQuestions.details
);
app.post(
  "/security-questions/update",
  CheckHeader,
  CheckToken,
  Validator.security_question_update,
  SecurityQuestions.update
);
app.post(
  "/security-questions/deactivate",
  CheckHeader,
  CheckToken,
  Validator.security_question_deactivate,
  SecurityQuestions.deactivate
);
app.post(
  "/security-questions/activate",
  CheckHeader,
  CheckToken,
  Validator.security_question_activate,
  SecurityQuestions.activate
);
app.post(
  "/security-questions/delete",
  CheckHeader,
  CheckToken,
  Validator.security_question_delete,
  SecurityQuestions.delete
);

app.post(
  "/encrypt-mobile-and-code",
  CheckHeader,
  Validator.check_mobile_and_code,
  Auth.encrypt_mobile_no_and_code
);
app.post("/sms", Auth.receive_sms);
app.post("/sms/fail", Auth.receive_sms_fail);
app.post(
  "/customers/register",
  CheckHeader,
  Validator.checkCustomerRegistration,
  Auth.registerCustomer
);
app.post(
  "/customers/pin",
  CheckHeader,
  Validator.checkCustomerPin,
  Auth.customerPin
);
/* Moving customer_temp to customers */
app.post(
  "/customers/store-answer",
  CheckHeader,
  Validator.security_question_answer,
  SecurityQuestions.store_answer
);
app.get("/test-pushnotication", Validator.test_pushnotification);
app.post(
  "/mobile/login",
  CheckHeader,
  CustomerValidator.login,
  Auth.customer_login
);
app.post(
  "/mobile/logout",
  CheckHeader,
  CheckCustomerToken,
  Auth.customer_logout
);
app.post(
  "/mobile/otp",
  CheckHeader,
  CustomerValidator.otp_Sent,
  Customers.otp_Sent
);
app.post(
  "/mobile/otp-verify",
  CheckHeader,
  CustomerValidator.otp_verify,
  Customers.otp_verity
);
app.post(
  "/mobile/otp-reset",
  CheckHeader,
  CustomerValidator.reset_otp_Sent,
  Customers.otp_Sent_email
);
app.post(
  "/mobile/reset-otp-verify",
  CheckHeader,
  CustomerValidator.reset_otp_verify,
  Customers.reset_otp_verity
);
app.post("/customer/list", CheckHeader, CheckToken, Customers.list);
app.post(
  "/customer/details",
  CheckHeader,
  CheckToken,
  Customers.customer_details
);
app.post(
  "/mobile/user-questions",
  CheckHeader,
  CustomerValidator.questions_list,
  Customers.customer_ques_list
);
app.post(
  "/mobile/verify-user-questions",
  CheckHeader,
  CustomerValidator.verify_cid,
  Customers.verify_question_answer
);
app.post(
  "/mobile/reset-user-pin",
  CheckHeader,
  CustomerValidator.reset_pin,
  Customers.reset_pin
);
app.post("/mobile/profile", CheckHeader, CheckCustomerToken, Customers.details);
app.post(
  "/mobile/profile-update",
  CheckHeader,
  CheckCustomerToken,
  uploadCustomerProfilePic,
  CustomerValidator.update_profile,
  Customers.update_profile
);
app.post(
  "/mobile/delete-account",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.delete,
  Customers.delete
);
app.use(function (err, req, res, next) {
  if (err.code === "LIMIT_FILE_SIZE") {
    res.send({
      message: "File size should not be more than 2mb",
      status: "fail",
      code: "E0044",
    });
    return;
  }
});
app.post(
  "/mobile/transaction-list",
  CheckHeader,
  CheckCustomerToken,
  Customers.transaction_list
);
app.post(
  "/mobile/change-pin",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.change_pin,
  Customers.change_pin
);
app.post(
  "/mobile/change-email-otp",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.otp_sent_email,
  Customers.otp_Sent_email
);
app.post(
  "/mobile/change-email",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.reset_otp_verify,
  Customers.change_email
);
app.post(
  "/mobile/add-card",
  CheckHeader,
  CheckCustomerToken,
  lookup.mobile_lookup_bin,
  CustomerValidator.card_add,
  Customers.card_add
);
app.post(
  "/mobile/card-list",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.card_list,
  Customers.cardList
);
app.post(
  "/mobile/card-delete",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.card_delete,
  Customers.card_delete
);
app.post(
  "/mobile/card-primary_card",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.card_primary,
  Customers.card_primary
);
app.post(
  "/mobile/card-hide",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.card_hide,
  Customers.card_hide
);
app.post(
  "/mobile/card-delete-hide",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.delete_hide_card,
  Customers.delete_hide_card
);
app.post(
  "/mobile/verify-mobile",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.check_mobile_and_code,
  Customers.encrypt_mobile_no_and_code
);
app.post("/mobile/sms", Customers.receive_sms);
app.post("/mobile/sms/fail", Customers.receive_sms_fail);
app.post(
  "/mobile/cancel-order",
  CheckHeader,
  checkOrderToken,
  CheckToken,
  MerchantOrderValidator.cancel,
  MerchantOrder.mobile_cancel
);
app.post(
  "/mobile/failed-order",
  CheckHeader,
  checkOrderToken,
  CheckToken,
  MerchantOrderValidator.cancel,
  MerchantOrder.mobile_failed
);
app.post(
  "/mobile/order-details",
  CheckHeader,
  CheckToken,
  MerchantOrderValidator.order_details_fetch,
  MerchantOrder.order_details_for_mobile
);
app.post(
  "/mobile/dashboard",
  CheckHeader,
  CheckCustomerToken,
  Customers.dashboard
);
app.post(
  "/mobile/ios/otp",
  CheckHeader,
  CustomerValidator.send_otp_mobile,
  Customers.send_otp_mobile
);
app.post(
  "/mobile/ios/otp-verify",
  CheckHeader,
  CustomerValidator.mobile_otp_verify,
  Customers.mobile_otp_verify
);
app.post(
  "/mobile/ios/forgot-otp",
  CheckHeader,
  CustomerValidator.forgot_otp_mobile,
  Customers.send_otp_mobile
);
app.post(
  "/mobile/ios/forgot-otp-verify",
  CheckHeader,
  CustomerValidator.forgot_mobile_otp_verify,
  Customers.forgot_otp_verify
);
app.post(
  "/mobile/ios/change-mobile-otp",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.change_mobile_otp,
  Customers.send_otp_mobile
);
app.post(
  "/mobile/ios/change-mobile",
  CheckHeader,
  CheckCustomerToken,
  CustomerValidator.forgot_mobile_otp_verify,
  Customers.change_mobile
);

//Merchant Maintenance
app.post(
  "/charges/merchant_maintenance/add",
  CheckHeader,
  CheckToken,
  merchant_charges.plan_add,
  merchantMaintenance.add
);
app.post(
  "/charges/merchant_maintenance/list",
  CheckHeader,
  CheckToken,
  merchantMaintenance.list
);
app.post(
  "/charges/merchant_maintenance/update",
  CheckHeader,
  CheckToken,
  merchant_charges.plan_update,
  merchantMaintenance.update
);
app.post(
  "/charges/merchant_maintenance/activate",
  CheckHeader,
  CheckToken,
  merchant_charges.plan_activate,
  merchantMaintenance.activate
);
app.post(
  "/charges/merchant_maintenance/deactivate",
  CheckHeader,
  CheckToken,
  merchant_charges.plan_deactivate,
  merchantMaintenance.deactivate
);
app.post(
  "/charges/merchant_maintenance/details",
  CheckHeader,
  CheckToken,
  merchant_charges.plan_details,
  merchantMaintenance.details
);
app.post(
  "/charges/features/list",
  CheckHeader,
  CheckToken,
  merchantMaintenance.features_list
);
//Transaction Setup
app.post(
  "/charges/transaction_setup/add",
  CheckHeader,
  CheckToken,
  Transaction_validation.add,
  Transaction_setup.transaction_add
);
app.post(
  "/charges/transaction_setup/list",
  CheckHeader,
  CheckToken,
  Transaction_setup.transaction_list
);
app.post(
  "/charges/transaction_setup/update",
  CheckHeader,
  CheckToken,
  Transaction_validation.update,
  Transaction_setup.transaction_update
);
app.post(
  "/charges/transaction_setup/activate",
  CheckHeader,
  CheckToken,
  Transaction_validation.activate,
  Transaction_setup.transaction_activate
);
app.post(
  "/charges/transaction_setup/deactivate",
  CheckHeader,
  CheckToken,
  Transaction_validation.deactivate,
  Transaction_setup.transaction_deactivate
);
app.post(
  "/charges/transaction_setup/slab_add",
  CheckHeader,
  CheckToken,
  Transaction_setup.slab_add
);
app.post(
  "/charges/transaction_setup/details",
  CheckHeader,
  CheckToken,
  Transaction_validation.details,
  Transaction_setup.transaction_details
);

app.post(
  "/charges/transaction_setup/slab_update",
  CheckHeader,
  CheckToken,
  Transaction_setup.slab_update
);
app.post(
  "/charges/transaction_setup/slab_list",
  CheckHeader,
  CheckToken,
  Transaction_setup.slab_list
);
app.post(
  "/charges/transaction_setup/slab_deactivate",
  CheckHeader,
  CheckToken,
  Transaction_validation.slab_deactivate,
  Transaction_setup.slab_deactivate
);

//qr code start

app.post(
  "/qr/add",
  CheckHeader,
  CheckToken,
  QR_validation.add,
  QR_generate.add
);
app.post("/qr/list", CheckHeader, CheckToken, QR_generate.list);
app.post("/qr_logs/list", CheckHeader, CheckToken, QR_generate.logs_list);
app.post(
  "/qr/list-deactivated",
  CheckHeader,
  CheckToken,
  QR_generate.listDeactivated
);
app.post(
  "/qr/reset",
  CheckHeader,
  CheckToken,
  QR_validation.reset,
  QR_generate.reset
);
app.post(
  "/qr/deactivate",
  CheckHeader,
  CheckToken,
  QR_validation.deactivate,
  QR_generate.deactivate
);
app.post(
  "/qr/activate",
  CheckHeader,
  CheckToken,
  QR_validation.activate,
  QR_generate.activate
);

app.post("/qr/details", CheckHeader, CheckToken, QR_generate.details);

app.post(
  "/qr/reset",
  CheckHeader,
  CheckToken,
  QR_validation.reset,
  QR_generate.reset
);
app.post(
  "/charges/payment_mode/list",
  CheckHeader,
  CheckToken,
  Transaction_setup.payment_mode_list
);
app.post(
  "/charges/payment_mode/card-scheme",
  CheckHeader,
  CheckToken,
  Transaction_setup.card_scheme
);
app.post(
  "/qr/update",
  CheckHeader,
  CheckToken,
  QR_validation.update,
  QR_generate.update
);
app.post("/qr/payment", QR_validation.add_payment, QR_payment.add);
app.post(
  "/qr/payment_collection",
  QR_validation.collection_payment,
  QR_payment.collection
);
app.post("/qr/payment_list", CheckHeader, CheckToken, QR_payment.payment_list);
app.post(
  "/qr/view_transaction",
  CheckHeader,
  CheckToken,
  QR_generate.view_transaction
);
app.post(
  "/qr/link_details",
  CheckHeader,
  QR_validation.link_details,
  QR_generate.link_details
);

app.post(
  "/qr/payment_link_details",
  CheckHeader,
  QR_validation.link_details,
  QR_generate.payment_link_details
);
app.post(
  "/qr/send_mail",
  CheckToken,
  CheckHeader,
  QR_validation.pay_mail,
  QR_generate.payment_mail_send
);
//Invoice start

app.post(
  "/inv/add_customer",
  CheckHeader,
  CheckToken,
  invlogoUpload,
  invoiceValidation.add,
  invoice.add_customer
);
app.post("/inv/list_customer", CheckHeader, CheckToken, invoice.list_customer);
app.post(
  "/inv/details_customer",
  CheckHeader,
  CheckToken,
  invoiceValidation.details,
  invoice.details_customer
);
app.post(
  "/inv/update_customer",
  CheckHeader,
  CheckToken,
  invlogoUpload,
  invoiceValidation.update,
  invoice.update_customer
);
app.post(
  "/inv/deactivate_customer",
  CheckHeader,
  CheckToken,
  invoiceValidation.deactivate,
  invoice.customer_deactivate
);
app.post(
  "/inv/activate_customer",
  CheckHeader,
  CheckToken,
  invoiceValidation.activate,
  invoice.customer_activate
);
app.post(
  "/inv/delete-customer",
  CheckHeader,
  CheckToken,
  invoiceValidation.details,
  invoice.customer_delete
);

app.post(
  "/inv/invoice_add",
  CheckHeader,
  CheckToken,
  invoiceValidation.inv_add,
  invoice.invoice_add
);
app.post("/inv/invoice_list", CheckHeader, CheckToken, invoice.invoice_list);
app.post(
  "/inv/invoice_details",
  CheckHeader,
  invoiceValidation.inv_details,
  invoice.invoice_details
);

app.post(
  "/inv/invoice_delete",
  CheckHeader,
  invoiceValidation.inv_details,
  invoice.invoice_delete
);

app.post(
  "/inv/finalize-invoice-and-send",
  CheckHeader,
  CheckToken,
  invoiceValidation.inv_send,
  invoice.finalize_and_send
);

app.post("/inv/qr_code", CheckHeader, CheckToken, invoice.invoice_qr);

app.post(
  "/inv/cancel-invoice",
  CheckHeader,
  CheckToken,
  invoiceValidation.inv_details,
  invoice.cancel_invoice
);
app.post(
  "/inv/invoice_update",
  CheckHeader,
  CheckToken,
  invoiceValidation.inv_update,
  invoice.invoice_update
);
app.post(
  "/inv/download-invoice",
  CheckHeader,
  invoiceValidation.inv_details,
  invoice.invoice_details
);
app.post("/inv/check-status", CheckHeader, invoiceValidation.invoiceStatus);
app.post(
  "/inv/invoice/import",
  CheckHeader,
  CheckToken,
  ExcelImportUpload,
  invoice.import
);

app.post(
  "/inv/item_add",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_add,
  invoice.item_add
);
app.post("/inv/item_list", CheckHeader, CheckToken, invoice.item_list);
app.post(
  "/inv/item_details",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_details,
  invoice.item_details
);
app.post("/inv/item_update", CheckHeader, CheckToken, invoice.item_update);
app.post(
  "/inv/item_delete",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_delete,
  invoice.item_delete
);

app.post(
  "/inv/items/add",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_master_add,
  invoice.item_master_add
);
app.post("/inv/items/list", CheckHeader, CheckToken, invoice.item_master_list);
app.post(
  "/inv/items/details",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_master_details,
  invoice.item_master_details
);
app.post(
  "/inv/items/update",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_master_update,
  invoice.item_master_update
);
app.post(
  "/inv/items/activate",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_master_activate,
  invoice.item_master_activate
);
app.post(
  "/inv/items/deactivate",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_master_deactivated,
  invoice.item_master_deactivated
);
app.post(
  "/inv/items/delete",
  CheckHeader,
  CheckToken,
  invoiceValidation.item_master_delete,
  invoice.item_master_delete
);
// Invoice order create
app.post(
  "/orders/invoice/create",
  // minMaxTxnAmountChecker,
  MerchantOrderValidator.create_invoice_order,
  MerchantOrder.create_invoice_order
);
// Referral Module Starts Here
app.post(
  "/referrer/add",
  CheckHeader,
  ReferrerUpload,
  ReferrerValidator.add,
  Referrer.add
);
app.post(
  "/referrer/update",
  CheckHeader,
  CheckToken,
  ReferrerUpload,
  ReferrerValidator.update,
  Referrer.update
);
app.post(
  "/referrer/generate-2fa",
  CheckHeader,
  ReferrerValidator.twoFa,
  Referrer.generate2Fa
);
app.post(
  "/referrer/verify-2fa",
  CheckHeader,
  ReferrerValidator.verify_2fa,
  Referrer.verify_2fa
);
app.post(
  "/referrer/login",
  CheckHeader,
  ReferrerValidator.login,
  Referrer.login
);
app.post(
  "/referrer/forgot-password",
  CheckHeader,
  ReferrerValidator.reset_referrer_password,
  Referrer.reset_forgot_password
);
app.post(
  "/referrer/forgot-2fa",
  CheckHeader,
  ReferrerValidator.forgot_2fa,
  Referrer.forgot_2fa
);
app.post(
  "/referrer/resend-2fa",
  CheckHeader,
  ReferrerValidator.forgot_2fa,
  Referrer.resend_2fa
);
app.post(
  "/referrer/check-verification-link",
  CheckHeader,
  ReferrerValidator.verify_link
);
app.post(
  "/referrer/reset-password",
  CheckHeader,
  ReferrerValidator.reset_password,
  Referrer.reset_password
);
app.post(
  "/referrer/login/verify-2fa",
  CheckHeader,
  ReferrerValidator.verify_2fa,
  Referrer.verify_and_login
);
app.post("/referrer/list", CheckHeader, CheckToken, Referrer.list);
app.post(
  "/merchant-referrer/plan-list",
  CheckHeader,
  CheckToken,
  Referrer.referrer_plan_list
);
app.post(
  "/referrer/details",
  CheckHeader,
  CheckToken,
  ReferrerValidator.get,
  Referrer.get
);
app.post(
  "/referrer/delete",
  CheckHeader,
  CheckToken,
  ReferrerValidator.delete,
  Referrer.delete
);
app.use(function (err, req, res, next) {
  if (err.code === "LIMIT_FILE_SIZE") {
    res.send({
      message: "File size should not be more than 1mb",
      status: "fail",
      code: "E0044",
    });
    return;
  }
});
app.post(
  "/referrer/activate",
  CheckHeader,
  CheckToken,
  ReferrerValidator.activate,
  Referrer.activate
);
app.post(
  "/referrer/deactivate",
  CheckHeader,
  CheckToken,
  ReferrerValidator.deactivate,
  Referrer.deactivate
);
app.post(
  "/referrer/approve",
  CheckHeader,
  CheckToken,
  ReferrerValidator.approve,
  Referrer.approve
);
app.post(
  "/referrer/merchant-onboarded",
  CheckHeader,
  CheckToken,
  ReferrerValidator.onboard,
  Referrer.onboard
);
app.post("/referrer/profile", CheckHeader, CheckToken, Referrer.profile);
app.post(
  "/referrer/read-notification",
  CheckHeader,
  CheckToken,
  Referrer.notificationUpdate
);

app.post("/referrer/my-rewards", CheckHeader, CheckToken, Referrer.my_rewards);
app.post("/referrer/bonus-calculation", bonus_calculation.calculate);
// referral bonus routes
app.post(
  "/referral_bonus/add",
  CheckHeader,
  ReferralBonusValidator.add,
  referral_bonus.add
);
app.post("/referral_bonus/list", CheckHeader, referral_bonus.list);
app.post("/referral_bonus/fetch_list", CheckHeader, referral_bonus.list_fetch);
app.post(
  "/referral_bonus/details",
  CheckHeader,
  ReferralBonusValidator.get,
  referral_bonus.get
);
app.post(
  "/referral_bonus/update",
  CheckHeader,
  ReferralBonusValidator.update,
  referral_bonus.update
);
app.post(
  "/referral_bonus/delete",
  CheckHeader,
  ReferralBonusValidator.delete,
  referral_bonus.delete
);
// referral invoice mail
app.post(
  "/referral_invoice/send_mail",
  CheckToken,
  CheckHeader,
  ReferralBonusInvoiceValidator.invoice_mail,
  referral_bonus.invoice_mail
);
app.post(
  "/subs_plan/add",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.add,
  subs_plan.add
);

app.post(
  "/subs_plan/create",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.create,
  subs_plan.create
);

app.post("/subs_plan/list", CheckHeader, CheckToken, subs_plan.list);
app.post("/subs_plan/logs", CheckHeader, CheckToken, subs_plan.logs);
app.post(
  "/subscriber/details",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.get_subscriber,
  subs_plan.get_subscriber
);
app.post(
  "/subscriber/declined_cards",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.get_subscriber,
  subs_plan.get_subscriber_declined_cards
);
app.post(
  "/subs_plan/subscriber_list",
  CheckHeader,
  CheckToken,
  subs_plan.subscriber_list
);
app.post(
  "/subscriber/view_details",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.get_subscriber,
  subs_plan.view_subscriber
);
app.post(
  "/subs_plan/contract_list",
  CheckHeader,
  CheckToken,
  subs_plan.contract_list
);
app.post(
  "/subs_plan/details",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.get,
  subs_plan.get
);
app.post(
  "/subs_plan/plan-terms",
  CheckHeader,
  CheckToken,
  subs_plan.plan_terms_list
);
app.post(
  "/subs_plan/subscription-recurring",
  CheckHeader,
  CheckToken,
  subs_plan.subscription_recurring_list
);
app.post(
  "/subs_plan/view",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.get,
  subs_plan.details
);
app.post(
  "/subs_plan/update",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.update,
  subs_plan.update
);
app.post(
  "/subs_plan/deactivate",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.deactivate,
  subs_plan.deactivate
);
app.post(
  "/subs_plan/activate",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.activate,
  subs_plan.activate
);
app.post(
  "/subs_plan/delete",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.delete,
  subs_plan.delete
);
app.post(
  "/subs_plan/send_mail",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.mail_send,
  subs_plan.mail_send
);
app.post(
  "/subs_plan/subscription_setup",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.setup_create,
  subs_plan.setup_create
);
app.post(
  "/subs_plan/update_subscription_setup",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.setup_update,
  subs_plan.setup_update
);
app.post(
  "/subs_plan/subs_setup_list",
  CheckHeader,
  CheckToken,
  subs_plan.subs_setup_list
);
app.post(
  "/subs_plan/subs_setup_details",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.get_setup_details,
  subs_plan.get_setup_details
);
app.post(
  "/subs_plans/expired_cards",
  CheckHeader,
  CheckToken,
  subs_plan.expired_list
);
app.post(
  "/subs_plans/declined_cards",
  CheckHeader,
  CheckToken,
  subs_plan.declined_cards
);
app.post(
  "/subs_plans/link_details",
  CheckHeader,
  SubscriptionPlanValidator.link_details,
  subs_plan.link_details
);
app.post(
  "/subs_plans/add-subscription",
  SubscriptionPlanValidator.subscription_details,
  MerchantOrder.add_subscription
);
app.post(
  "/subs_plan/cancel-subscription",
  CheckHeader,
  CheckToken,
  SubscriptionPlanValidator.cancel,
  subs_plan.cancel
);

app.post("/subs_plans/start-expired", SubscriptionPlanValidator.start_expired);

app.post(
  "/subs_plans/order-create",
  SubscriptionPlanValidator.create_subscription_order,
  MerchantOrder.create_subs_order
);
// Nationality Model start
app.post(
  "/nationality/add",
  CheckHeader,
  CheckToken,
  Validator.nationality_add,
  Nationality.add
);
app.post("/nationality/list", CheckHeader, CheckToken, Nationality.list);
app.post(
  "/nationality/details",
  CheckHeader,
  CheckToken,
  Validator.nationality_details,
  Nationality.details
);
app.post(
  "/nationality/update",
  CheckHeader,
  CheckToken,
  Validator.nationality_update,
  Nationality.update
);
app.post(
  "/nationality/deactivate",
  CheckHeader,
  CheckToken,
  Validator.nationality_deactivate,
  Nationality.deactivate
);
app.post(
  "/nationality/activate",
  CheckHeader,
  CheckToken,
  Validator.nationality_activate,
  Nationality.activate
);
app.post(
  "/nationality/delete",
  CheckHeader,
  CheckToken,
  Validator.nationality_delete,
  Nationality.delete
);
// Nationality Model End

// referral bonus routes
app.post("/referral/bonus/list", CheckHeader, referralBonusController.list);
app.post(
  "/referral/bonus/pending",
  CheckHeader,
  referralBonusController.pending
);
app.post(
  "/referral/bonus/settled",
  CheckHeader,
  Referral_Bonus_Validator.update,
  referralBonusController.settled
);

// referral invoice routes
//create invoice
app.post(
  "/referral/bonus/invoice",
  //CheckHeader,
  //ReferralBonusInvoiceValidator.add,
  referral_bonus_invoice.generateRequest
);

console.log(schedule.scheduledJobs);

// schedule.scheduleJob("0 * * * *", referral_bonus_invoice.generateCron);
// schedule.scheduleJob("* * * * *", RecurringController);
// schedule.scheduleJob("* * 23 * * *", RecurringController.live);
// schedule.scheduleJob("* * 23 * * *", RecurringController.test);
// app.get("/cron-rec-live", RecurringController.live);
// app.get("/cron-rec-test", RecurringController.test);

app.post(
  "/referral/bonus/invoice-list",
  CheckHeader,
  referral_bonus_invoice.invoice_list
);
app.post(
  "/merchant/bonus/invoice-list",
  CheckHeader,
  checkToken,
  referral_bonus_invoice.merchant_invoice_list
);
app.post("/referral/bonus/view", CheckHeader, referral_bonus_invoice.view);

app.post(
  "/referral/bonus/invoice/status",
  CheckHeader,
  referral_bonus_invoice.update
);

app.post(
  "/referral/bonus/invoice/update",
  CheckHeader,
  referral_bonus_invoice.update_invoice
);

app.post(
  "/referral/bonus/invoice/edit",
  CheckHeader,
  referral_bonus_invoice.referrer_bonus_invoice
);

// order charges invoice routes
app.post(
  "/charges/invoice/create",
  CheckHeader,
  charges_invoice_validator.add,
  charges_invoice_controller.generate
);

app.post(
  "/charges/invoice/list",
  CheckHeader,
  charges_invoice_controller.invoice_list
);
app.post("/charges/invoice/view", CheckHeader, charges_invoice_controller.view);
app.post(
  "/charges/invoice/super-merchant",
  CheckHeader,
  CheckToken,
  charges_invoice_controller.invoice_list_supermerchant
);

app.post(
  "/charges/invoice/update/status",
  CheckHeader,
  CheckToken,
  charges_invoice_validator.update,
  charges_invoice_controller.update
);
app.post(
  "/charges/transaction_list",
  CheckHeader,
  CheckToken,
  charges_invoice_controller.transactions_list
);
app.post(
  "/export-charges/transaction_list",
  CheckHeader,
  CheckToken,
  charges_invoice_controller.export_transactions_list
);
app.post(
  "/charges/feature_list",
  CheckHeader,
  CheckToken,
  charges_invoice_controller.feature_list
);
// proxy APIs for support tickets
app.post(
  "/support/ticket/create",
  CheckHeader,
  supportTicketUpload,
  support_ticket_validator.add,
  support_ticket_controller.add
);

app.post(
  "/support/ticket/list",
  CheckHeader,
  support_ticket_validator.list,
  support_ticket_controller.list
);

app.post(
  "/support/ticket/details",
  CheckHeader,
  support_ticket_validator.details,
  support_ticket_controller.details
);

app.post(
  "/category/list_category",
  CheckHeader,
  support_ticket_controller.list_category
);

app.post(
  "/category/list_subcategory",
  CheckHeader,
  support_ticket_validator.list_subcategory,
  support_ticket_controller.list_subcategory
);

// comment apis
app.post(
  "/ticket_list/add_comment",
  CheckHeader,
  supportTicketUpload,
  support_ticket_validator.comment,
  support_ticket_controller.add_comment
);

// import excel
// invoice routes
app.post("/import", ExcelImportUpload, responseImport.import);

/* ---paytabs--- */
app.post(
  "/paytabs/pay",
  function (req, res, next) {
    console.log(`Calling Paytabs Pay`);
    next();
  },
  PayTabsValidator.checkout,
  FraudCheck,
  lookup.routebin,
  MerchantOrder.addOrUpdateCustomer,
  MerchantOrder.bin_saveCard,
  MerchantOrder.saveCard,
  PayTabsController.checkout
);
app.post("/paytabs/3ds", PayTabsController.pay3ds);

app.post(
  "/referral_list/list",
  CheckHeader,
  referral_bonus_invoice.referral_bonus_list
);

app.post(
  "/referral_list/details",
  CheckHeader,
  referral_bonus_invoice.referral_bonus_details
);
app.post(
  "/referral_summary_list/details",
  CheckHeader,
  referral_bonus_invoice.merchant_referral_bonus_details
);
app.post(
  "/merchant-referral-list/details",
  CheckHeader,
  checkToken,
  referral_bonus_invoice.merchant_referrer_list
);
// app.post(
//     "/referral_list/marchent/list",
//     CheckHeader,
//     CheckToken,
//     referral_bonus_invoice.referral_bonus_list_marchent
// );

//logs
app.post("/mobile_logs/list", CheckHeader, CheckToken, mobile_logs.list);

app.post(
  "/transactions/high-risk",
  CheckHeader,
  CheckToken,
  Order.highrisk_list
);

app.post("/orders/details/update", CheckHeader, Order.header_update);
// Merchant Users

app.post(
  "/merchant-users/add",
  CheckHeader,
  CheckMerchantToken,
  MUsersValidator.add,
  Merchant_user.add
);
app.post(
  "/merchant/add-user",
  CheckHeader,
  CheckMerchantToken,
  (req,res,next)=>{
    let stores = req.body.stores;
    let enc_id = encrypt_decrypt('encrypt',stores);
    req.body.stores = enc_id;
    next();
  },
  MUsersValidator.add,
  Merchant_user.add
);
app.post(
  "/merchant-users/list",
  CheckHeader,
  CheckMerchantToken,
  Merchant_user.list
);
app.post(
  "/merchant-users/details",
  CheckHeader,
  CheckMerchantToken,
  MUsersValidator.get,
  Merchant_user.get
);
app.post(
  "/merchant-users/delete",
  CheckHeader,
  CheckMerchantToken,
  MUsersValidator.delete,
  Merchant_user.delete
);
app.post(
  "/merchant-users/update",
  CheckHeader,
  CheckMerchantToken,
  MUsersValidator.update,
  Merchant_user.update
);
app.post(
  "/merchant-users/activate",
  CheckHeader,
  CheckMerchantToken,
  MUsersValidator.activate,
  Merchant_user.activate
);
app.post(
  "/merchant-users/deactivate",
  CheckHeader,
  CheckMerchantToken,
  MUsersValidator.deactivate,
  Merchant_user.deactivate
);
app.post(
  "/document-type/add",
  CheckHeader,
  checkToken,
  Validator.document_add,
  Document_type.add
);
app.post("/document-type/list", CheckHeader, Document_type.list);
app.post(
  "/document-type/entity-list",
  CheckHeader,
  Document_type.list_of_entity_document
);
app.post(
  "/document-type/details",
  CheckHeader,
  checkToken,
  Validator.document_get,
  Document_type.get
);
app.post(
  "/document-type/update",
  CheckHeader,
  checkToken,
  Validator.document_update,
  Document_type.update
);
app.post(
  "/document-type/activate",
  CheckHeader,
  checkToken,
  Validator.document_activate,
  Document_type.activate
);
app.post(
  "/document-type/deactivate",
  CheckHeader,
  checkToken,
  Validator.document_deactivate,
  Document_type.deactivate
);
app.post("/ip-lookup", ip_lookup);
app.post(
  "/transactions/summary",
  CheckHeader,
  checkToken,
  MerchantOrder.summary
);
app.post(
  "/card-token-summary",
  CheckHeader,
  checkToken,
  MerchantOrder.tokenSummary
);
app.post(
  "/cards/by-token",
  CheckHeader,
  checkToken,
  MerchantOrder.cardsByToken
);
app.post(
  "/transactions/summary/list",
  CheckHeader,
  checkToken,
  MerchantOrderValidator.get_card_transactions,
  MerchantOrder.all_transactions
);

app.post("/merchant/pricing_plan/update", CheckHeader, merchant.pricing_plan);
app.post(
  "/merchant/pricing_plan/details",
  CheckHeader,
  merchant.pricing_plan_details
);

// telr integration
app.post(
  "/telr/orders/pay",
  CheckHeader,
  // checkOrderToken,
  MerchantOrderValidator.telr_pay,
  //FraudCheck,
  lookup.routebin,
  MerchantOrder.addOrUpdateCustomer,
  MerchantOrder.bin_saveCard,
  MerchantOrder.saveCard,
  MerchantOrder.telr_pay
);

app.post(
  "/telr/setup",
  CheckHeader,
  MerchantOrderValidator.telr_pay,
  lookup.routebin,
  MerchantOrder.addOrUpdateCustomer,
  MerchantOrder.bin_saveCard,
  MerchantOrder.saveCard,
  telrNew.setup
);
app.post("/telr/authentication", CheckHeader, telrNew.authentication);
app.post("/telr/authorization", CheckHeader, telrNew.authorization);

app.post(
  "/telr/orders/void",
  CheckHeader,
  checkToken,
  MerchantOrder.order_telr_cancel
);
app.post(
  "/telr/orders/refund",
  CheckHeader,
  checkToken,
  MerchantOrder.open_telr_refund
);
// app.post("/telr/orders/3ds", MerchantOrder.telr_update_3ds);
app.post("/telr/orders/3ds-updated", MerchantOrder.telr_update_3ds_updated);

app.post("/run/cron", cron.addSecretTest);

schedule.scheduleJob("0 0 0 * * *", function () {
  cron.addSecret();
});

app.post("/run/cron/card-about-to-expire", cron.checkCardAboutToExpireRequest);
app.post("/run/cron/card-expired", cron.checkCardExpiredRequest);

// schedule.scheduleJob("0 0 0 * * *", function () {
//   cron.checkCardAboutToExpireCron();
// });
// schedule.scheduleJob("0 0 0 * * *", function () {
//   cron.checkCardExpiredCron();
// });

//create plan order api
app.post(
  "/orders/plan/create",
  SubscriptionPlanValidator.create_plan_order,
  subs_plan.create_plan_order
);

// all open apis
app.post(
  "/open/orders/create",
  // Validator.checkRuleHeaders,
  // CheckMerchantCred,
  checkOpenMerchantCred,
  MerchantOrderValidator.create,
  minMaxTxnAmountChecker,
  MerchantOrder.addOrUpdateCustomerOpenCreate,

  MerchantOrder.open_create
);
app.post(
  "/open/transactions/list",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  ReferralBonusInvoiceValidator.open_trans_list,
  Order.open_list
);
app.post(
  "/open/orders/capture",
  Validator.checkRuleHeaders,
  // CheckMerchantCred,
  checkOpenMerchantCred,
  payment_validation.refund,
  MerchantOrder.capture
);
app.post(
  "/open/transaction/refund",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  payment_validation.refund,
  MerchantOrder.open_telr_refund
);
app.post(
  "/open/transaction/void",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  payment_validation.refund,
  MerchantOrder.order_telr_cancel
);
app.post(
  "/open/orders/details",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  MerchantOrderValidator.open_get,
  MerchantOrder.open_get
);
app.post(
  "/open/qr/add",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  QR_validation.open_add,
  QR_generate.open_api_add
);
app.post(
  "/open/qr/list",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  QR_validation.open_list,
  QR_generate.open_list
);
app.post(
  "/open/subs_plan/add",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.add,
  subs_plan.open_add
);

// logger apis
app.post("/transaction/logs", CheckHeader, logsController.list);

app.post("/response_code", CheckHeader, responseCode.list);
app.post(
  "/response_code/response_types",
  CheckHeader,
  responseCode.response_types
);
app.post(
  "/response_code/detail",
  CheckHeader,
  Validator.response_cod,
  responseCode.response_code_detail
);
app.post(
  "/response_code/store",
  CheckHeader,
  Validator.response_cod,
  responseCode.response_code_store
);
app.post("/response_code/categories", CheckHeader, responseCode.categories);

app.post("/rule-document/add", CheckHeader, checkToken, rules_document.add);
app.post("/rule-document/list", CheckHeader, checkToken, rules_document.list);

app.post("/encrypt/code", subs_plan.code);
app.post("/dencrypt/code", subs_plan.codee);

// webhook
app.get("/webhook/notification-secret", webHook.get);
app.post(
  "/webhook/add-update-url",
  CheckHeader,
  checkToken,
  webHookValidator.add_update,
  webHook.add_update
);

app.post("/webhook/details", CheckHeader, checkToken, webHook.details);

/* ADD  UPDATE VIA  MERCHANT ID */
app.post(
  "/webhook/merchant/add-update-url",
  CheckHeader,
  checkToken,
  webHookValidator.add_update,
  webHook.add_update_with_merchant
);
app.post("/webhook/merchant/details", CheckHeader, checkToken, webHook.details);
/*----------------------------- */

app.post("/response", subs_plan.checkResponse);

app.post(
  "/create_mid",
  CheckHeader,
  checkToken,
  Validator.create_mid,
  submerchant.create_mid
);
app.post(
  "/update_mid",
  CheckHeader,
  checkToken,
  Validator.update_mid,
  submerchant.update_mid
);
app.post(
  "/active_mid",
  CheckHeader,
  checkToken,
  Validator.active_mid,
  submerchant.activated_mid_new
);
app.post(
  "/deactive_mid",
  CheckHeader,
  checkToken,
  Validator.deactive_mid,
  submerchant.deactivated_mid_new
);
app.post(
  "/delete_mid",
  CheckHeader,
  checkToken,
  Validator.delete_mid,
  submerchant.delete_mid_new
);
app.post(
  "/list_mid",
  CheckHeader,
  checkToken,
  Validator.list_mid,
  submerchant.list_mid_new
);
app.post(
  "/get_list_mid",
  CheckHeader,
  checkToken,
  Validator.list_mid,
  submerchant.get_list_mid
);

app.post("/list_mid_psp", CheckHeader, checkToken, submerchant.list_mid_psp);

app.post(
  "/list_details",
  CheckHeader,
  checkToken,
  Validator.list_details,
  submerchant.list_details
);

// buy rates
app.post(
  "/psp/add_buyrate",
  CheckHeader,
  CheckToken,
  PspValidator.create,
  Psp.create_psp_buyrate
);
app.post(
  "/psp/master_buyrate/list",
  CheckHeader,
  CheckToken,
  Psp.master_buyrate_list
);
app.post(
  "/psp/master_buyrate/delete",
  CheckHeader,
  CheckToken,
  Psp.master_buyrate_delete
);
app.post(
  "/psp/master_buyrate/details",
  CheckHeader,
  CheckToken,
  PspValidator.list_buyrate_details,
  Psp.master_buyrate_details
);
app.post(
  "/psp/psp_buyrate/list",
  CheckHeader,
  CheckToken,
  PspValidator.psp_buyrate,
  Psp.psp_buyrate_list
);
app.post(
  "/psp/psp_promo_buyrate/list",
  CheckHeader,
  CheckToken,
  PspValidator.psp_promo_buyrate,
  Psp.psp_promo_buyrate_list
);
app.post(
  "/psp/delete_buyrate",
  CheckHeader,
  CheckToken,
  PspValidator.delete_buyrate,
  Psp.delete_buyrate
);
app.post(
  "/psp/delete_promo_buyrate",
  CheckHeader,
  CheckToken,
  PspValidator.delete_promo_buyrate,
  Psp.delete_promo_buyrate
);

// sell rates sub-merchant master
app.post(
  "/plan/add_master_subm_sellrate",
  CheckHeader,
  CheckToken,
  PspValidator.add_master_sellrate,
  Psp.add_master_sellrate
);
app.post(
  "/plan/master_subm_sellrate/list",
  CheckHeader,
  CheckToken,
  Psp.master_sellrate_list
);
app.post(
  "/plan/master_subm_sellrate/details",
  CheckHeader,
  CheckToken,
  Psp.master_sellrate_details
);
app.post(
  "/plan/master_subm_sellrate/all_details",
  CheckHeader,
  CheckToken,
  PspValidator.list_sbm_sellrate_details_all,
  Psp.master_sellrate_all_details
);
app.post(
  "/plan/master_subm_sellrate/delete",
  CheckHeader,
  CheckToken,
  Psp.master_sellrate_delete
);
app.post(
  "/plan/master_subm_sellrate/update",
  CheckHeader,
  CheckToken,
  PspValidator.update_master_sellrate,
  Psp.master_sellrate_update
);

// sell rates sub-merchant
app.post(
  "/plan/add_sellrate",
  CheckHeader,
  CheckToken,
  PspValidator.add_sellrate,
  Psp.add_sellrate
);
app.post(
  "/plan/plan_sellrate/list",
  CheckHeader,
  CheckToken,
  Psp.sellrate_list
);
app.post(
  "/plan/plan_sellrate/delete",
  CheckHeader,
  CheckToken,
  Psp.sellrate_delete
);

// sell rates mid
app.post(
  "/plan/add_mid_sellrate",
  CheckHeader,
  CheckToken,
  PspValidator.add_sellrate_mid,
  Psp.create_mid_sellrate
);
app.post(
  "/plan/master_mid_sellrate/list",
  CheckHeader,
  CheckToken,
  Psp.master_mid_sellrate_list
);
app.post(
  "/plan/master_mid_sellrate/delete",
  CheckHeader,
  CheckToken,
  Psp.master_mid_sellrate_delete
);
app.post(
  "/plan/master_mid_sellrate/details",
  CheckHeader,
  CheckToken,
  PspValidator.list_sellrate_details,
  Psp.master_mid_sellrate_details
);
app.post(
  "/plan/master_mid_sellrate/all_details",
  CheckHeader,
  CheckToken,
  PspValidator.list_sellrate_details_all,
  Psp.master_mid_sellrate_details_all
);
app.post(
  "/plan/mid_sellrate/list",
  CheckHeader,
  CheckToken,
  PspValidator.mid_sellrate,
  Psp.mid_sellrate_list
);
app.post(
  "/plan/mid_promo_sellrate/list",
  CheckHeader,
  CheckToken,
  PspValidator.psp_promo_sellrate,
  Psp.mid_promo_sellrate_list
);
app.post(
  "/plan/delete_mid_sellrate",
  CheckHeader,
  CheckToken,
  PspValidator.delete_sellrate,
  Psp.delete_sellrate
);
app.post(
  "/plan/delete_promo_mid_sellrate",
  CheckHeader,
  CheckToken,
  PspValidator.delete_promo_sellrate,
  Psp.delete_promo_sellrate
);

// pricing plan
app.post(
  "/pricing-plan/add",
  CheckHeader,
  CheckToken,
  pricing_plan_validator.add,
  pricing_plan.add
);
app.post(
  "/pricing-plan/update",
  CheckHeader,
  CheckToken,
  pricing_plan_validator.update,
  pricing_plan.update
);
app.post("/pricing-plan/list", CheckHeader, CheckToken, pricing_plan.list);
app.post(
  "/pricing-plan/details",
  CheckHeader,
  CheckToken,
  pricing_plan.plan_details
);
app.post("/pricing-plan/delete", CheckHeader, CheckToken, pricing_plan.delete);

app.post(
  "/pricing-plan/trans_based_changed/add",
  CheckHeader,
  CheckToken,
  pricing_plan_validator.add_trans,
  pricing_plan.add_trans
);
app.post(
  "/pricing-plan/trans_based_changed/list",
  CheckHeader,
  CheckToken,
  pricing_plan.list_trans_rate
);
app.post(
  "/pricing-plan/trans_based_changed/delete",
  CheckHeader,
  CheckToken,
  pricing_plan_validator.delete_trans_rate,
  pricing_plan.delete_trans_rate
);
app.post(
  "/pricing-plan/trans_based_changed/details",
  CheckHeader,
  CheckToken,
  pricing_plan.plan_array
);
app.post(
  "/pricing-plan/trans_based_changed/plan_details",
  CheckHeader,
  CheckToken,
  pricing_plan.mid_sellrate_plan_trans_details
);
app.post(
  "/merchant/pricing-plan/plan_details",
  CheckHeader,
  CheckToken,
  pricing_plan.merchant_sellrate_plan_trans_details
);
app.post(
  "/pricing-plan/trans_based_changed/plan_list",
  CheckHeader,
  CheckToken,
  pricing_plan.mid_sell_rate
);
app.post(
  "/pricing-plan/feature_based_changed/add",
  CheckHeader,
  CheckToken,
  pricing_plan_validator.add_feature,
  pricing_plan.add_feature
);
app.post(
  "/pricing-plan/feature_based_changed/list",
  CheckHeader,
  CheckToken,
  pricing_plan.list_feature_rate
);
app.post(
  "/pricing-plan/feature_based_changed/delete",
  CheckHeader,
  CheckToken,
  pricing_plan_validator.delete_feature_rate,
  pricing_plan.delete_feature_rate
);

// app.post("/psp/list", CheckHeader, CheckToken, Psp.list);

app.post(
  "/get_request",
  CheckHeader,
  MerchantOrderValidator.get_request,
  MerchantOrder.get_request
);
// app.post("/run-query", async function (req, res) {
//   //console.log(req.headers)
//   //console.log(req.body)
//   // res.send("ok");
//   require("dotenv").config({
//     path: "../../../.env",
//   });
//   const env = process.env.ENVIRONMENT;
//   const config = require("../../../config/config.json")[env];
//   const pool = require("../../../config/database");
//   let qb = await pool.get_connection();
//   let response;
//   try {
//     response = await qb.query(req.body.query);
//   } catch (error) {
//     console.error("Database query failed:", error);
//   } finally {
//     qb.release();
//   }
//   res.send(response);
// });

app.post(
  "/orders/routing",
  // checkOrderToken,
  MerchantOrderValidator.routing,
  lookup.routebinNEW,
  lookup.checkbrandingcard,
  // FraudCheck,
  // fraudEngine,
  // NewTerminalController.checkCardIfBlocked,
  NewTerminalController.orderrouting,
  TerminalController.orderrouting
);
app.post(
  "/apple-pay/routing",
  MerchantOrderValidator.apple_routing,
  CheckHeader,
  AppleRoutingController.routing
);
app.post(
  "/orders/check-routing",
  lookup.routebin,
  NewTerminalController.orderrouting,
  NewTerminalController.nextrouting
);
app.post("/test/checkdb", TerminalController.checkdb);

/**bin lookup */
app.post("/lookup/bin", lookupValidatior.bin, lookup.bin);
app.post("/lookup/ip", CheckHeader, lookupValidatior.ip, lookup.ip);

//  secret key //
app.post(
  "/submerchant/generate_key",
  CheckHeader,
  CheckMerchantToken,
  Validator.add_secret_key,
  submerchant.add_secret_key
);
app.post(
  "/submerchant/key_list",
  CheckHeader,
  CheckMerchantToken,
  submerchant.secret_key_list
);
app.post(
  "/submerchant/deative_key",
  CheckHeader,
  CheckMerchantToken,
  Validator.deactive_key,
  submerchant.deactive_key
);
app.post(
  "/open/orders/transaction",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  payment_validation.transaction_validation,
  payment_validation.checkTransactionStateAndValidAction,
  MerchantOrder.transaction
);
app.post(
  "/orders/capture-new",
  function (req, res, next) {
    console.log(`inside capture new middleware`);
    req.credentials = {
      type: req.body.mode,
    };
    console.log(req.credentials);
    next();
  },
  payment_validation.transaction_validation_capture,
  MerchantOrder.transaction_new
);
app.post(
  "/orders/refund-void-new",
  CheckHeader,
  payment_validation.transaction_validation_refund_void,
  MerchantOrder.transaction_new
);
app.get(
  "/open/orders/transaction-details",
  Validator.checkRuleHeaders,
  // CheckOpenApiHeader,
  checkOpenMerchantCred,
  // payment_validation.transaction_details,
  MerchantOrder.transaction_details
);
app.get("/open/orders/transaction-list",Validator.checkRuleHeaders,checkOpenMerchantCred,MerchantOrder.transaction_list);
app.post("/add-payment-method-to-all", async (req, res) => {
  const path = require("path");
  require("dotenv").config({ path: "../../.env" });
  const env = process.env.ENVIRONMENT;
  const config = require("../../../config/config.json")[env];
  const pool = require("../../../config/database");
  let qb = await pool.get_connection();
  let response;
  try {
    response = await qb.select("id").get("pg_master_merchant");
    for (record of response) {
      let defaultPaymentMethod = [
        "card_payment",
        "amex_card",
        "bank_transfer",
        "apple_pay",
        "samsung_pay",
        "htc_pay",
        "google_pay",
        "paypal",
        "stored_card",
        "pay_vault",
      ];
      let i = 1;
      let merchantPaymentMethodData = [];
      for (let method of defaultPaymentMethod) {
        let temp = {
          sub_merchant_id: record.id,
          methods: method,
          sequence: i,
          is_visible: 1,
        };
        merchantPaymentMethodData.push(temp);
        i++;
      }
      await qb
        .returning("id")
        .insert(
          config.table_prefix + "merchant_payment_methods",
          merchantPaymentMethodData
        );
    }
  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    qb.release();
  }
  res.send("OK");
});

app.post(
  "/dashboard/top_customer",
  CheckHeader,
  CheckToken,
  Dashboard.top_customer
);
app.post(
  "/dashboard/top_country",
  CheckHeader,
  CheckToken,
  Dashboard.top_country
);
app.post(
  "/dashboard/top_payment_method",
  CheckHeader,
  CheckToken,
  Dashboard.top_payment_method
);

//dashboard graph API
app.post("/dashboard/sales", CheckHeader, CheckToken, Dashboard.sales);
app.post(
  "/dashboard/transactions",
  CheckHeader,
  CheckToken,
  Dashboard.transactions
);
app.post(
  "/dashboard/authorised",
  CheckHeader,
  CheckToken,
  Dashboard.authorised
); //approval rate
app.post("/dashboard/refund", CheckHeader, CheckToken, Dashboard.refund); //refund
app.post(
  "/dashboard/routing-graph",
  CheckHeader,
  CheckToken,
  Dashboard.routingGraph
);
app.post(
  "/dashboard/retry-graph",
  CheckHeader,
  CheckToken,
  Dashboard.retryGraph
);
app.post(
  "/dashboard/cascade-graph",
  CheckHeader,
  CheckToken,
  Dashboard.cascade
);
app.post(
  "/dashboard/oneclick-graph",
  CheckHeader,
  CheckToken,
  Dashboard.oneclickGraph
);
app.post("/dashboard/allowed", CheckHeader, CheckToken, Dashboard.allowed);
app.post("/dashboard/declined", CheckHeader, CheckToken, Dashboard.declined);
app.post("/dashboard/reviewed", CheckHeader, CheckToken, Dashboard.reviewed);
app.post(
  "/dashboard/review_captured",
  CheckHeader,
  CheckToken,
  Dashboard.reviewed_captured
);
app.post(
  "/dashboard/3ds-version",
  CheckHeader,
  CheckToken,
  Dashboard.version_3DS
);
app.post(
  "/dashboard/3ds-success",
  CheckHeader,
  CheckToken,
  Dashboard.success_3DS
);

//not used
app.post("/dashboard/oneclick", CheckHeader, CheckToken, Dashboard.oneclick);
app.post("/dashboard/retry", CheckHeader, CheckToken, Dashboard.retry);

// comment added

// test environment apis
app.post(
  "/test/orders/create",
  Validator.checkRuleHeaders,
  checkTestMerchantCred,
  MerchantOrderValidator.test_create,
  TestOrder.test_order_create
);
app.post(
  "/test/order/create",
  Validator.checkRuleHeaders,
  checkTestMerchantCred,
  TestOrder.test_demo_order_create
);
app.post(
  "/test/order/details",
  checkOrderToken,
  MerchantOrderValidator.test_get,
  TestOrder.test_order_details
);
app.post(
  "/test/orders/pay",
  checkOrderToken,
  MerchantOrderValidator.pay,
  TestOrder.test_pay
);
app.post(
  "/test/orders/capture",
  MerchantOrderValidator.test_capture,
  TestOrder.test_capture
);
app.post(
  "/test/orders/update_3ds",
  MerchantOrderValidator.test_order_id_check,
  TestOrder.test_update_3ds
);

app.post(
  "/test/lookup/bin",
  MerchantOrderValidator.test_bin,
  TestOrder.test_bin
);

app.post(
  "/test/orders/void",
  payment_validation.test_void,
  TestOrder.test_void_func
);

app.post(
  "/test/orders/refund",
  payment_validation.test_refund,
  TestOrder.test_refund_func
);

app.post(
  "/test/orders/cancel",
  MerchantOrderValidator.test_cancel,
  checkOrderToken,
  TestOrder.cancel
);

app.post(
  "/test/transactions/list",
  Validator.checkRuleHeaders,
  checkTestMerchantCred,
  ReferralBonusInvoiceValidator.open_trans_list,
  TestOrder.test_list
);

app.post(
  "/test/orders/transaction-details",
  Validator.checkRuleHeaders,
  checkTestMerchantCred,
  TestOrder.transaction_details
);

app.post(
  "/test/orders/transaction-list",
  Validator.checkRuleHeaders,
  checkTestMerchantCred,
  TestOrder.transaction_list
);

app.post(
  "/test/orders/transaction",
  Validator.checkRuleHeaders,
  checkTestMerchantCred,
  payment_validation.transaction_validation,
  TestOrder.transaction
);

app.post("/subscription/payments", MerchantOrder.auto_subscription_payRequest);

app.post("/orders/auto-capture", MerchantOrder.auto_capture);
app.post("/orders/check-card-expiry", MerchantOrder.check_card_expiry);

// app.post("/orders/apple-pay", MerchantOrderValidator.apple_pay, ApplePay.pay);
// app.post("/apple-pay-decrypt", ApplePay.decrypt);

//all code related to card failed
app.post(
  "/subscription/update/details",
  CheckHeader,
  SubscriptionPlanValidator.subscription_link_details,
  subscription_card_expired.get_subscription
);
app.post(
  "/subscription/update/create_order",
  CheckHeader,
  SubscriptionPlanValidator.subscription_update_create_order,
  subscription_card_expired.create_order
);
app.post(
  "/subs_plan/send-expired-mail",
  CheckHeader,
  subs_plan.sendSubscriptionExpiredEmail
);

app.post(
  "/subs_plan/send-about-expired-mail",
  CheckHeader,
  subs_plan.sendSubscriptionAboutToExpiredEmail
);
app.post(
  "/subs_plan/declined-cards-mail",
  CheckHeader,
  subs_plan.sendSubscriptionDeclinedEmail
);
app.post(
  "/merchant/referrer-bonus",
  CheckHeader,
  checkToken,
  Referrer.merchant_bonus
);
app.post("/ni/apple-pay", ni_apple_pay.pay);
app.post("/paytabs/apple-pay", paytabs_apple_pay.pay);
app.post("/telr/apple-pay", telr_apple_pay.pay);

// test transaction url
app.get("/transaction/charges", calculateTransactionCharges);

// schedule.scheduleJob("'0 0 1 * *'", chargesController.create_invoice_cron);
app.get("/merchant/charges/invoice", chargesController.create_invoice_request);

app.post(
  "/merchant/charges/invoice/list",
  charges_invoice_controller.new_invoice_list
);
app.post(
  "/merchant/charges/invoice/view",
  CheckHeader,
  charges_invoice_controller.new_view
);
app.post(
  "/merchant/charges/invoice/update/status",
  CheckHeader,
  charges_invoice_validator.new_update,
  charges_invoice_controller.new_update
);
app.post("/card/issuers", CheckHeader, CheckToken, Dashboard.card_issuers);

app.post(
  "/invoice-to-merchant",
  CheckHeader,
  CheckToken,
  charges_invoice_controller.invoice_to_merchant_list
);
app.post(
  "/invoice-to-merchant/view",
  CheckHeader,
  CheckToken,
  charges_invoice_controller.invoice_to_merchant_view
);
app.post(
  "/invoice-to-merchant/update/status",
  CheckHeader,
  charges_invoice_validator.invoice_to_merchant,
  charges_invoice_controller.invoice_to_merchant_update
);
app.post(
  "/invoice-to-psp",
  CheckHeader,
  CheckToken,
  charges_invoice_controller.invoice_to_psp_list
);
app.post(
  "/invoice-to-psp/view",
  CheckHeader,
  CheckToken,
  charges_invoice_controller.invoice_to_psp_view
);
app.post(
  "/invoice-to-psp/update/status",
  CheckHeader,
  charges_invoice_validator.invoice_to_psp,
  charges_invoice_controller.invoice_to_psp_update
);

// schedule.scheduleJob("* */6 * * *", function () {
//   autoCapture();
// });

// schedule.scheduleJob("* */1 * * *", function () {
// autoCaptureTest();
//   TelrAutoCapture.main()
// });

const { Mutex } = require("async-mutex");
const mutex = new Mutex();

const custom_form_data_validator = require("../../../utilities/validations/custom_form_data_validator.js");
const CustomFormModal = require("../../../models/custom_form.js");
const custom_form_controller = require("../../../controller/custom_form_controller.js");
const update_custom_form_validator = require("../../../utilities/validations/update_custom_form_validator.js");
const get_payment_method_validator = require("../../../utilities/validations/get_payment_method_validator.js");
const custom_form_list_validator = require("../../../utilities/validations/custom_form_list_validator.js");
const confirm_payment = require("../../../controller/mtn/confirm.js");
const verify = require("../../../controller/mtn/Verify.js");
const merchantOrderModel = require("../../../models/merchantOrder.js");
const { count } = require("console");
const { addWebhook } = require("../../../models/merchantmodel.js");
const MerchantEkycModel = require("../../../models/merchant_ekycModel.js");
const verifySandbox = require("../../../controller/mtn-sandbox/Verify.js");
const mtnSandboxPay = require("../../../controller/mtn-sandbox/Pay.js");
const confirm_sandbox_payment = require("../../../controller/mtn-sandbox/confirm.js");
// node_cron.schedule('* * * * *', async () => {
//   const release = await mutex.acquire();
//   try {
//     await TelrAutoCapture.telrCaptureRequest();
//   } finally {
//     release();
//   }
// });

// node_cron.schedule('*/10 * * * *', () => {
//   console.log('Scheduled job started');
//   try {
//     autoCaptureTest();
//   } catch (error) {
//     console.log('Error in scheduled job:', error);
//   }
// });

// setInterval(async() => {
//   await TelrAutoCapture.telrCaptureRequest();
// }, 10000);

app.post("/auto-capture-test", MerchantOrder.autoCaptureTest);
app.post("/auto-capture-live", MerchantOrder.autoCaptureLive);
// app.post("/telr-auto-capture-test", MerchantOrder.TelrautoCaptureTest);

app.post("/dapi/login", DapiValidator.login, DapiController.login);
app.post(
  "/dapi/get-account",
  DapiValidator.getAccounts,
  DapiController.getAccounts
);

app.post("/dapi/transfer", DapiValidator.transfer, DapiController.transfer);
// payment links open api
app.post(
  "/open/payment_links/add",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  QR_validation.open_paymentLink_add,
  QR_generate.open_paymentLink_add
);
app.post(
  "/open/payment_links/update",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  QR_validation.open_paymentLink_update,
  QR_generate.open_paymentLink_update
);
app.post(
  "/open/payment_links/deactivate",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  QR_validation.open_paymentLink_deactivate,
  QR_generate.open_deactivate
);
app.post(
  "/open/payment_links/activate",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  QR_validation.open_paymentLink_activate,
  QR_generate.open_activate
);
app.get(
  "/open/payment_links/details",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  QR_validation.open_paymentLink_details,
  QR_generate.open_paymentLink_details
);
app.get(
  "/open/payment_links/list",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  QR_validation.open_paymentLink_list,
  QR_generate.open_paymentLink_list
);
app.post(
  "/open/invoice/import",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  ExcelImportUpload,
  invoice.open_import
);
app.post(
  "/open/inv_items/add",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_item_add,
  invoice.open_item_add
);
app.get(
  "/open/inv_items/list",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_item_list,
  invoice.open_item_list
);
app.get(
  "/open/inv_items/details",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_item_details,
  invoice.open_item_details
);
app.post(
  "/open/inv_items/update",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_item_update,
  invoice.open_item_update
);
app.post(
  "/open/inv_items/deactivate",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_item_deactivated,
  invoice.open_item_deactivate
);
app.post(
  "/open/inv_items/activate",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_item_activate,
  invoice.open_item_activate
);
app.post(
  "/open/inv_items/delete",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_item_delete,
  invoice.open_item_delete
);

app.post(
  "/open/inv_customer/add",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_add_customer,
  invoice.open_add_customer
);
app.post(
  "/open/inv_customer/update",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_update_customer,
  invoice.open_update_customer
);
app.get(
  "/open/inv_customer/details",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_customer_details,
  invoice.open_customer_details
);
app.get(
  "/open/inv_customer/list",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_customer_list,
  invoice.open_list_customer
);
app.post(
  "/open/inv_customer/deactivate",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_customer_deactivate,
  invoice.open_customer_deactivate
);
app.post(
  "/open/inv_customer/activate",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_customer_activate,
  invoice.open_customer_activate
);
app.post(
  "/open/inv_customer/delete",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_customer_delete,
  invoice.open_customer_delete
);
app.post(
  "/open/invoice/add",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_inv_add,
  invoice.open_invoice_add
);
app.get(
  "/open/invoice/list",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_invoice_list,
  invoice.open_invoice_list
);

app.post(
  "/open/invoice/cancel",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_inv_cancel,
  invoice.open_cancel_invoice
);
app.post(
  "/open/invoice/delete",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_inv_delete,
  invoice.open_invoice_delete
);
app.post(
  "/open/invoice/update",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_inv_update,
  invoice.open_invoice_update
);
app.get(
  "/open/invoice/details",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_inv_details,
  invoice.open_invoice_details
);
app.post(
  "/open/invoice/send",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  invoiceValidation.open_inv_send,
  invoice.finalize_and_send
);
app.post(
  "/open/subscription/add",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_add,
  subs_plan.open_create
);
app.get(
  "/open/subscription/details",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_plan_details,
  subs_plan.open_plan_details
);
app.post(
  "/open/subscription/update",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_plan_update,
  subs_plan.open_plan_update
);

app.post(
  "/open/subscription/activate",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_plan_activate,
  subs_plan.open_plan_activate
);
app.post(
  "/open/subscription/deactivate",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_plan_deactivate,
  subs_plan.open_plan_deactivate
);
app.get(
  "/open/subscription/list",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_plan_list,
  subs_plan.open_list
);
app.post(
  "/open/subscription/send_mail",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_mail_send,
  subs_plan.open_mail_send
);

// subscribers

app.get(
  "/open/subscriber/details",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_subscriber_details,
  subs_plan.open_subscriber_details
);
app.get(
  "/open/subscriber/list",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_subscriber_list,
  subs_plan.open_subscriber_list
);

// contracts
app.post(
  "/open/contract/cancel_subscription",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.cancel_subscription,
  subs_plan.open_cancel_subscription
);
app.get(
  "/open/contract/list",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_contract_list,
  subs_plan.open_contract_list
);
app.get(
  "/open/contract/details",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  SubscriptionPlanValidator.open_contract_details,
  subs_plan.open_contract_details
);
app.get(
  "/open/view-static-qr",
  Validator.checkRuleHeaders,
  checkOpenMerchantCred,
  QR_generate.open_view_static_qr
);

app.post(
  "/routing/mid",
  CheckHeader,
  CheckToken,
  PspValidator.routing_mid,
  RoutingController.midList
);

app.post(
  "/routing/routing-rule",
  CheckHeader,
  CheckToken,
  PspValidator.routing_rule,
  RoutingController.routingRule
);

app.post(
  "/routing/rule/get",
  CheckHeader,
  CheckToken,
  RoutingRuleValidator.get,
  RoutingController.getRoutingRule
);

app.post("/routing/attribute", RoutingController.routingAttribute);
app.post(
  "/routing/order/store",
  CheckHeader,
  CheckToken,
  PspValidator.routing_store,
  RoutingController.storeMidOrder
);

app.post(
  "/routing/rule/store",
  CheckHeader,
  CheckToken,
  RoutingRuleValidator.add,
  RoutingController.storeRoutingRule
);

app.post(
  "/routing/rule/update-order",
  CheckHeader,
  CheckToken,
  RoutingController.updateRoutingRuleOrder
);

app.post(
  "/routing/rule/status",
  CheckHeader,
  CheckToken,
  RoutingRuleValidator.ruleStatus,
  RoutingController.changeRuleStatus
);

app.post(
  "/routing/rule/delete",
  CheckHeader,
  CheckToken,
  RoutingRuleValidator.ruleDelete,
  RoutingController.ruleDelete
);

// meps session api
app.post(
  "/mpgs/session",
  MPGSValidator.session,
  lookup.routebin,
  MerchantOrder.addOrUpdateCustomer,
  MerchantOrder.saveCard,
  mpgs_session
);

app.post("/mpgs/3ds", mpgs_3ds);

app.post(
  "/nutrioniapi/details",
  CheckHeader,
  CheckToken,
  Setting.get_nutrionoapi_details
);
app.post(
  "/nutriono-api/update",
  CheckHeader,
  CheckToken,
  Setting.update_nutriono
);
app.post("/css-setup/details", CheckHeader, Setting.getCssSetupDetails);

app.post("/css-details/update", CheckHeader, CheckToken, Setting.updateCss);
app.get("/get-buffer", function (req, res) {
  const credentials = `merchant.27759:HnLp#pxk2W@r7C4c`;
  const token = Buffer.from(credentials).toString("base64");
  console.log(`Basic ${token}`);
});
app.post(
  "/myf/pay",
  // MPGSValidator.session,
  lookup.routebin,
  MerchantOrder.addOrUpdateCustomer,
  MerchantOrder.saveCard,
  directpay
);
app.post("/myf/update-details", myf_3ds);

app.post(
  "/fiserv/pay",
  fiserv_validation.primary_transaction,
  lookup.routebin,
  MerchantOrder.addOrUpdateCustomer,
  MerchantOrder.saveCard,
  fiserv_pay
);
app.post("/fiserv/3ds", fiserv_3ds);
app.post("/fiserv/after-3ds", update_3ds);
app.post(
  "/merchant/register-submerchant",
  CheckHeader,
  MerchantRegisterValidator.api_register_submerchant,
  MerchantRegister.register_submerchant
);
app.post(
  "/merchant/onboard-submerchant",
  CheckHeader,
  (req,res,next)=>{
    req.body.super_merchant_id = encrypt_decrypt('decrypt',req.body.super_merchant_id);
    next();
  },
  MerchantRegisterValidator.api_register_submerchant,
  MerchantRegister.register_submerchant
);
app.post(
  "/merchant/add-mid",
  checkOpenMerchantCred,
  MerchantRegisterValidator.add_mid,
  submerchant.open_add_mid
);
app.post(

  "/payment/custom-form",
  custom_form_data_validator.validate,
  custom_form_controller.get
);

app.post(
  "/payment/custom-form-list",
  custom_form_list_validator.validate,
  custom_form_controller.list
);

app.post(
  "/payment/update-custom-form",
  update_custom_form_validator.validate,
  custom_form_controller.update
);

app.post(
  "/get_supported_payment_methods",
  get_payment_method_validator.validate,
  submerchant.get_merchant_payment_methods
);
app.post("/execute-payment",
  checkOpenMerchantCred,
  ipChecker,
  S2SValidator.execuatePayment,
  minMaxTxnAmountChecker,
  execuatePayment
);
app.post("/status-mpgs", function (req, res, next) {
  req.body.order_id = req.query.order_id;
  req.body.mode = req.query.mode;
  req.body.is_s2s = true;
  next();
}, s2s_3ds);
app.post("/enc-dec", function (req, res) {
  let text = req.bodyString("string");
  let decoded = encrypt_decrypt('decrypt', text);
  console.log(decoded);
})
app.post("/transaction-charges", async function (req, res) {
  let transationCharges = require("../../../utilities/charges/transaction-charges/index.js");
  let order_details = req.body;
  await transationCharges(order_details);
});
app.post("/wallet-summary", CheckHeader, CheckToken, charges_invoice_controller.walletSummary);

app.post("/pay/mtn-momo", CheckHeader, MtnMomoValidator.pay, mtnPay);
app.post("/confirm/mtn-momo", CheckHeader, MtnMomoValidator.confirm, confirm_payment);
app.post("/mtn-verify", CheckHeader, verify);
app.post(
  "/fetch-wallet-balance",
  apiRateLimiter,
  WalletValidator.validate_user,
  charges_invoice_controller.walletBalance
);
app.post('/update-funding-details',APIAuth,fundingDetials.update,submerchant.updateFundingMethod);
app.post('/add-funding-details',APIAuth,fundingDetials.add,submerchant.addFundingMethod);
app.post('/verify-funding-details',APIAuth,fundingDetials.verify,submerchant.verifyFundingDetails);
app.post('/manage-funding-details',APIAuth,fundingDetials.manage_funding,submerchant.manageFundingDetails);
app.post('/update-payout-status',CheckHeader,payoutValidator.add,charges_invoice_controller.addPayout)
app.post('/fetch-payers',APIAuth,submerchant.fetchPayer);
app.post('/fetch-payer-details',APIAuth,submerchant.fetchPayerDetails);
app.post('/funding-details',APIAuth,fundingDetials.get, submerchant.getFundingDetails);
app.post('/funding-details-list',APIAuth,fundingDetials.list,submerchant.getFundingDetailsList);
app.post('/delete-funding-details',CheckHeader,submerchant.deleteFundingDetails);

app.get('/fetch-payout-countries',APIAuth,submerchant.getPayoutCountries);
app.post('/fetch-currency-by-country',CheckHeader,submerchant.getCurrencyByCountry);
app.post("/get-receiver-details",CheckHeader, MerchantRegister.get_receiver_details)
app.post("/receiver-details-filter",CheckHeader, MerchantRegister.get_receivers_by_filters);
app.post('/get-all-funding-details',CheckHeader,submerchant.getAllFundingDetails);
app.post(
  "/set-order-expired",
  CheckHeader,
  MerchantOrderValidator.set_expired_order,
  MerchantOrder.set_order_expired
);
app.post("/orange-verify", CheckHeader, orange_verify);
app.post("/pay/orange-money",CheckHeader,MtnMomoValidator.pay,orange_pay);
app.post("/confirm/orange-money",CheckHeader, MtnMomoValidator.confirm,orange_confirm);
app.post('/fetch-ip',CheckHeader,CheckToken,submerchant.fetchIPList);
app.post('/update-ip-list',CheckHeader,CheckToken,submerchant.updateIp);
app.post('/pricing-plan/view-sale-rate',CheckHeader,CheckToken,pricing_plan.view_sale_rate);
app.post("/fetch-wallet-list",CheckHeader,WalletValidator.list,charges_invoice_controller.fetchWalletList);

schedule.scheduleJob('0 9 * * *', async function(){
    console.log("starting payout scheddule");
    await PayoutController.check_payout_schedule();
    console.log("end of payout schedule");
});
app.get("/cron-schedule-test", PayoutController.check_payout_schedule);
app.post('/merchant-wallets',CheckHeader,CheckToken,WalletValidator.wallets,charges_invoice_controller.merchantWalletList);
app.post('/fetch-sub-merchant-list',CheckHeader,CheckToken,charges_invoice_controller.fetchSubMerchantList);
app.post('/get-country-details-by-id',CheckHeader, countries.details_2);
app.post('/get-country-details-by-iso',CheckHeader, countries.details_by_iso_code);
app.post(
  "/create-wallet",
  WalletValidator.create,
  WalletValidator.create_wallet,
  wallet.create
);
app.post("/wallet-list", apiRateLimiter, WalletValidator.wallet_list, wallet.list);
app.post("/manage-wallet", CheckHeader, WalletValidator.manage, wallet.manage);
app.get("/get-wallet-by-id/:id", WalletValidator.get_wallet_by_id, wallet.get_wallet_details_by_id);
// app.post('/roll-out-wallet', walletRollout);

// schedule.scheduleJob('0 2 * * *', async function () {
//   console.log("🕑 Starting Wallet Snapshot Job at 2:00 AM");
//   await walletRollout();
//   console.log("✅ Wallet Snapshot Job Completed");
// });
app.get('/roll-out',walletRollout);
app.post("/get-wallet", WalletValidator.get_wallet, wallet.get_wallet);
app.post("/load-wallet", WalletValidator.load_wallet, wallet.load_wallet);
app.post('/add-bulk-funding-details',APIAuth,fundingDetials.add_bulk,submerchant.addBulkFundingMethod);
app.post('/verify-bulk-funding-details',APIAuth,CheckHeader,fundingDetials.verify_bulk,submerchant.verifyBulkFundingDetails);
app.post("/confirm-payment",CheckMerchantCred,MerchantOrder.confirm_wallet_payment);
app.post("/orders/expire-details",MerchantOrder.fetchOrderDetails);
app.post("/unload-wallet", WalletValidator.unload_wallet, wallet.unload_wallet);
app.post("/get-wallet-statement",apiRateLimiter, WalletValidator.get_wallet_statement, wallet.get_wallet_statement);
app.post("/get-snapshot-balance", WalletValidator.get_wallet_snapshots, wallet.get_snapshot_balance);
app.post("/merchant-webhook-details", CheckHeader, webHook.details);
app.post("/get-submerchant-details", CheckHeader, submerchant.get_submerchant_details);
app.get("/get-company-details", CheckHeader, submerchant.get_company_details);
app.post("/check-merchant-keys", CheckHeader, submerchant.check_merchant_keys);
app.post("/update-wallet", CheckHeader, wallet.update);

app.post("/mtn-sandbox-verify", CheckHeader, verifySandbox);
app.post("pay/mtn-sandbox-mom", CheckHeader, MtnMomoValidator.pay, mtnPay);
app.post("/pay/mtn-sandbox-momo", CheckHeader, MtnMomoValidator.pay, mtnSandboxPay);
app.post("/confirm/mtn-sandbox",CheckHeader, MtnMomoValidator.confirm, confirm_sandbox_payment);
app.post("/orange-sandbox-verify", CheckHeader, verifyOrangeSandbox);
app.post("/pay/orange-sandbox", CheckHeader, MtnMomoValidator.pay, payOrangeSandbox);
app.post("/confirm/orange-sandbox", CheckHeader,confirmOrangeSandbox);
app.post("/update_charges", CheckHeader,charges_invoice_controller.updateCharges);
app.post("/alpay-verify",CheckHeader,verifyAlPay);
app.post("/pay/alpay",CheckHeader,MtnMomoValidator.pay, payAlPay);
app.post("/confirm/alpay",CheckHeader,confirmAlpay);
app.post("/charges/analytics",CheckHeader,charges_invoice_controller.get_charges_analytics);
app.post('/sub-merchant-count',CheckHeader,charges_invoice_controller.subMerchantCount);
app.post('/wallet-count',CheckHeader,charges_invoice_controller.walletCount);
app.post('/accounts-count',CheckHeader,charges_invoice_controller.accountCount);
app.post('/ghana-payers-list',CheckHeader,submerchant.get_ghana_payers_list);
app.post("/merchant/update-profile",CheckHeader,MerchantRegisterValidator.updateProfile,MerchantRegister.updateMrechantProfile);
app.post('/fetch-super-merchant-logo',CheckHeader,CheckToken,MerchantEkyc.fetchSuperMerchantLogo);
app.post('/upload-super-merchant-logo',CheckHeader,CheckToken,superMerchantLogoUpload,MerchantEkyc.uploadSuperMerchantLogo);
app.post('/fetch-logo',CheckHeader,MerchantEkyc.fetchLogo);
app.get('/roll-out-manually',walletRollout);
app.post('/add-merchant-roles',CheckHeader,CheckToken,MerchantSetup.add);
app.post('/update-merchant-roles',CheckHeader,CheckToken,MerchantSetup.update);
app.post('/get-merchant-roles',CheckHeader,CheckToken,MerchantSetup.list);
app.post('/delete-merchant-roles',CheckHeader,CheckToken,MerchantSetup.delete);
app.post('/get-roles-by-country',CheckHeader,CheckToken,MerchantSetup.get_by_country);
app.post('/update-alpay-status',function(req,res){
    console.log(`This is log when we got webhook from ALPAY`);
    console.log(req.body);
})
// app.get('/roll-out-wallet',walletRollout);
const { seedWallets } = require('../../../scripts/seed-wallets.js');
app.post('/admin/seed-wallets', async (req, res) => {
  try {
    const result = await seedWallets();
    res.json({ 
      success: true, 
      message: 'Wallets seeded successfully',
      data: result 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
module.exports = app;
