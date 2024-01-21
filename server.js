const soap = require("soap");
const { updateAudioBookshelfProgress } = require("./utils");
const express = require("express");
const config = require("./config");
const logger = require('./logger');

/* CONFIG */
const EXPRESS_APP = express();
const SONOS_SOAP_SERVICE = require("./sonos-service");
const HTTP_PORT = config.HTTP_PORT;
const SOAP_URI = config.SOAP_URI;
const SOAP_ENDPOINT = config.SOAP_ENDPOINT;
const SONOS_WSDL_FILE = config.SONOS_WSDL_FILE;

/**********/

EXPRESS_APP.use(express.json()); // express.json allows for native body parsing
EXPRESS_APP.use((req, res, next) => {
  logger.debug(`Received request: ${req.method} ${req.url}`);
  next();
});


EXPRESS_APP.listen(HTTP_PORT, function () {
  /* 
    SOAP server
    The Sonos Music API (SMAPI) uses SOAP rather than REST. All requests go to the /wsdl endpoint, where SOAP does SOAP magic
    and handles the different routes via the service (sonosService) defined in sonos-service.js
    
    SMAPI documentation: https://developer.sonos.com/reference/sonos-music-api/
  */
  var soaper = soap.listen(
    EXPRESS_APP,
    SOAP_ENDPOINT,
    SONOS_SOAP_SERVICE,
    SONOS_WSDL_FILE,
    function () {
      logger.info('Server Initialized...');
    }
  );

  // Even though this is set to DEBUG, it's still super noisy. Uncomment if needed, but most likely it won't be.
  //soaper.log = function (type, data) {
  //  logger.debug(data)
  //};

  /*
    Sonos Cloud Queue Routes
    "Cloud Queue" is a misnomer here. These routes are only used for handling "reporting" (audiobook progress updates). These endpoints exist outside
    of the SMAPI / SOAP implementation above.

    POST /timePlayed documentation: https://developer.sonos.com/reference/cloud-queue-api/post-timeplayed/
    Reporting documentation: https://developer.sonos.com/build/content-service-add-features/add-reporting/
  */
  EXPRESS_APP.get("/manifest", (req, res) => {
    logger.info("/manifest endpoint hit")
    res.send({
      schemaVersion: "1.0",
      endpoints: [
        {
          type: "reporting",
          uri: `${SOAP_URI}/playback/v2.1/report`,
        },
      ],
    });
  });

  EXPRESS_APP.post(`${SOAP_ENDPOINT}/playback/v2.1/report`, (req, res) => {
    logger.info(`${SOAP_ENDPOINT}/playback/v2.1/report endpoint hit`)
  });

  EXPRESS_APP.post(`${SOAP_ENDPOINT}/playback/v2.1/report/timePlayed`, (req, res) => {
    logger.info(`${SOAP_ENDPOINT}/playback/v2.1/report/timePlayed endpoint hit`);

    let sonosProgressUpdate = req.body.items[0];
    logger.debug(`${SOAP_ENDPOINT}/playback/v2.1/report/timePlayed - sonosProgressUpdate`, sonosProgressUpdate)
    let progressUpdateForABS = {
      libraryItemId: sonosProgressUpdate.containerId,
      libraryItemIdAndFileName: sonosProgressUpdate.objectId,
      positionMillis: sonosProgressUpdate.positionMillis,
    };

    updateAudioBookshelfProgress(progressUpdateForABS);

    /*
      1. Only send back a 200 if we are returning data

      2. By default (I think per session?), sonos will only send up progress reports every 60 seconds. This response to each subsequent
      progress report will ensure it reports every 10 seconds.

      3. According to their documentation, this entire object needs to be returned, but everything except reports is ignored, so we send
      empty for everything besides reports, which is all we care about anyway.

      4. 10 seconds is the lowest update interval it supports.

      Documentation: https://developer.sonos.com/reference/cloud-queue-api/post-timeplayed/
    */
    res.status(200).send({
      contextVersion: "",
      queueVersion: "",
      container: {},
      playbackPolicies: {},
      reports: {
        periodicIntervalMillis: 10000, // 10 seconds is the lowest it supports
      },
    });
  });
});
