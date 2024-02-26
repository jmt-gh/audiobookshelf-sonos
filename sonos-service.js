const { getMetadataResult, getMediaURI } = require("./utils");
const logger = require("./logger");

var sonosService = {
  Sonos: {
    SonosSoap: {
      getMetadata: async function (args) {
        logger.debug("getMetadata sonos-service called with args", args)
        let type = args["id"]; // "root" or abs library item id "li_laksjdfklasdj"
        let index = args["index"]; // sonos page size is max 100 items, so it expectes them to be paginated. index is the start position
        let count = args["count"];


        switch (type) {
          case "root": // first request after selecting "audiobookshelf" in the app. Returns the list of books in the library
            const res = await getMetadataResult(type, index, count);
            return res;
          default: // request after selecting a specific book
            return getMetadataResult(type); // this needs to be the same method due to SOAP doing SOAP things for the XML with the function name
        }
      },
      getMediaMetadata: function (args) {
        logger.debug("getMediaMetadata sonos-service called with args", args)
      },
      // get the actual URI of the audiobook / audiobook track we want to play
      getMediaURI: function (args) {
        logger.debug("getMediaURI sonos-service called with args", args)
        return getMediaURI(args["id"]);
      },
      getLastUpdate: function (args) {
        // accompanies most calls to see if sonos needs to update it's content
        return {
          getLastUpdateResult: {
            catalog: `${Date.now()}`, // just force update every single time :D
            autoRefreshEnabled: true,
            favorites: `${Date.now()}`,
            pollInterval: 10,
          },
        };
      },
    },
  },
};

module.exports = sonosService;
