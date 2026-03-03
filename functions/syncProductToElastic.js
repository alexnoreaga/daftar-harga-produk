const {defineString} = require("firebase-functions/params");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const {Client} = require("@elastic/elasticsearch");
admin.initializeApp();

const ELASTICSEARCH_URL = defineString("ELASTICSEARCH_URL");
const ELASTICSEARCH_API_KEY = defineString("ELASTICSEARCH_API_KEY");
const ELASTICSEARCH_INDEX = defineString("ELASTICSEARCH_INDEX");

exports.syncProductToElastic =
  onDocumentWritten(
      "products/{productId}",
      async (event) => {
        const esClient = new Client({
          node: ELASTICSEARCH_URL.value(),
          auth: {
            apiKey: ELASTICSEARCH_API_KEY.value(),
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
        const productId = event.params.productId;
        const after = (event.data && event.data.after) ?
            event.data.after :
            null;
        if (!after) {
        // Document deleted
          await esClient.delete({
            index: ELASTICSEARCH_INDEX.value(),
            id: productId,
          });
          return;
        }
        const data = after.data();
        const hargaModal = (
            data.costPrice !== undefined && data.costPrice !== null
        ) ? data.costPrice : 0;
        const srp = (
            data.srpPrice !== undefined && data.srpPrice !== null
        ) ? data.srpPrice : 0;
        const profit = srp - hargaModal;
        const percentage = hargaModal !== 0 ?
            (profit / hargaModal) * 100 :
            0;
        await esClient.index({
          index: ELASTICSEARCH_INDEX.value(),
          id: productId,
          body: {
            name: data.name || "",
            brand: data.brand || "",
            hargaModal,
            srp,
            profit,
            percentage,
          },
          refresh: true,
        });
      },
  );
