const fs = require('fs')

module.exports = Object.freeze({
   HTTP_PORT: 0000, // what port to for express to listen on. Where your SOAP && HTTP requests should end up
   SOAP_ENDPOINT: '/wsdl', // what endpoint sonos will reach out to. Defined in the custom service descriptor
   SONOS_WSDL_FILE: fs.readFileSync('sonos.wsdl', 'utf8'),
   SOAP_URI: '', // https://yoursoap.url.com
   ABS_URI: '', // http://your.url.com
   ABS_LIBRARY_ID: '', // lib_*****
   ABS_TOKEN: '' // ABS -> settings -> users -> select user -> API TOKEN
})
