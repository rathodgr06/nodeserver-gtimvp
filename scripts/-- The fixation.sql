-- The fixation
ALTER TABLE pg_merchant_payment_methods 
ADD INDEX idx_sub_merchant_id (sub_merchant_id);

ALTER TABLE pg_merchant_draft_payment_methods 
ADD INDEX idx_submerchant_id (submerchant_id);

ALTER TABLE pg_master_merchant_draft
ADD INDEX idx_master_submerchant_id (submerchant_id);

🚀 THE BEST POSSIBLE SQL (OPTIMIZED + NO DEADLOCK)

Here is the final version I recommend:

Query 1
INSERT INTO pg_merchant_payment_methods(sub_merchant_id, methods, others, sequence, is_visible, mode, created_at)
SELECT 4014, methods, others, sequence, is_visible, mode, NOW()
FROM pg_merchant_payment_methods FORCE INDEX(idx_sub_merchant_id)
WHERE sub_merchant_id = 4012
LOCK IN SHARE MODE;

Query 2
INSERT INTO pg_merchant_draft_payment_methods(submerchant_id, methods, others, sequence, is_visible, mode, created_at)
SELECT 4014, methods, others, sequence, is_visible, mode, NOW()
FROM pg_merchant_draft_payment_methods FORCE INDEX(idx_submerchant_id)
WHERE submerchant_id = 4012
LOCK IN SHARE MODE;

Query 3
INSERT INTO pg_master_merchant_draft 
(submerchant_id, brand_color, accent_color, language, payment_methods, card_show, font_name, card_payment, stored_card, created_at, test_card_payment_scheme, test_stored_card_scheme)
SELECT 
    4014, brand_color, accent_color, language, payment_methods, card_show, font_name, card_payment, stored_card, NOW(),
    test_card_payment_scheme, test_stored_card_scheme
FROM pg_master_merchant_draft FORCE INDEX(idx_master_submerchant_id)
WHERE submerchant_id = 4012
LOCK IN SHARE MODE;
