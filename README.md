# Audiobookshelf Sonos
A standalone server that adds support for listening to an Audiobookshelf library on Sonos speakers. Built on top of the Sonos Music API (SMAPI).

**This is currently for development testing purposes, and is expected to change significantly**

## Features
- Access to all audiobooks in a single Audiobookshelf library
- Sync progress to and from Audiobookshelf

## Missing Features
- Authentication. Currently anyone on the network can access the library made available through this app from within the Sonos app
- Cover Art on the Sonos music player doesn't load
- M4B files have *very* spotty coverage right now (MP3s have full support)
- Individual chapter support

## How it works
When you use the Sonos app, you have the ability to add "music services" (Audible, YouTube Music, Libby, iHeartRadio, etc.). These services have been developed, submitted to Sonos for approval, and made available to all Sonos users on behalf of the companies that own them. Each company (developer) is responsible for hosting the actual service itself.

The services are built on top of the ["Sonos Music API"](https://developer.sonos.com/reference/sonos-music-api/) (aka SMAPI), which is a [SOAP API](https://stoplight.io/api-types/soap-api). The service functions as a middleware for the Sonos device to reach out to, and in response get information on the items available, metadata, stream URIs, etc.

For development puropses, Sonos allows you to manually configure a local service, called a "Custom Service", which is what this application uses. This is done through the Custom Service Descriptor page, that is hosted on each Sonos device. This is how this application works -- it is configured as a Custom Service on a local device and made available to all users on the network.
## How to use
There are a few moving pieces to this. You'll need to follow each of these to get things up and running.

### Prerequisites
- A set of Sonos speakers
    - You'll need the IP address of one of the speakers
- The latest version of the Sonos mobile app
- Audiobookshelf running and accesssible
- A domain/URI configured to point at this server (with a valid HTTPS certificate)
    - At least for any modern version of Android, non-HTTPS requests signed by a cert in the CA-chain android already has fails. I have a reverse proxy set up to point to my `SOAP_URI` on `HTTP_PORT` for this with a cert configured on it.
### Step 1: Configuring a Custom Service Descriptor (CSD)
1. Browse to `http://<SONOS_SPEAKER_IP>:1400/customsd.htm`
2. Input the following information:
    - Service Name: audiobookshelf
    - Endpoint URL: `http://<the_url_you_defined_for_this_server_above>/wsdl`
    - Secure Endpoint URL: `https://<the_url_you_defined_for_this_server_above>/wsdl`
    - Polling interval: 10
    - Authentication SOAP header policy: Anonymous
    - Manifest
        - Version: 1.0
        - URI: `https:<the_url_you_defined_for_this_server_above>/manifest`
    - Support manifest file: check this box
3. Submit (sometimes this randomly fails, and you need to go back and try again). You should see "Success" if it worked.
4. Add the new service to the Sonos mobile app
    - Settings -> Services + Voice -> Search for your new service -> "Add to Sonos" -> "Set up audiobookshelf
5. `audiobookshelf` should now be listed as a service in the "Browse" tab

### Step 2: Setting up your Audiobookshelf Sonos Server
1. Clone / download and enter the directory containing this repo
    - `git clone git@github.com:jmt-gh/audiobookshelf-sonos.git && cd audiobookshelf-sonos`
2. Edit `config.js` to match your necessary settings. A few minor things to note:
    - `SOAP_ENDPOINT`: This is the `/wsdl` part of the `Endpoint URL` and `Secure Endpoint URL` defined in the CSD earlier
    - `SOAP_URI`: This is the URL part of the `Endpoint URL` and `Secure Endpoint URL` defined in the CSD earlier -- the URL where this server will be acessible from

```
module.exports = Object.freeze({
   HTTP_PORT: , // what port to for express to listen on. Where your SOAP && HTTP requests should end up
   SOAP_ENDPOINT: '/wsdl', // what endpoint sonos will reach out to. Defined in the custom service descriptor
   SONOS_WSDL_FILE: fs.readFileSync('sonos.wsdl', 'utf8'),
   SOAP_URI: '', // https://yoursoap.url.com
   ABS_URI: '', // http://your.url.com
   ABS_LIBRARY_ID: '', // lib_*****
   ABS_TOKEN: '' // ABS -> settings -> users -> select user -> API TOKEN
})
```
3. Update the `sonos.wsdl` file (line 2062) with your SOAP_URI
```
    <wsdl:service name="Sonos">
        <wsdl:port name="SonosSoap" binding="tns:SonosSoap">
		<soap:address location=""/> <!-- Update with SOAP_URI -->
        </wsdl:port>
    </wsdl:service>
```
### Step 3: Start the server and enjoy
1. `node soap-server.js`
2. Open the Sonos mobile app and select audiobookshelf
3. Select a book to listen to
4. If there is already progress on the book, it should start from where Audiobookshelf left off
    - Otherwise it will start from the beginning