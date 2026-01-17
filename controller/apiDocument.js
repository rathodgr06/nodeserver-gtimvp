exports.getApiDocumentationDetails = (req, res) => {
  try {
    /**
     * NOTE:
     * This response structure MUST remain same
     * even when you make it dynamic later.
     */

    const response = {
      project: {
        name: "PART API Documentation",
        nameSidebar: "PAYDART Developers",
        version: "1.0.0",
        title: "PAYDART Developers",
        url: "https://uat-nodeserver.paydart.co/api/v1",
        template: {
          withCompare: true,
          withGenerator: true
        },
        generator: {
          name: "apidoc",
          time: "2026-01-01T10:00:00.000Z",
          url: "https://apidocjs.com",
          version: "0.28.1"
        }
      },

      apis: [
        {
          type: "POST",
          url: "/open/orders/create",
          urlTest: "/open/orders/create",
          title: "Request payment",
          name: "get-payment",
          description:
            "<div class='mt-2 text-justify'>Request a payment link and redirect customer for payment.</div>",
          group: "payment-api",
          groupTitle: "Payment API",
          version: "1.0.0",

          header: {
            fields: {
              Header: [
                {
                  group: "Header",
                  type: "String",
                  optional: false,
                  field: "merchant-key",
                  description: "<p>Your merchant key</p>"
                },
                {
                  group: "Header",
                  type: "String",
                  optional: false,
                  field: "merchant-secret",
                  description: "<p>Your merchant secret</p>"
                }
              ]
            }
          },

          parameter: {
            fields: {
              Body: [
                {
                  group: "Body",
                  type: "String",
                  optional: false,
                  field: "action",
                  description: "<p>AUTH or SALE</p>"
                },
                {
                  group: "Body",
                  type: "Object",
                  optional: false,
                  field: "order_details",
                  description: "<p>Order details object</p>"
                }
              ]
            }
          },

          examples: [
            {
              title: "curl",
              type: "curl",
              content:
                "curl --location '{URL}' \\\n--header 'merchant-key: test-key' \\\n--header 'merchant-secret: test-secret'"
            }
          ],

          success: {
            fields: {
              "200": [
                {
                  group: "200",
                  type: "String",
                  field: "status",
                  description: "<p>SUCCESS</p>"
                }
              ]
            }
          },

          error: {
            fields: {
              "4xx": [
                {
                  group: "4xx",
                  type: "String",
                  field: "message",
                  description: "<p>Error message</p>"
                }
              ]
            }
          }
        }
      ]
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("API Documentation Controller Error:", error);

    return res.status(500).json({
      message: "Failed to load API documentation"
    });
  }
};
