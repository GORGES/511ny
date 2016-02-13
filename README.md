# 511NY for Pebble

Project submission for 2016 #HackFrost DevPost hackathon.

## Summary

Our #HackFrost submission is an app for the Pebble smart watch. It pulls realtime weather info, map images, road hazard data, and traffic camera images to your Pebble to help with winter. 

## Developers

The 511NY Pebble app was conceived and developed by:

* Matthew Clark, Ithaca, NY
* Geoffrey Clark, Ithaca, NY (age 14)

We live in Upstate New York, and routinely experience winter challenges. We are a father and son team and this is our first hackathon submission. Most of the programming was done by Matthew (a professional software coder) and Geoffrey was responsible for design feedback and the presentation video.

## Development Allegory

Based on the #HackFrost goals, we explored ideas for how software could help us Upstate New Yorkers during winter. Road conditions came to mind, so we searched online for web services that could be used to identify road hazards.

Our search led us to the website [http://511ny.org](http://511ny.org), which is sponsored by the NY State Department of Transportation, and includes data feeds from NY and several adjacent states. These data feeds are accessible as web services.

We submitted a request for official access to the 511ny.org web services, and within a week received a valid authentication key. This key allowed us to query a list of all current and scheduled traffic hazards, plus retrieve a list of all traffic cameras. 

Other features that were added are local weather conditions and local maps. 

## External Data Sources

Three external data sources are used for the 511NY Pebble app. Free access keys for individual developers are available for each of these services.

1. [511NY.org](https://511ny.org): Developer API used for retrieving a list of road hazards and a list of traffic cameras. Both the hazards and cameras have latitude and longitude information.

2. [OpenWeatherMap.org](http://openweathermap.org): Retrieves local weather information based on a laitude and longitude. Local weather information includes temperature, wind speed and direction, humidity, air pressure, cloud coverage, and a description of the weather.

3. [Google Maps](https://www.google.com/maps): Returns a map image of the roads based on a specific latitude and longitude. Map images may depict closer or farther away roads depending on a specified zoom level.

## Third-party libraries

These third-party JavaScript libraries are used in the 511NY Pebble app for image decoding and encoding. All libraries are available within GitHub repositories.

* [PNG Decoder](https://github.com/arian/pngjs): decodes PNG map images
* [JPEG Decoder](https://github.com/notmasteryet/jpgjs/jpg.js): decodes JPEG-based traffic camera images 
* [PNG Encoder](https://github.com/imaya/CanvasTool.PngEncoder): encodes PNG for transmission of image to Pebble
* [GIF Decoder](https://github.com/deanm/omggif): required to decode GIF-based traffic camera images

## Coding Methods and Algorithms

Important to any project is failing gracefully. Potential problems were anticipated and trapped where possible, giving feedback as to why information is not properly being retrieved or displayed.

The critical piece of local information required to power the 511NY Pebble app is the latitude and longitude of one's location. The smart phone GPS or AGPS unit provides this information.

Both the road hazards and traffic cams are displayed in order from closest to furthest away. The [haversine formula](https://en.wikipedia.org/wiki/Haversine_formula) is used to calculate the distance between the Pebble watch and the road hazard or camera for sorting.

## App Screenshots

The following screenshots were captured using the Pebble emulator tool on a MacBook Pro. The screenshots depicted are for the Pebble Time (rectangular screen and in color), Pebble Time Round (color round display), and Pebble Classic (black-and-white rectangular display).

* Main menu
The main menu ppears when the 511NY Pebble app is launched. Note that neither the traffic camera images nor the map feature are present in the Pebble Classic. The Pebble Classic has less than 24,000 bytes available for both the app code and data, and these two memory-intensive features could not be included.

![Image of Yaktocat](https://octodex.github.com/images/yaktocat.png)


## 511NY for Pebble vis-a-vis #HackFrost Goals

There are three criteria for judging the #HackFrost competition: Community Impact, Execution, and Creativity. 

* Community Impact

The number of people impacted by the 511NY for Pebble is limited by those who have a Pebble watch, a smart phone (either iPhone or Android) and live in or within several hundred miles of New York state. There are several Pebble models, and the cheapest black-and-white model is often on sale for $80 at BestBuy, so the cost is excellent compared with the expensive Apple or Samsung smart watches.

As for the direct impact, we think this app is powerful, effective, and convenient since weather and road hazard information is always on your wrist just a few clicks away.

Useful information such as road conditions is imperative for our modern lifestyles. Having foreknowledge of road closures and poor weather conditions will help keep people safe on our roadways, and save time from being stuck in traffic jams. For example one quick look at a local traffic cam will help guide someone's commute.

* Execution

The original plan was to include just a list of roadside hazards from 511NY. However once this was accomplished we extended our original idea to include traffic cameras, local weather conditions, and a map based on one's location.

The 511NY Pebble app was written for the Pebble Time and Pebble Time Steel models. Extending the app to support all Pebble models (Pebble Classic, Pebble Steel, and Pebble Time Round) was another change to the original specs.

The entire project hinged on gaining access to the 511NY web services for developers, and we appreciate receiving a developer key from the NYDOT-511NY agency.

* Creativity

Wearable software solutions are cutting edge, and our 511NY app is unusual, innovative, and (most of all) useful.


