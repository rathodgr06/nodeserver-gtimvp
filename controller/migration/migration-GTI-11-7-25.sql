UPDATE pg_master_merchant
SET super_merchant_id = 6,onboarded_through_api=1
WHERE id IN (
  374, 373, 372, 371, 370, 369, 368, 367, 366, 365, 364, 363, 362, 361, 360, 359, 358, 357, 356, 355,
  354, 353, 352, 351, 350, 348, 347, 346, 345, 344, 343, 342, 341, 340, 339, 338, 337, 336, 335, 334,
  333, 332, 331, 330, 329, 328, 326, 325, 324, 323, 322, 321, 320, 319, 318, 317, 316, 315, 314, 312,
  311, 310, 309, 308, 307, 306, 305, 304, 303, 302, 301, 300, 299, 298, 297, 296, 295, 294, 293, 292,
  291, 290, 289, 288, 287, 286, 284, 283, 282, 281, 280, 279, 278, 277, 276, 275, 274, 273, 272, 271,
  270, 269, 268, 267, 266, 265, 264, 262, 259, 258, 257, 256, 255, 254, 253, 252, 251, 249, 248, 244,
  243, 242, 241, 240, 239, 238, 237, 236, 235, 234, 233, 232, 231, 230, 229, 228, 227, 226, 225, 224,
  223, 222, 221, 220, 219, 218, 217, 215, 214, 213, 212, 211, 210, 208, 207, 206, 205, 204, 203, 202,
  201, 200, 199, 198, 197, 196, 195, 194, 193, 192, 191, 190, 189, 188, 187, 186, 185, 184, 183, 182,
  181, 180, 178, 176, 175, 174, 172, 171, 170, 169, 168, 167, 166, 165, 164, 163, 162, 161, 160, 159,
  158, 157, 156, 155, 154, 153, 152, 151, 149, 148, 147, 146, 145, 144, 143, 142, 140, 138, 137, 136,
  134, 133, 132, 131, 130, 128, 127, 125, 124, 123, 121, 119, 117, 116, 115, 114, 113, 112, 110, 109,
  106, 105, 103, 102, 101, 100, 99, 98, 95, 94, 93, 92, 89, 88, 86, 85, 84, 83, 82, 81, 79, 78, 77, 76,
  74, 73, 72, 71, 70, 69, 68, 59, 57, 56, 55, 54, 50, 49, 47, 45, 44, 42, 40, 36, 35, 34, 33, 32, 31,
  30, 27, 24, 22
);


-------------------------------------------------------------------------------------------------------------

/*** Migration Note:
This script updates the `pg_master_merchant` table to set the `super_merchant_id` to 331 and `onboarded_through_api` to 1 for a specified list **/





--------------------------------------------------------------------------------------------------------------
/*** SELECT ALL THE MID for the all the submerchant under super merchant 331 with inheriatance enabled  **/

SELECT mid.id,mid.MID,mid.password,mm.id as submerchant_id,mm.super_merchant_id as super_merchant,mm.onboarded_through_api,mid.is_deleted from pg_mid as mid left join pg_master_merchant as mm on mid.submerchant_id=mm.id where mm.super_merchant_id=331;

---------------------------------------------------------------------------------------------------------------
/*** DELETE MIDS for all the submerchants of super merchant 331 **/
DELETE pg_mid
FROM pg_mid
LEFT JOIN pg_master_merchant ON pg_mid.submerchant_id = pg_master_merchant.id
WHERE pg_master_merchant.super_merchant_id = 331;
-------------------------------------------------------------------------------------------------------------------------
/*** SELECT all submerchats of super merchant 331 **/
SELECT * FROM pg_master_merchant where super_merchant_id=331;
-------------------------------------------------------------------------------------------------------------------------
/** Select Lowest SUb merchant ID for Super Merchant 331 **/

SELECT mid.id, mid.MID, mid.password, mm.id AS submerchant_id, mm.super_merchant_id AS super_merchant, mm.onboarded_through_api, mid.deleted FROM pg_mid AS mid LEFT JOIN pg_master_merchant AS mm ON mid.submerchant_id = mm.id WHERE mm.super_merchant_id = 331 ORDER BY mm.id ASC LIMIT 1;
-------------------------------------------------------------------------------------------------------------------------

/*** UPDATE the super merchant id for all the submerchants of super merchant 331 to 6 **/

Shared with placid
SELECT 
  id AS sub_merchant_id,
  super_merchant_id,
  onboarded_through_api + 0 AS inherited,
  status AS status,
  deleted,
  register_at
FROM pg_master_merchant
WHERE super_merchant_id = 6;


DELETE FROM pg_master_merchant WHERE id = 2;


SELECT mid.id, mid.MID, mid.password, mm.id AS submerchant_id, mm.super_merchant_id AS super_merchant, mm.onboarded_through_api, mid.deleted FROM pg_mid AS mid LEFT JOIN pg_master_merchant AS mm ON mid.submerchant_id = mm.id WHERE mm.super_merchant_id = 6 AND mm.id=6 ORDER BY mm.id ASC;


UPDATE pg_master_merchant SET onboarded_through_api=1 WHERE id <>6 AND super_merchant_id = 6;