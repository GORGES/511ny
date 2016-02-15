# 511NY for Pebble

Project submission for 2016 #HackFrost DevPost hackathon.

![511NY Pebble app](https://raw.githubusercontent.com/GORGES/511ny/master/images/511ny-screenshots.gif)


## Summary

Our #HackFrost submission is an app for the Pebble smart watch. It pulls realtime weather info, map images, road hazard data, and traffic camera images to your Pebble to help with winter. 

## Developers

The 511NY Pebble app was conceived and developed by:

* Matthew Clark, Ithaca, NY, mclark@gorges.us
* Geoffrey Clark, Ithaca, NY (age 14)

We live in Upstate New York, and routinely experience winter challenges. We are a father and son team and this is our first hackathon submission. Most of the programming was done by Matthew (a professional software coder) and Geoffrey was responsible for design feedback and the presentation video.

## Development Timeline

Based on the #HackFrost goals, we explored ideas for how software could help us Upstate New Yorkers during winter. Road conditions came to mind, so we searched online for web services that could be used to identify road hazards.

Our search led us to the website [http://511ny.org](http://511ny.org), which is sponsored by the NY State Department of Transportation, and includes data feeds from NY and several adjacent states. These data feeds are accessible as web services.

We submitted a request for official access to the 511ny.org web services, and within a week received a valid authentication key. This key allowed us to query a list of all current and scheduled traffic hazards, plus retrieve a list of all traffic cameras. 

Other features that were added are local weather conditions and local maps.

## External Data Sources

Three external data sources are used for the 511NY Pebble app. Free access keys for individual developers are available for each of these services.

1. [511NY.org](https://511ny.org): Developer API used for retrieving a list of road hazards and a list of traffic cameras. Both the hazards and cameras have latitude and longitude information.

2. [OpenWeatherMap.org](http://openweathermap.org): Retrieves local weather information based on a laitude and longitude. Local weather information includes temperature, wind speed and direction, humidity, air pressure, cloud coverage, and a description of the weather.

3. [Google Maps](https://www.google.com/maps): Returns a map image of the roads based on a specific latitude and longitude. Map images may depict closer or farther away roads depending on a specified zoom level.

To recompile and install the 511NY for Pebble app, obtain these three free developer keys and place them into the appropriate statements in the file src/js/pebble-js-app.js.

## Third-party libraries

These third-party JavaScript libraries are used in the 511NY Pebble app for image decoding and encoding. All libraries are available within GitHub repositories.

* [PNG Decoder](https://github.com/arian/pngjs): decodes PNG map images
* [JPEG Decoder](https://github.com/notmasteryet/jpgjs/jpg.js): decodes JPEG-based traffic camera images 
* [GIF Decoder](https://github.com/deanm/omggif): required to decode GIF-based traffic camera images
* [PNG Encoder](https://github.com/imaya/CanvasTool.PngEncoder): encodes PNG for transmission of image to Pebble

## Coding Methods and Algorithms

Important to any project is failing gracefully. Potential problems were anticipated and trapped where possible, giving feedback as to why information is not properly being retrieved or displayed.

The critical piece of local information required to power the 511NY Pebble app is the latitude and longitude of one's location. The smart phone GPS or AGPS unit provides this information.

Both the road hazards and traffic cams are displayed in order from closest to furthest away. The [haversine formula](https://en.wikipedia.org/wiki/Haversine_formula) is used to calculate the distance between the Pebble watch and the road hazard or camera for sorting.

## App Screenshots

The following screenshots were captured using the Pebble emulator tool on a MacBook Pro. The screenshots depicted are for the Pebble Time (rectangular screen and in color), Pebble Time Round (color round display), and Pebble Classic (black-and-white rectangular display).

* Main menu
The main menu appears when the 511NY Pebble app is launched. Note that neither the traffic camera images nor the map feature are present in the Pebble Classic. The Pebble Classic has less than 24,000 bytes available for both the code and data, and these two memory-intensive features could not be included.

The current time is displayed in the top of the screen in either 12-hour or 24-hour format, depending on the Pebble setting.

![Main menu - Weather](https://raw.githubusercontent.com/GORGES/511ny/master/images/menu-weather.png)

![Main menu - Road Hazards](https://raw.githubusercontent.com/GORGES/511ny/master/images/menu-hazards.png)

![Main menu - Cameras](https://raw.githubusercontent.com/GORGES/511ny/master/images/menu-cameras.png)

![Main menu - Map](https://raw.githubusercontent.com/GORGES/511ny/master/images/menu-map.png)

![Main menu - Reload](https://raw.githubusercontent.com/GORGES/511ny/master/images/menu-reload.png)

![Main menu - Settings](https://raw.githubusercontent.com/GORGES/511ny/master/images/menu-settings.png)

![Main menu - About](https://raw.githubusercontent.com/GORGES/511ny/master/images/menu-about.png)

* Weather

Weather information is retrieved from OpenWeatherMap and is based on the latitude and longitude if the Pebble location. Information is presented in imperial units. In the main menu, the temperature and a short description are displayed, along with an icon representing the current conditions.

![Weather top](https://raw.githubusercontent.com/GORGES/511ny/master/images/weather-top.png)

![Weather bottom](https://raw.githubusercontent.com/GORGES/511ny/master/images/weather-bottom.png)

If automatic refresh is selected in the Settings screen, then the weather is automatically updated every 15 minutes or when the Reload menu item is manually selected.

While viewing the weather information the UP and DOWN buttons on the Pebble watch are used for scrolling. Pressing the SELECT (middle) button will update the weather conditions. As with all Pebble screens, pressing the BACK (left) button will return to the previous screen.

* Road Hazards

The Road Hazards button displays a list of up to 20 of the closest road hazards based on the Pebble location. This list is sorted by distance, and an icon indicating the hazard type is displayed along with a roadway and distance away.

![Hazard List](https://raw.githubusercontent.com/GORGES/511ny/master/images/hazard-list.png)

![Hazard List 2](https://raw.githubusercontent.com/GORGES/511ny/master/images/hazard-list-2.png)

If a hazard is selected, more detailed information is displayed, including the roadway name, direction of travel, and a longer description.

![Hazard top](https://raw.githubusercontent.com/GORGES/511ny/master/images/hazard-top.png)

![Hazard bottom](https://raw.githubusercontent.com/GORGES/511ny/master/images/hazard-bottom.png)

* Cameras

The names of the twenty closest traffic cameras are displayed in a list. Clicking on a camera name will then display the actual traffic camera image.

![Camera 1](https://raw.githubusercontent.com/GORGES/511ny/master/images/camera-0.png)

![Camera 2](https://raw.githubusercontent.com/GORGES/511ny/master/images/camera-1.png)

![Camera 3](https://raw.githubusercontent.com/GORGES/511ny/master/images/camera-2.png)

While looking at a traffic camera image, the TOP button will display the location of the camera, the BOTTOM button will display the distance to the traffic camera, and the SELECT (middle) button will refresh the camera image.

If automatic refresh is selected in the Settings screen, then the image refreshes once a minute.

The camera images are only available on the Pebble watches with color displays due to memory limitations.

* Map

Selecting the Map will display a map image from the Google Maps service. Press the UP and DOWN buttons to zoom in and out. 

![Map 1](https://raw.githubusercontent.com/GORGES/511ny/master/images/map-1.png)

![Map 2](https://raw.githubusercontent.com/GORGES/511ny/master/images/map-2.png)

![Map 3](https://raw.githubusercontent.com/GORGES/511ny/master/images/map-3.png)

![Map 4](https://raw.githubusercontent.com/GORGES/511ny/master/images/map-4.png)

![Map 5](https://raw.githubusercontent.com/GORGES/511ny/master/images/map-5.png)

![Map 6](https://raw.githubusercontent.com/GORGES/511ny/master/images/map-6.png)

![Map 7](https://raw.githubusercontent.com/GORGES/511ny/master/images/map-7.png)

![Map 8](https://raw.githubusercontent.com/GORGES/511ny/master/images/map-8.png)

As with the camera images, the map image is only available on Pebble color watches.

* Reload

If Reload is chosen from the main menu, then a new request to the GPS is triggered followed by a request to update the list of road hazards and traffic cameras. The menu items will show updated distances if the location has changed.

* Settings

There are two custom settings. To change these settings, use the UP and DOWN buttons to navigate in the menu and then press the SELECT (middle) button to change them.

The size of the text in the weather and road hazard screens can be set to small, medium, or large.

If automatic refresh is enabled, then the weather pages are updated every 15 minutes and the camera and map images are updated every minute.

![Size Setting](https://raw.githubusercontent.com/GORGES/511ny/master/images/setting-size.png)

![Refresh Setting](https://raw.githubusercontent.com/GORGES/511ny/master/images/setting-refresh.png)

* About

The final menu setting displays information about the 511NY Pebble app.

![About](https://raw.githubusercontent.com/GORGES/511ny/master/images/about.png)

## Demonstration Video

Here is a demonstration of the 511NY Pebble app on a Pebble Time watch:

[![511NY for Pebble](https://raw.githubusercontent.com/GORGES/511ny/master/images/video.png)](https://youtu.be/RybO-trxNzQ "511NY for Pebble")

## Installing on a Pebble

The binary code is available in the repository at build/511ny.pbw. There are several methods for installing this code onto a Pebble watch:

* Install the Pebble SDK, compile the code, and type "pebble install --phone IP_ADDRESS_OF_MY_PHONE"

* Use the [CloudPebble online tool](https://cloudpebble.net) to install the compiled code.

* Navigate to [https://github.com/GORGES/511ny/raw/master/build/511ny.pbw](https://github.com/GORGES/511ny/raw/master/build/511ny.pbw) in your iOS or Android web browser, and follow the screen instructions to load the app onto your Pebble.

## 511NY for Pebble vis-a-vis #HackFrost Goals

There are three criteria for judging the #HackFrost competition: Community Impact, Execution, and Creativity. 

* Community Impact

The number of people impacted by the 511NY for Pebble is limited by those who have a Pebble watch, a smart phone (either iPhone or Android) and live in or within several hundred miles of New York state. There are several Pebble models, and the cheapest black-and-white model is often on sale for $80 at BestBuy, so the cost is excellent compared with the expensive Apple or Samsung smart watches.

As for the direct impact, we think this app is powerful, effective, and convenient since weather and road hazard information is always on your wrist just a few clicks away.

Useful information such as road conditions is imperative for our modern lifestyles. Having foreknowledge of road closures and poor weather conditions will help keep people safe on our roadways, and save time from being stuck in traffic jams. For example one quick look at a local traffic cam can guide someone's winter commute.

* Execution

The original plan was to include just a list of roadside hazards from 511NY. However once this was accomplished we extended our original idea to include traffic cameras, local weather conditions, and a map based on one's location.

The 511NY Pebble app was written for the Pebble Time and Pebble Time Steel models. Extending the app to support all Pebble models (Pebble Classic, Pebble Steel, and Pebble Time Round) was another change to the original specs.

The entire project hinged on gaining access to the 511NY web services for developers, and we appreciate receiving a developer key from the NYDOT-511NY agency.

* Creativity

Wearable software solutions are cutting edge, and our 511NY app is unusual, innovative, and (most of all) useful.

