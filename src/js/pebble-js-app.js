//  file: pebble-js-app.js
//  Copyright (C)2016 Matthew Clark
//  created for DevPost #HackFrost

//  variables

var kBlocks = 8, kPacketSize = 2000;
var b_events_and_cameras, b_location, events, cameras, latitude, longitude;
var kAuthenticated = 1, kNotAuthenticated = 2, kLocated = 3, kVenue = 4, kNoLocations = 5, kPayCode = 6, kQRCode = 7, kOpenTab = 8, kError = 9;
var kDataNone = 0, kDataWeather = 1, kDataLocation = 2, kDataMap = 3, kDataEvents = 4, kDataEvent = 5, kDataCameras = 6, kDataImage = 7, kDataError = 8;
var kActionInit = 1, kActionReload = 2, kActionEvent = 3, kActionImage = 4, kActionMap = 5, kActionZoom = 6, kActionWeather = 7;
var kEventTypes = [ 'unknown', 'accidentsAndIncidents', 'roadwork', 'specialEvents', 'closures',
                    'transitMode', 'generalInfo', 'winterDrivingIndex', 'restrictionClass' ];
var kDegToRad = 0.01745329252, kEarthRadiusInMiles = 3959;
var latitude, longitude, action, subaction;

//  distance

function distance(lat, lng) {
  var latitude_arc = (lat - latitude) * kDegToRad;
  var longitude_arc = (lng - longitude) * kDegToRad;
  var latitude_haversine = Math.sin(latitude_arc / 2);
  latitude_haversine = latitude_haversine * latitude_haversine;
  var longitude_haversine = Math.sin(longitude_arc / 2);
  longitude_haversine = longitude_haversine * longitude_haversine;
  var tmp = Math.cos(latitude * kDegToRad) * Math.cos(lat * kDegToRad);
  return kEarthRadiusInMiles * 2 * Math.asin(Math.sqrt(latitude_haversine + tmp * longitude_haversine));
}

//  weather

function send_weather() {
  var request_weather = new XMLHttpRequest();
  request_weather.open('GET', 'http://api.openweathermap.org/data/2.5/weather?lat=' + latitude + '&lon=' + longitude + '&mode=json&appid=OPEN_WEATHER_MAP_ID', true);
  request_weather.onload = function(evt) {
    if ((request_weather.readyState == 4) && (request_weather.status == 200)) {
      if ((typeof(request_weather.responseText) != 'undefined') && (request_weather.responseText.length > 0)) {
        try {
          json = JSON.parse(request_weather.responseText);
          if ((typeof(json.main) != 'undefined') && (typeof(json.main.temp) != 'undefined')) {
            //  create data array (with type and freshness)
            var bytes = [kDataWeather];
            //  update time
            push.push4(bytes, Math.floor(Date.now() / (60 * 1000)));
            //  temperature
            push.push2(bytes, 10 * json.main.temp);
            //  weather icon
            var owm_id = {
              '01d':1, '01n':2, '02d':3, '02n':4, '03d':5, '03n':5,
              '04d':6, '04n':6, '09d':7, '09n':7, '10d':8, '10n':9,
              '11d':10, '11n':10, '13d':11, '13n':11, '50d':12, '50n':12
            };
            push.push1(bytes, (typeof(owm_id[json.weather[0].icon]) != 'undefined') ? owm_id[json.weather[0].icon] : 0);
            //  humidity
            push.push1(bytes, json.main.humidity);
            //  pressure
            push.push2(bytes, 10 * json.main.pressure);
            //  wind
            push.push1(bytes, 10 * json.wind.speed);   //  units=mps
            push.push1(bytes, Math.round((16 * json.wind.deg) / 360.0) % 16);
            //  sunrise, sunset
            push.push4(bytes, json.sys.sunrise ? json.sys.sunrise / 60 : 0);
            push.push4(bytes, json.sys.sunset ? json.sys.sunset / 60 : 0);
            //  description
            push.pushstr(bytes, unescape(encodeURIComponent(json.weather[0].description)));
            //  city
            push.pushstr(bytes, unescape(encodeURIComponent(json.name)));
            //  send to Pebble
            message.queue({'data':bytes});
          } else
            message.string(kError, 'no weather');
        } catch (err) {
          message.string(kError, 'empty weather');
        }
      } else
        message.string(kError, 'invalid weather');
    } else
      message.string(kError, 'bad data');
  };
  request_weather.send(null);
}

//  events

function send_events() {
  //  create list of offsets and distances
  var sorts = [];
  for (var i in events) {
    //  skip EventType=restrictionClass
    if (events[i].EventType != 'restrictionClass') {
      var dist = distance(events[i].Latitude, events[i].Longitude);
      //  store distance if close enough
      if (dist <= 250)
        sorts.push([i, dist]);
    }
  }
  //  sort by distance
  sorts.sort(function(a, b) {
    return a[1] - b[1];
  });
  //  send top events
  bytes = [kDataEvents];
  for (var i = 0;  i < Math.min(sorts.length, 20);  i++) {
    //  get event
    var event = events[sorts[i][0]];
    //  id
    push.pushstr(bytes, event.ID);
    //  event type
    push.push1(bytes, Math.max(0, kEventTypes.indexOf(event.EventType)));
    //  roadway
    push.pushstr(bytes, event.RoadwayName.substr(0, 32));
    //  description
    if (typeof(event.Description) == 'string')
      push.pushstr(bytes, event.Description.substr(0, 32));
    else
      push.push1(bytes, 0);
    //  distance
    push.push2(bytes, 10 * sorts[i][1]);
    //  check max
    if (bytes.length >= kPacketSize - 100)
      break;
  }
  //  send to Pebble
  message.queue({'data':bytes});
}

//  cameras

function send_cameras() {
  //  create list of offsets and distances
  var sorts = [];
  for (var i in cameras) {
    var dist = distance(cameras[i].Latitude, cameras[i].Longitude);
    //  store distance if close
    if (dist <= 250)
      sorts.push([i, dist]);
  }
  //  sort by distance
  sorts.sort(function(a, b) {
    return a[1] - b[1];
  });
  // send top cameras
  bytes = [kDataCameras];
  for (var i = 0;  i < Math.min(sorts.length, 20);  i++) {
    //  get camera
    var camera = cameras[sorts[i][0]];
    //  id
    push.pushstr(bytes, camera.ID);
    //  roadway and name
    push.pushstr(bytes, camera.RoadwayName.substr(0, 32 - 1));
    push.pushstr(bytes, camera.Name.substr(0, 32 - 1));
    //  distance
    push.push2(bytes, 10 * sorts[i][1]);
    //  check max
    if (bytes.length >= kPacketSize - 100)
      break;
  }
  // send to Pebble
  message.queue({'data':bytes});
}

//  send image

function diffuse_color(pixels, x, y, c, error_diffusion, width, height) {
  if ((x >= 0) && (x < width) && (y >= 0) && (y < height)) {
    var val = pixels[3 * (y * width + x) + c] + error_diffusion;
    pixels[3 * (y * width + x) + c] = (val >= 0) ? ((val <= 255) ? val : 255) : 0;
  }
}
function request_image(url_image, type) {
  var request_url = new XMLHttpRequest();
  var watch = platform.get();
  var width_target = (watch == 'chalk') ? 176 : 144,
      height_target = (watch == 'chalk') ? 176 : 168; 
  request_url.open('GET', url_image, true);
  request_url.responseType = 'arraybuffer';
  request_url.onload = function() {
    if ((request_url.readyState == 4) && (request_url.status == 200)) {
      //  decode to pixels
      var data = new Uint8Array(request_url.response || request_url.mozResponseArrayBuffer);
      var width = 0, height = 0, pixels_orig = null;
      var is_png = (data[1] == 'P'.charCodeAt(0)) && (data[2] == 'N'.charCodeAt(0)) && (data[3] == 'G'.charCodeAt(0)),
          is_gif = (data[0] == 'G'.charCodeAt(0)) && (data[1] == 'I'.charCodeAt(0)) && (data[2] == 'F'.charCodeAt(0));
      if (is_gif) {
        var gif = new GifReader(data);
        if (gif.width && gif.height) {
          width = gif.width;
          height = gif.height;
          pixels_orig = new Uint8Array(4 * width * height);
          gif.decodeAndBlitFrameRGBA(0, pixels);
        }
      } else if (is_png) {
        var pngReader = new PNGReader(data);
        pngReader.parse(function(err, png) {
          if (typeof(err) == 'undefined') {
            width = png.width;
            height = png.height;
            if (width && height) {
              pixels_orig = new Uint8Array(4 * width * height);
              var offset = 0;
              for (var y = 0;  y < height;  y++)
                for (var x = 0;  x < width;  x++) {
                  p = png.getPixel(x, y);
                  pixels_orig[offset++] = p[0];
                  pixels_orig[offset++] = p[1];
                  pixels_orig[offset++] = p[2];
                  pixels_orig[offset++] = 255;
                }
            }
          }
        });
      } else {
        try {
          var ji = new JpegImage();
          ji.parse(data);
          width = ji.width;
          height = ji.height;
          var jpg_color = {'width':width,
                           'height':height,
                           'data':new Uint8Array(4 * width * height)};
          ji.copyToImageData(jpg_color);
          pixels_orig = jpg_color.data;
        } catch (err) {
          console.log(err);
        }
      }
      if (pixels_orig !== null) {
        var pixels_resize;
        if ((width != width_target) || (height != height_target)) {
          //  crop
          var width_crop, height_crop;
          if (height_target * width < width_target * height) {
            width_crop = width;
            height_crop = Math.round((width * height_target) / width_target);
          } else {
            height_crop = height;
            width_crop = Math.round((height * width_target) / height_target);
          }
          var pixels_cropped = new Uint8Array(3 * width_crop * height_crop);
          var x_offset = 0, y_offset = 0, x, y, c;
          if (height_target * width < width_target * height)
            y_offset = Math.round((height - height_crop) / 2);
          else
            x_offset = Math.round((width - width_crop) / 2);
          offset = 0;
          for (y = 0;  y < height_crop;  y++)
            for (x = 0;  x < width_crop;  x++) {
              var src_offset = 4 * ((y_offset + y) * width + (x_offset + x));
              pixels_cropped[offset] = pixels_orig[src_offset];
              pixels_cropped[offset + 1] = pixels_orig[src_offset + 1];
              pixels_cropped[offset + 2] = pixels_orig[src_offset + 2];
              offset += 3;
            }
          //  resize
          pixels_resize = new Uint8Array(3 * width_target * height_target);
          for (y = 0;  y < height_target;  y++)
            for (x = 0;  x < width_target;  x++) {
              var y_float = (y * height_crop) / height_target,
                  x_float = (x * width_crop) / width_target;
              var y_min = Math.floor(y_float),
                  x_min = Math.floor(x_float);
              var y_ratio = y_float - y_min,
                  x_ratio = x_float - x_min;
              for (c = 0;  c < 3;  c++)
                pixels_resize[3 * (y * width_target + x) + c] =
                  Math.round((1 - y_ratio) * (1 - x_ratio) * pixels_cropped[3 * (y_min * width_crop + x_min) + c] +
                             (1 - y_ratio) * x_ratio * pixels_cropped[3 * (y_min * width_crop + (x_min + 1)) + c] +
                             y_ratio * (1 - x_ratio) * pixels_cropped[3 * ((y_min + 1) * width_crop + x_min) + c] +
                             y_ratio * x_ratio * pixels_cropped[3 * ((y_min + 1) * width_crop + (x_min + 1)) + c]); 
            }
          width = width_target;
          height = height_target;
        } else {
          pixels_resize = new Uint8Array(3 * width_target * height_target);
          for (y = 0;  y < height;  y++)
            for (x = 0;  x < width;  x++)
              for (c = 0;  c < 3;  c++)
                pixels_resize[3 * (y * width + x) + c] = pixels_orig[4 * (y * width + x) + c];
        }
        //  dither image (see https://gist.github.com/lordastley/1342627)
        var pixels_dither = new Uint8Array(3 * width * height); 
        var old, pix, quant_error, error_diffusion;
        for (y = 0;  y < height;  y++)
          for (x = 0;  x < width;  x++)
            for (c = 0;  c < 3;  c++) {
              old = pixels_resize[3 * (y * width + x) + c];
              pix = (old >= 128) ? ((old >= 213) ? 255 : 170) : ((old >= 43) ? 85 : 0);
              //  set pixel value
              pixels_dither[3 * (y * width + x) + c] = pix;
              //  diffuse error
              if (type == kDataImage) {
                quant_error = old - pix;
                error_diffusion = Math.round((1 / 8) * quant_error);    //  dither uses 1 value for applied error diffusion
                //  dither the array
                diffuse_color(pixels_resize, x + 1, y, c, error_diffusion, width, height);
                diffuse_color(pixels_resize, x + 2, y, c, error_diffusion, width, height);
                diffuse_color(pixels_resize, x - 1, y + 1, c, error_diffusion, width, height);
                diffuse_color(pixels_resize, x, y + 1, c, error_diffusion, width, height);
                diffuse_color(pixels_resize, x + 1, y + 1, c, error_diffusion, width, height);
                diffuse_color(pixels_resize, x, y + 2, c, error_diffusion, width, height);
              }
            }
        //  send to Pebble
        var pixels_png = new Uint8Array(4 * width * height / kBlocks);
        //  loop through blocks
        for (var block = 0;  block < kBlocks;  block++) {
          //  copy pixels; add alpha value
          var src = block * 3 * height * width / kBlocks,
              dest = 0;
          for (y = 0;  y < height / kBlocks;  y++)
            for (x = 0;  x < width;  x++) {
              for (c = 0;  c++ < 3;  )
                pixels_png[dest++] = pixels_dither[src++];
              pixels_png[dest++] = 0xFF;    //  alpha
            }
          // 8-bit PNG
          var png8 = new CanvasTool.PngEncoder(
              pixels_png,
              { 'width' : width,
                'height' : height / kBlocks,
                'bitDepth' : 8,
                'colourType' : CanvasTool.PngEncoder.ColourType.INDEXED_COLOR
              }).convert();
          if (png8.length && (png8.length < kPacketSize - 2)) {
            var bytes_color = [type, block];
            //  copy values
            for (x = 0;  x < png8.length;  x++)
              bytes_color.push(png8.charCodeAt(x));
            //  send packet
            message.queue({'data':bytes_color});
          }
        }
      }
    }
  };
  request_url.send(null);
}

//  map

function request_map(lat, lng, zoom) {
  var watch = platform.get();
  var url_map = 'http://maps.googleapis.com/maps/api/staticmap?center=' + lat + ',' + lng + '&zoom=' + zoom + '&size=' + ((watch == 'chalk') ? '176x176' : '144x168') + '&style=gamma:0.25&apikey=GOOGLE_API_KEY';
  request_image(url_map, kDataMap);
}

//  geolocation

function geolocation_success(pos) {
  //  old location
  var latitude_old = latitude,
      longitude_old = longitude;
  //  remember location
  var coordinates = pos.coords;
  latitude = parseFloat(coordinates.latitude);
  longitude = parseFloat(coordinates.longitude);
  //  send to Pebble
  var bytes = [kDataLocation];
  push.pushstr(bytes, Math.abs(latitude).toFixed(3) + ((latitude >= 0) ? 'N' : 'S') +
                      ((Math.abs(longitude) < 100) ? '  ' : ' ') +
                      Math.abs(longitude).toFixed(3) + ((longitude >= 0) ? 'E' : 'W')); 
  message.queue({'data':bytes});
  //  trigger weather, events, camera
  if (action != kActionMap) {
    send_weather();
    send_events();
    send_cameras();
  } else if ((latitude != latitude_old) || (longitude != longitude_old))
    request_map(latitude, longitude, subaction);
  //  persistence
  localStorage.setItem('latitude', latitude);
  localStorage.setItem('longitude', longitude);
}

//  event handlers

Pebble.addEventListener('ready', function(arg) {
  //  set variables
  b_events_and_cameras = b_location = false;
  events = cameras = [];
  latitude = longitude = null;
});
Pebble.addEventListener('appmessage', function(arg) {
  //  load events
  if (!b_events_and_cameras) {
    //  set flag
    b_events_and_cameras = true;
    //  load events
    var events_local = localStorage.getItem('events');
    if ((typeof(events_local) == 'string') && (events_local.length > 0)) {
      try {
        events = JSON.parse(events_local);
      } catch (err) {
        console.log(err);
      }
    }
    //  load cameras
    var cameras_local = localStorage.getItem('cameras');
    if ((typeof(cameras_local) == 'string') && (cameras_local.length > 0)) {
      try {
        cameras = JSON.parse(cameras_local);
      } catch (err) {
        console.log(err);
      }
    }
    //  load latitude & longitude
    var latitude_local = localStorage.getItem('latitude');
    if ((typeof(latitude_local) == 'string') && (latitude_local.length > 0))
      latitude = parseFloat(latitude_local) + (Math.random() / 100000000);
    var longitude_local = localStorage.getItem('longitude');
    if ((typeof(longitude_local) == 'string') && (longitude_local.length > 0))
      longitude = parseFloat(longitude_local) + (Math.random() / 100000000);
    //  send cached evemts * cameras
    if (events.length || cameras.length) {
      send_events();
      send_cameras();
    }
  }
  //  action & subaction (both global variables)
  action = Math.floor(arg.payload.action / 100);
  subaction = (arg.payload.action % 100);
  //  load events if not loaded
  if (!events.length || (action == kActionReload)) {
    //  make initial request
    var request_events = new XMLHttpRequest();
    request_events.open('GET', 'https://511ny.org/api/getevents?key=511NY_API_KEY&format=json', true);
    request_events.setRequestHeader('Content-Type', 'application/json');
    request_events.onload = function(e) {
      if (request_events.readyState == 4) {
        if ((request_events.status == 200) || (request_events.status == 201)) {
          //  events retrieved
          try {
            //  parse into object
            events = JSON.parse(request_events.responseText);
            //  store locally
            localStorage.setItem('events', JSON.stringify(events));
            //  send to Pebble
            if (action == kActionReload)
              send_events();
          } catch (err) {
          }
        } else
          message.string(kError, 'unknown error "' + request_events.status + '"');
      }
    };
    request_events.send(null);
  }
  //  load cameras if not loaded
  if (!cameras.length || (action == kActionReload)) {
    //  make initial request
    var request_cameras = new XMLHttpRequest();
    request_cameras.open('GET', 'https://511ny.org/api/getcameras?key=511NY_API_KEY&format=json', true);
    request_cameras.setRequestHeader('Content-Type', 'application/json');
    request_cameras.onload = function(e) {
      if (request_cameras.readyState == 4) {
        if ((request_cameras.status == 200) || (request_cameras.status == 201)) {
          //  cameras retrieved
          try {
            //  parse into object
            cameras = JSON.parse(request_cameras.responseText);
            //  store locally
            localStorage.setItem('cameras', JSON.stringify(cameras));
            //  send to Pebble
            if (action == kActionReload)
              send_cameras();
          } catch (err) {
          }
        } else
          message.string(kError, 'unknown error "' + request_cameras.status + '"');
      }
    };
    request_cameras.send(null);
  }
  //  location and/or map
  if (!b_location || (action == kActionMap)) {
    //  set flag (even if no location)
    b_location = true;
    //  trigger GPS search
    var position_options = {maximumAge:60000, timeout:15000, enableHighAccuracy:true};
    window.navigator.geolocation.getCurrentPosition(
      geolocation_success,
      function(err) {
        position_options = {enableHighAccuracy:false};
        window.navigator.geolocation.getCurrentPosition(
          geolocation_success,
          function(err) {
            message.string(kError, 'location unavailable');
            //geolocation_success({'coords':{'latitude':42.4433, 'longitude':-76.5}});
          },
          position_options);
      },
      position_options);
  }
  //  zoom (which means map without updating location)
  if ((action == kActionZoom) && (latitude || longitude))
    request_map(latitude, longitude, subaction);
  else if (action == kActionEvent) {
    if (typeof(arg.payload.id) != 'undefined') {
      for (var i in events) {
        var event = events[i];
        if (event.ID == arg.payload.id) {
          //  roadway name and location
          var description = event.RoadwayName + '\n';
          if ((event.DirectionOfTravel != 'None') && (event.DirectionOfTravel != 'Unknown'))
            description += event.DirectionOfTravel + '\n';
          if (event.Location.length && (event.Location != 'None'))
            description += event.Location + '\n';
          //  long descriptino
          description += '\n' + event.Description;
          //  add trailing line
          description += '\n ';
          /*{"LastUpdated":"25/03/2015 13:00:15",
          "Latitude":43.145879,"Longitude":-75.093819,
          "PlannedEndDate":"","Reported":"01/01/0001 00:00:00","StartDate":"",
          "ID":"NYSDOT-CVO-2204860",
          "RegionName":"Central Syracuse Utica Area",
          "CountyName":"Herkimer","Severity":"Unknown",
          "RoadwayName":"I-SPA",
          "DirectionOfTravel":"None",
          "Description":"Bridge Closed",
          "Location":"at Sterling Crk",
          "LanesAffected":"No Data","LanesStatus":null,"LcsEntries":null,
          "NavteqLinkId":null,"PrimaryLocation":null,"SecondaryLocation":null,
          "FirstArticleCity":null,"SecondCity":null,
          "EventType":"restrictionClass",
          "EventSubType":"overweight","MapEncodedPolyline":null}*/
          //  display description
          var bytes = [kDataEvent];
          for (var i = 0; i < description.length; i++)
            push.push1(bytes, description.charCodeAt(i));
          //  send to Pebble
          message.queue({'data':bytes});
          //Pebble.showSimpleNotificationOnPebble(event.RoadwayName, description);
          break;
        }
      }
    }
  } else if (action == kActionImage) {
    if (typeof(arg.payload.id) != 'undefined') {
      for (var i in cameras) {
        var camera = cameras[i];
        if (camera.ID == arg.payload.id) {
          //  load image
          request_image(camera.Url, kDataImage);
          break;
        }
      }
    }
  } else if ((action == kActionWeather) && (latitude || longitude))
    send_weather();
});

//  platform

var platform = {
  
  get:function() {
    var result = 'aplite';
    if (typeof(Pebble.getActiveWatchInfo) != 'undefined') {
      var watch = Pebble.getActiveWatchInfo();
      if (typeof(watch.platform) != 'undefined')
        result = watch.platform;
    }
    return result;
  }
};

//  push

var push = {

  push1 : function(bytes, val) {
    bytes.push(Math.round(val));
  },

  push2 : function(bytes, val) {
    val = Math.round(val);
    bytes.push(Math.floor(val >> 8));
    bytes.push(val & 0xff);
  },

  push4 : function(bytes, val) {
    if ((typeof (val) == 'undefined') || isNaN(val))
      val = 0;
    val = Math.round(val);
    bytes.push((val >> 24) & 0xff);
    bytes.push((val >> 16) & 0xff);
    bytes.push((val >> 8) & 0xff);
    bytes.push(val & 0xff);
  },

  pushstr : function(bytes, val) {
    if (typeof (val) != 'string')
      val = '';
    bytes.push(val.length);
    for (var i = 0; i < val.length; i++)
      bytes.push(val.charCodeAt(i));
  }
};

//  message

var message = {

  // variables

  messages : [],
  communicating : false,
  last_communication : null,

  // methods

  init : function() {
    message.messages = [];
    message.communicating = false;
    message.last_communication = null;
  },

  process : function() {
    // check message queue
    if (message.messages.length > 0) {
      var now = new Date();
      // set communication time
      if (!message.last_communication)
        message.last_communication = now;
      // check if communication is busy - limit to 15 seconds
      if (message.communicating
          && (now.getTime() > message.last_communication.getTime() + 15000))
        message.communicating = false;
      // check communicating flag
      if (!message.communicating) {
        // set communicating flag
        message.communicating = true;
        message.last_communication = now;
        // get message to send
        var msg = message.messages[0];
        // remove from queue
        message.messages.shift();
        // send message
        Pebble.sendAppMessage(msg, function(e) { // success
          // clear communicating flag
          message.communicating = false;
          // check for another message
          message.process();
        }, function(e) { // failure
          // clear communicating flag
          message.communicating = false;
          // insert message to front of message queue
          message.messages.splice(0, null, msg);
          // send again
          message.process();
        });
      }
    }
  },

  queue : function(msg) {
    // add message to queue
    message.messages.push(JSON.parse(JSON.stringify(msg)));
    // check queue
    message.process();
  },

  string : function(type, str) {
    // convert string to byte array
    var bytes = [];
    bytes.push(type);
    for (var i = 0; i < str.length; i++)
      bytes.push(str.charCodeAt(i));
    // send error message
    message.queue({
      'data' : bytes
    });
  }
};



// https://github.com/arian/pngjs

(function(modules) {
var cache = {}, require = function(id) {
  var module = cache[id];
  if (!module) {
      module = cache[id] = {};
      var exports = module.exports = {};
      modules[id].call(exports, require, module, exports, window);
  }
  return module.exports;
};
window["PNGReader"] = require("0");
})({
"0": function(require, module, exports, global) {
  "use strict";
  var PNG = require("1");
  var isNode = typeof process !== "undefined" && !process.browser;
  var inflate = function() {
      if (isNode) {
          var zlib = null;
          return function(data, callback) {
              return zlib.inflate(new Buffer(data), callback);
          };
      } else {
          var stream = require("2");
          return function(data, callback) {
              data = new stream.FlateStream(new stream.Stream(data));
              callback(null, data.getBytes());
          };
      }
  }();
  var ByteBuffer = isNode ? Buffer : function() {
      if (typeof ArrayBuffer == "function") {
          return function(length) {
              return new Uint8Array(new ArrayBuffer(length));
          };
      } else {
          return function(length) {
              return new Array(length);
          };
      }
  }();
  var slice = Array.prototype.slice;
  var toString = Object.prototype.toString;
  function equalBytes(a, b) {
      if (a.length != b.length) return false;
      for (var l = a.length; l--; ) if (a[l] != b[l]) return false;
      return true;
  }
  function readUInt32(buffer, offset) {
      return (buffer[offset] << 24) + (buffer[offset + 1] << 16) + (buffer[offset + 2] << 8) + (buffer[offset + 3] << 0);
  }
  function readUInt16(buffer, offset) {
      return (buffer[offset + 1] << 8) + (buffer[offset] << 0);
  }
  function readUInt8(buffer, offset) {
      return buffer[offset] << 0;
  }
  function bufferToString(buffer) {
      var str = "";
      for (var i = 0; i < buffer.length; i++) {
          str += String.fromCharCode(buffer[i]);
      }
      return str;
  }
  var PNGReader = function(bytes) {
      if (typeof bytes == "string") {
          var bts = bytes;
          bytes = new Array(bts.length);
          for (var i = 0, l = bts.length; i < l; i++) {
              bytes[i] = bts[i].charCodeAt(0);
          }
      } else {
          var type = toString.call(bytes).slice(8, -1);
          if (type == "ArrayBuffer") bytes = new Uint8Array(bytes);
      }
      this.i = 0;
      this.bytes = bytes;
      this.png = new PNG;
      this.dataChunks = [];
  };
  PNGReader.prototype.readBytes = function(length) {
      var end = this.i + length;
      if (end > this.bytes.length) {
          throw new Error("Unexpectedly reached end of file");
      }
      var bytes = slice.call(this.bytes, this.i, end);
      this.i = end;
      return bytes;
  };
  PNGReader.prototype.decodeHeader = function() {
      if (this.i !== 0) {
          throw new Error("file pointer should be at 0 to read the header");
      }
      var header = this.readBytes(8);
      if (!equalBytes(header, [ 137, 80, 78, 71, 13, 10, 26, 10 ])) {
          throw new Error("invalid PNGReader file (bad signature)");
      }
      this.header = header;
  };
  PNGReader.prototype.decodeChunk = function() {
      var length = readUInt32(this.readBytes(4), 0);
      if (length < 0) {
          throw new Error("Bad chunk length " + (4294967295 & length));
      }
      var type = bufferToString(this.readBytes(4));
      var chunk = this.readBytes(length);
      var crc = this.readBytes(4);
      switch (type) {
        case "IHDR":
          this.decodeIHDR(chunk);
          break;
        case "PLTE":
          this.decodePLTE(chunk);
          break;
        case "IDAT":
          this.decodeIDAT(chunk);
          break;
        case "IEND":
          this.decodeIEND(chunk);
          break;
      }
      return type;
  };
  PNGReader.prototype.decodeIHDR = function(chunk) {
      var png = this.png;
      png.setWidth(readUInt32(chunk, 0));
      png.setHeight(readUInt32(chunk, 4));
      png.setBitDepth(readUInt8(chunk, 8));
      png.setColorType(readUInt8(chunk, 9));
      png.setCompressionMethod(readUInt8(chunk, 10));
      png.setFilterMethod(readUInt8(chunk, 11));
      png.setInterlaceMethod(readUInt8(chunk, 12));
  };
  PNGReader.prototype.decodePLTE = function(chunk) {
      this.png.setPalette(chunk);
  };
  PNGReader.prototype.decodeIDAT = function(chunk) {
      this.dataChunks.push(chunk);
  };
  PNGReader.prototype.decodeIEND = function() {};
  PNGReader.prototype.decodePixels = function(callback) {
      var png = this.png;
      var reader = this;
      var length = 0;
      var i, j, k, l;
      for (l = this.dataChunks.length; l--; ) length += this.dataChunks[l].length;
      var data = new ByteBuffer(length);
      for (i = 0, k = 0, l = this.dataChunks.length; i < l; i++) {
          var chunk = this.dataChunks[i];
          for (j = 0; j < chunk.length; j++) data[k++] = chunk[j];
      }
      inflate(data, function(err, data) {
          if (err) return callback(err);
          try {
              if (png.getInterlaceMethod() === 0) {
                  reader.interlaceNone(data);
              } else {
                  reader.interlaceAdam7(data);
              }
          } catch (e) {
              return callback(e);
          }
          callback();
      });
  };
  PNGReader.prototype.interlaceNone = function(data) {
      var png = this.png;
      var bpp = Math.max(1, png.colors * png.bitDepth / 8);
      var cpr = bpp * png.width;
      var pixels = new ByteBuffer(bpp * png.width * png.height);
      var scanline;
      var offset = 0;
      for (var i = 0; i < data.length; i += cpr + 1) {
          scanline = slice.call(data, i + 1, i + cpr + 1);
          switch (readUInt8(data, i)) {
            case 0:
              this.unFilterNone(scanline, pixels, bpp, offset, cpr);
              break;
            case 1:
              this.unFilterSub(scanline, pixels, bpp, offset, cpr);
              break;
            case 2:
              this.unFilterUp(scanline, pixels, bpp, offset, cpr);
              break;
            case 3:
              this.unFilterAverage(scanline, pixels, bpp, offset, cpr);
              break;
            case 4:
              this.unFilterPaeth(scanline, pixels, bpp, offset, cpr);
              break;
            default:
              throw new Error("unkown filtered scanline");
          }
          offset += cpr;
      }
      png.pixels = pixels;
  };
  PNGReader.prototype.interlaceAdam7 = function(data) {
      throw new Error("Adam7 interlacing is not implemented yet");
  };
  PNGReader.prototype.unFilterNone = function(scanline, pixels, bpp, of, length) {
      for (var i = 0, to = length; i < to; i++) {
          pixels[of + i] = scanline[i];
      }
  };
  PNGReader.prototype.unFilterSub = function(scanline, pixels, bpp, of, length) {
      var i = 0;
      for (; i < bpp; i++) pixels[of + i] = scanline[i];
      for (; i < length; i++) {
          pixels[of + i] = scanline[i] + pixels[of + i - bpp] & 255;
      }
  };
  PNGReader.prototype.unFilterUp = function(scanline, pixels, bpp, of, length) {
      var i = 0, byte, prev;
      if (of - length < 0) for (; i < length; i++) {
          pixels[of + i] = scanline[i];
      } else for (; i < length; i++) {
          byte = scanline[i];
          prev = pixels[of + i - length];
          pixels[of + i] = byte + prev & 255;
      }
  };
  PNGReader.prototype.unFilterAverage = function(scanline, pixels, bpp, of, length) {
      var i = 0, byte, prev, prior;
      if (of - length < 0) {
          for (; i < bpp; i++) {
              pixels[of + i] = scanline[i];
          }
          for (; i < length; i++) {
              pixels[of + i] = scanline[i] + (pixels[of + i - bpp] >> 1) & 255;
          }
      } else {
          for (; i < bpp; i++) {
              pixels[of + i] = scanline[i] + (pixels[of - length + i] >> 1) & 255;
          }
          for (; i < length; i++) {
              byte = scanline[i];
              prev = pixels[of + i - bpp];
              prior = pixels[of + i - length];
              pixels[of + i] = byte + (prev + prior >> 1) & 255;
          }
      }
  };
  PNGReader.prototype.unFilterPaeth = function(scanline, pixels, bpp, of, length) {
      var i = 0, raw, a, b, c, p, pa, pb, pc, pr;
      if (of - length < 0) {
          for (; i < bpp; i++) {
              pixels[of + i] = scanline[i];
          }
          for (; i < length; i++) {
              pixels[of + i] = scanline[i] + pixels[of + i - bpp] & 255;
          }
      } else {
          for (; i < bpp; i++) {
              pixels[of + i] = scanline[i] + pixels[of + i - length] & 255;
          }
          for (; i < length; i++) {
              raw = scanline[i];
              a = pixels[of + i - bpp];
              b = pixels[of + i - length];
              c = pixels[of + i - length - bpp];
              p = a + b - c;
              pa = Math.abs(p - a);
              pb = Math.abs(p - b);
              pc = Math.abs(p - c);
              if (pa <= pb && pa <= pc) pr = a; else if (pb <= pc) pr = b; else pr = c;
              pixels[of + i] = raw + pr & 255;
          }
      }
  };
  PNGReader.prototype.parse = function(options, callback) {
      if (typeof options == "function") callback = options;
      if (typeof options != "object") options = {};
      try {
          this.decodeHeader();
          while (this.i < this.bytes.length) {
              var type = this.decodeChunk();
              if (type == "IHDR" && options.data === false || type == "IEND") break;
          }
          var png = this.png;
          this.decodePixels(function(err) {
              callback(err, png);
          });
      } catch (e) {
          callback(e);
      }
  };
  module.exports = PNGReader;
},
"1": function(require, module, exports, global) {
  "use strict";
  var PNG = function() {
      this.width = 0;
      this.height = 0;
      this.bitDepth = 0;
      this.colorType = 0;
      this.compressionMethod = 0;
      this.filterMethod = 0;
      this.interlaceMethod = 0;
      this.colors = 0;
      this.alpha = false;
      this.pixelBits = 0;
      this.palette = null;
      this.pixels = null;
  };
  PNG.prototype.getWidth = function() {
      return this.width;
  };
  PNG.prototype.setWidth = function(width) {
      this.width = width;
  };
  PNG.prototype.getHeight = function() {
      return this.height;
  };
  PNG.prototype.setHeight = function(height) {
      this.height = height;
  };
  PNG.prototype.getBitDepth = function() {
      return this.bitDepth;
  };
  PNG.prototype.setBitDepth = function(bitDepth) {
      if ([ 1, 2, 4, 8, 16 ].indexOf(bitDepth) === -1) {
          throw new Error("invalid bit depth " + bitDepth);
      }
      this.bitDepth = bitDepth;
  };
  PNG.prototype.getColorType = function() {
      return this.colorType;
  };
  PNG.prototype.setColorType = function(colorType) {
      var colors = 0, alpha = false;
      switch (colorType) {
        case 0:
          colors = 1;
          break;
        case 2:
          colors = 3;
          break;
        case 3:
          colors = 1;
          break;
        case 4:
          colors = 2;
          alpha = true;
          break;
        case 6:
          colors = 4;
          alpha = true;
          break;
        default:
          throw new Error("invalid color type");
      }
      this.colors = colors;
      this.alpha = alpha;
      this.colorType = colorType;
  };
  PNG.prototype.getCompressionMethod = function() {
      return this.compressionMethod;
  };
  PNG.prototype.setCompressionMethod = function(compressionMethod) {
      if (compressionMethod !== 0) {
          throw new Error("invalid compression method " + compressionMethod);
      }
      this.compressionMethod = compressionMethod;
  };
  PNG.prototype.getFilterMethod = function() {
      return this.filterMethod;
  };
  PNG.prototype.setFilterMethod = function(filterMethod) {
      if (filterMethod !== 0) {
          throw new Error("invalid filter method " + filterMethod);
      }
      this.filterMethod = filterMethod;
  };
  PNG.prototype.getInterlaceMethod = function() {
      return this.interlaceMethod;
  };
  PNG.prototype.setInterlaceMethod = function(interlaceMethod) {
      if (interlaceMethod !== 0 && interlaceMethod !== 1) {
          throw new Error("invalid interlace method " + interlaceMethod);
      }
      this.interlaceMethod = interlaceMethod;
  };
  PNG.prototype.setPalette = function(palette) {
      if (palette.length % 3 !== 0) {
          throw new Error("incorrect PLTE chunk length");
      }
      if (palette.length > Math.pow(2, this.bitDepth) * 3) {
          throw new Error("palette has more colors than 2^bitdepth");
      }
      this.palette = palette;
  };
  PNG.prototype.getPalette = function() {
      return this.palette;
  };
  PNG.prototype.getPixel = function(x, y) {
      if (!this.pixels) throw new Error("pixel data is empty");
      if (x >= this.width || y >= this.height) {
          throw new Error("x,y position out of bound");
      }
      var i = this.colors * this.bitDepth / 8 * (y * this.width + x);
      var pixels = this.pixels;
      switch (this.colorType) {
        case 0:
          return [ pixels[i], pixels[i], pixels[i], 255 ];
        case 2:
          return [ pixels[i], pixels[i + 1], pixels[i + 2], 255 ];
        case 3:
          return [ this.palette[pixels[i] * 3 + 0], this.palette[pixels[i] * 3 + 1], this.palette[pixels[i] * 3 + 2], 255 ];
        case 4:
          return [ pixels[i], pixels[i], pixels[i], pixels[i + 1] ];
        case 6:
          return [ pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3] ];
      }
  };
  module.exports = PNG;
},
"2": function(require, module, exports, global) {
  "use strict";
  var Stream = function StreamClosure() {
      function Stream(arrayBuffer, start, length, dict) {
          this.bytes = new Uint8Array(arrayBuffer);
          this.start = start || 0;
          this.pos = this.start;
          this.end = start + length || this.bytes.length;
          this.dict = dict;
      }
      Stream.prototype = {
          get length() {
              return this.end - this.start;
          },
          getByte: function Stream_getByte() {
              if (this.pos >= this.end) return null;
              return this.bytes[this.pos++];
          },
          getBytes: function Stream_getBytes(length) {
              var bytes = this.bytes;
              var pos = this.pos;
              var strEnd = this.end;
              if (!length) return bytes.subarray(pos, strEnd);
              var end = pos + length;
              if (end > strEnd) end = strEnd;
              this.pos = end;
              return bytes.subarray(pos, end);
          },
          lookChar: function Stream_lookChar() {
              if (this.pos >= this.end) return null;
              return String.fromCharCode(this.bytes[this.pos]);
          },
          getChar: function Stream_getChar() {
              if (this.pos >= this.end) return null;
              return String.fromCharCode(this.bytes[this.pos++]);
          },
          skip: function Stream_skip(n) {
              if (!n) n = 1;
              this.pos += n;
          },
          reset: function Stream_reset() {
              this.pos = this.start;
          },
          moveStart: function Stream_moveStart() {
              this.start = this.pos;
          },
          makeSubStream: function Stream_makeSubStream(start, length, dict) {
              return new Stream(this.bytes.buffer, start, length, dict);
          },
          isStream: true
      };
      return Stream;
  }();
  var DecodeStream = function DecodeStreamClosure() {
      function DecodeStream() {
          this.pos = 0;
          this.bufferLength = 0;
          this.eof = false;
          this.buffer = null;
      }
      DecodeStream.prototype = {
          ensureBuffer: function DecodeStream_ensureBuffer(requested) {
              var buffer = this.buffer;
              var current = buffer ? buffer.byteLength : 0;
              if (requested < current) return buffer;
              var size = 512;
              while (size < requested) size <<= 1;
              var buffer2 = new Uint8Array(size);
              for (var i = 0; i < current; ++i) buffer2[i] = buffer[i];
              return this.buffer = buffer2;
          },
          getByte: function DecodeStream_getByte() {
              var pos = this.pos;
              while (this.bufferLength <= pos) {
                  if (this.eof) return null;
                  this.readBlock();
              }
              return this.buffer[this.pos++];
          },
          getBytes: function DecodeStream_getBytes(length) {
              var end, pos = this.pos;
              if (length) {
                  this.ensureBuffer(pos + length);
                  end = pos + length;
                  while (!this.eof && this.bufferLength < end) this.readBlock();
                  var bufEnd = this.bufferLength;
                  if (end > bufEnd) end = bufEnd;
              } else {
                  while (!this.eof) this.readBlock();
                  end = this.bufferLength;
                  if (!end) this.buffer = new Uint8Array(0);
              }
              this.pos = end;
              return this.buffer.subarray(pos, end);
          },
          lookChar: function DecodeStream_lookChar() {
              var pos = this.pos;
              while (this.bufferLength <= pos) {
                  if (this.eof) return null;
                  this.readBlock();
              }
              return String.fromCharCode(this.buffer[this.pos]);
          },
          getChar: function DecodeStream_getChar() {
              var pos = this.pos;
              while (this.bufferLength <= pos) {
                  if (this.eof) return null;
                  this.readBlock();
              }
              return String.fromCharCode(this.buffer[this.pos++]);
          },
          makeSubStream: function DecodeStream_makeSubStream(start, length, dict) {
              var end = start + length;
              while (this.bufferLength <= end && !this.eof) this.readBlock();
              return new Stream(this.buffer, start, length, dict);
          },
          skip: function DecodeStream_skip(n) {
              if (!n) n = 1;
              this.pos += n;
          },
          reset: function DecodeStream_reset() {
              this.pos = 0;
          }
      };
      return DecodeStream;
  }();
  var FlateStream = function FlateStreamClosure() {
      var codeLenCodeMap = new Uint32Array([ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ]);
      var lengthDecode = new Uint32Array([ 3, 4, 5, 6, 7, 8, 9, 10, 65547, 65549, 65551, 65553, 131091, 131095, 131099, 131103, 196643, 196651, 196659, 196667, 262211, 262227, 262243, 262259, 327811, 327843, 327875, 327907, 258, 258, 258 ]);
      var distDecode = new Uint32Array([ 1, 2, 3, 4, 65541, 65543, 131081, 131085, 196625, 196633, 262177, 262193, 327745, 327777, 393345, 393409, 459009, 459137, 524801, 525057, 590849, 591361, 657409, 658433, 724993, 727041, 794625, 798721, 868353, 876545 ]);
      var fixedLitCodeTab = [ new Uint32Array([ 459008, 524368, 524304, 524568, 459024, 524400, 524336, 590016, 459016, 524384, 524320, 589984, 524288, 524416, 524352, 590048, 459012, 524376, 524312, 589968, 459028, 524408, 524344, 590032, 459020, 524392, 524328, 59e4, 524296, 524424, 524360, 590064, 459010, 524372, 524308, 524572, 459026, 524404, 524340, 590024, 459018, 524388, 524324, 589992, 524292, 524420, 524356, 590056, 459014, 524380, 524316, 589976, 459030, 524412, 524348, 590040, 459022, 524396, 524332, 590008, 524300, 524428, 524364, 590072, 459009, 524370, 524306, 524570, 459025, 524402, 524338, 590020, 459017, 524386, 524322, 589988, 524290, 524418, 524354, 590052, 459013, 524378, 524314, 589972, 459029, 524410, 524346, 590036, 459021, 524394, 524330, 590004, 524298, 524426, 524362, 590068, 459011, 524374, 524310, 524574, 459027, 524406, 524342, 590028, 459019, 524390, 524326, 589996, 524294, 524422, 524358, 590060, 459015, 524382, 524318, 589980, 459031, 524414, 524350, 590044, 459023, 524398, 524334, 590012, 524302, 524430, 524366, 590076, 459008, 524369, 524305, 524569, 459024, 524401, 524337, 590018, 459016, 524385, 524321, 589986, 524289, 524417, 524353, 590050, 459012, 524377, 524313, 589970, 459028, 524409, 524345, 590034, 459020, 524393, 524329, 590002, 524297, 524425, 524361, 590066, 459010, 524373, 524309, 524573, 459026, 524405, 524341, 590026, 459018, 524389, 524325, 589994, 524293, 524421, 524357, 590058, 459014, 524381, 524317, 589978, 459030, 524413, 524349, 590042, 459022, 524397, 524333, 590010, 524301, 524429, 524365, 590074, 459009, 524371, 524307, 524571, 459025, 524403, 524339, 590022, 459017, 524387, 524323, 589990, 524291, 524419, 524355, 590054, 459013, 524379, 524315, 589974, 459029, 524411, 524347, 590038, 459021, 524395, 524331, 590006, 524299, 524427, 524363, 590070, 459011, 524375, 524311, 524575, 459027, 524407, 524343, 590030, 459019, 524391, 524327, 589998, 524295, 524423, 524359, 590062, 459015, 524383, 524319, 589982, 459031, 524415, 524351, 590046, 459023, 524399, 524335, 590014, 524303, 524431, 524367, 590078, 459008, 524368, 524304, 524568, 459024, 524400, 524336, 590017, 459016, 524384, 524320, 589985, 524288, 524416, 524352, 590049, 459012, 524376, 524312, 589969, 459028, 524408, 524344, 590033, 459020, 524392, 524328, 590001, 524296, 524424, 524360, 590065, 459010, 524372, 524308, 524572, 459026, 524404, 524340, 590025, 459018, 524388, 524324, 589993, 524292, 524420, 524356, 590057, 459014, 524380, 524316, 589977, 459030, 524412, 524348, 590041, 459022, 524396, 524332, 590009, 524300, 524428, 524364, 590073, 459009, 524370, 524306, 524570, 459025, 524402, 524338, 590021, 459017, 524386, 524322, 589989, 524290, 524418, 524354, 590053, 459013, 524378, 524314, 589973, 459029, 524410, 524346, 590037, 459021, 524394, 524330, 590005, 524298, 524426, 524362, 590069, 459011, 524374, 524310, 524574, 459027, 524406, 524342, 590029, 459019, 524390, 524326, 589997, 524294, 524422, 524358, 590061, 459015, 524382, 524318, 589981, 459031, 524414, 524350, 590045, 459023, 524398, 524334, 590013, 524302, 524430, 524366, 590077, 459008, 524369, 524305, 524569, 459024, 524401, 524337, 590019, 459016, 524385, 524321, 589987, 524289, 524417, 524353, 590051, 459012, 524377, 524313, 589971, 459028, 524409, 524345, 590035, 459020, 524393, 524329, 590003, 524297, 524425, 524361, 590067, 459010, 524373, 524309, 524573, 459026, 524405, 524341, 590027, 459018, 524389, 524325, 589995, 524293, 524421, 524357, 590059, 459014, 524381, 524317, 589979, 459030, 524413, 524349, 590043, 459022, 524397, 524333, 590011, 524301, 524429, 524365, 590075, 459009, 524371, 524307, 524571, 459025, 524403, 524339, 590023, 459017, 524387, 524323, 589991, 524291, 524419, 524355, 590055, 459013, 524379, 524315, 589975, 459029, 524411, 524347, 590039, 459021, 524395, 524331, 590007, 524299, 524427, 524363, 590071, 459011, 524375, 524311, 524575, 459027, 524407, 524343, 590031, 459019, 524391, 524327, 589999, 524295, 524423, 524359, 590063, 459015, 524383, 524319, 589983, 459031, 524415, 524351, 590047, 459023, 524399, 524335, 590015, 524303, 524431, 524367, 590079 ]), 9 ];
      var fixedDistCodeTab = [ new Uint32Array([ 327680, 327696, 327688, 327704, 327684, 327700, 327692, 327708, 327682, 327698, 327690, 327706, 327686, 327702, 327694, 0, 327681, 327697, 327689, 327705, 327685, 327701, 327693, 327709, 327683, 327699, 327691, 327707, 327687, 327703, 327695, 0 ]), 5 ];
      function FlateStream(stream) {
          var bytes = stream.getBytes();
          var bytesPos = 0;
          this.dict = stream.dict;
          var cmf = bytes[bytesPos++];
          var flg = bytes[bytesPos++];
          if (cmf == -1 || flg == -1) error("Invalid header in flate stream: " + cmf + ", " + flg);
          if ((cmf & 15) != 8) error("Unknown compression method in flate stream: " + cmf + ", " + flg);
          if (((cmf << 8) + flg) % 31 != 0) error("Bad FCHECK in flate stream: " + cmf + ", " + flg);
          if (flg & 32) error("FDICT bit set in flate stream: " + cmf + ", " + flg);
          this.bytes = bytes;
          this.bytesPos = bytesPos;
          this.codeSize = 0;
          this.codeBuf = 0;
          DecodeStream.call(this);
      }
      FlateStream.prototype = Object.create(DecodeStream.prototype);
      FlateStream.prototype.getBits = function FlateStream_getBits(bits) {
          var codeSize = this.codeSize;
          var codeBuf = this.codeBuf;
          var bytes = this.bytes;
          var bytesPos = this.bytesPos;
          var b;
          while (codeSize < bits) {
              if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad encoding in flate stream");
              codeBuf |= b << codeSize;
              codeSize += 8;
          }
          b = codeBuf & (1 << bits) - 1;
          this.codeBuf = codeBuf >> bits;
          this.codeSize = codeSize -= bits;
          this.bytesPos = bytesPos;
          return b;
      };
      FlateStream.prototype.getCode = function FlateStream_getCode(table) {
          var codes = table[0];
          var maxLen = table[1];
          var codeSize = this.codeSize;
          var codeBuf = this.codeBuf;
          var bytes = this.bytes;
          var bytesPos = this.bytesPos;
          while (codeSize < maxLen) {
              var b;
              if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad encoding in flate stream");
              codeBuf |= b << codeSize;
              codeSize += 8;
          }
          var code = codes[codeBuf & (1 << maxLen) - 1];
          var codeLen = code >> 16;
          var codeVal = code & 65535;
          if (codeSize == 0 || codeSize < codeLen || codeLen == 0) error("Bad encoding in flate stream");
          this.codeBuf = codeBuf >> codeLen;
          this.codeSize = codeSize - codeLen;
          this.bytesPos = bytesPos;
          return codeVal;
      };
      FlateStream.prototype.generateHuffmanTable = function flateStreamGenerateHuffmanTable(lengths) {
          var n = lengths.length;
          var maxLen = 0;
          for (var i = 0; i < n; ++i) {
              if (lengths[i] > maxLen) maxLen = lengths[i];
          }
          var size = 1 << maxLen;
          var codes = new Uint32Array(size);
          for (var len = 1, code = 0, skip = 2; len <= maxLen; ++len, code <<= 1, skip <<= 1) {
              for (var val = 0; val < n; ++val) {
                  if (lengths[val] == len) {
                      var code2 = 0;
                      var t = code;
                      for (var i = 0; i < len; ++i) {
                          code2 = code2 << 1 | t & 1;
                          t >>= 1;
                      }
                      for (var i = code2; i < size; i += skip) codes[i] = len << 16 | val;
                      ++code;
                  }
              }
          }
          return [ codes, maxLen ];
      };
      FlateStream.prototype.readBlock = function FlateStream_readBlock() {
          var hdr = this.getBits(3);
          if (hdr & 1) this.eof = true;
          hdr >>= 1;
          if (hdr == 0) {
              var bytes = this.bytes;
              var bytesPos = this.bytesPos;
              var b;
              if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad block header in flate stream");
              var blockLen = b;
              if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad block header in flate stream");
              blockLen |= b << 8;
              if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad block header in flate stream");
              var check = b;
              if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad block header in flate stream");
              check |= b << 8;
              if (check != (~blockLen & 65535)) error("Bad uncompressed block length in flate stream");
              this.codeBuf = 0;
              this.codeSize = 0;
              var bufferLength = this.bufferLength;
              var buffer = this.ensureBuffer(bufferLength + blockLen);
              var end = bufferLength + blockLen;
              this.bufferLength = end;
              for (var n = bufferLength; n < end; ++n) {
                  if (typeof (b = bytes[bytesPos++]) == "undefined") {
                      this.eof = true;
                      break;
                  }
                  buffer[n] = b;
              }
              this.bytesPos = bytesPos;
              return;
          }
          var litCodeTable;
          var distCodeTable;
          if (hdr == 1) {
              litCodeTable = fixedLitCodeTab;
              distCodeTable = fixedDistCodeTab;
          } else if (hdr == 2) {
              var numLitCodes = this.getBits(5) + 257;
              var numDistCodes = this.getBits(5) + 1;
              var numCodeLenCodes = this.getBits(4) + 4;
              var codeLenCodeLengths = new Uint8Array(codeLenCodeMap.length);
              for (var i = 0; i < numCodeLenCodes; ++i) codeLenCodeLengths[codeLenCodeMap[i]] = this.getBits(3);
              var codeLenCodeTab = this.generateHuffmanTable(codeLenCodeLengths);
              var len = 0;
              var i = 0;
              var codes = numLitCodes + numDistCodes;
              var codeLengths = new Uint8Array(codes);
              while (i < codes) {
                  var code = this.getCode(codeLenCodeTab);
                  if (code == 16) {
                      var bitsLength = 2, bitsOffset = 3, what = len;
                  } else if (code == 17) {
                      var bitsLength = 3, bitsOffset = 3, what = len = 0;
                  } else if (code == 18) {
                      var bitsLength = 7, bitsOffset = 11, what = len = 0;
                  } else {
                      codeLengths[i++] = len = code;
                      continue;
                  }
                  var repeatLength = this.getBits(bitsLength) + bitsOffset;
                  while (repeatLength-- > 0) codeLengths[i++] = what;
              }
              litCodeTable = this.generateHuffmanTable(codeLengths.subarray(0, numLitCodes));
              distCodeTable = this.generateHuffmanTable(codeLengths.subarray(numLitCodes, codes));
          } else {
              error("Unknown block type in flate stream");
          }
          var buffer = this.buffer;
          var limit = buffer ? buffer.length : 0;
          var pos = this.bufferLength;
          while (true) {
              var code1 = this.getCode(litCodeTable);
              if (code1 < 256) {
                  if (pos + 1 >= limit) {
                      buffer = this.ensureBuffer(pos + 1);
                      limit = buffer.length;
                  }
                  buffer[pos++] = code1;
                  continue;
              }
              if (code1 == 256) {
                  this.bufferLength = pos;
                  return;
              }
              code1 -= 257;
              code1 = lengthDecode[code1];
              var code2 = code1 >> 16;
              if (code2 > 0) code2 = this.getBits(code2);
              var len = (code1 & 65535) + code2;
              code1 = this.getCode(distCodeTable);
              code1 = distDecode[code1];
              code2 = code1 >> 16;
              if (code2 > 0) code2 = this.getBits(code2);
              var dist = (code1 & 65535) + code2;
              if (pos + len >= limit) {
                  buffer = this.ensureBuffer(pos + len);
                  limit = buffer.length;
              }
              for (var k = 0; k < len; ++k, ++pos) buffer[pos] = buffer[pos - dist];
          }
      };
      return FlateStream;
  }();
  exports.Stream = Stream;
  exports.FlateStream = FlateStream;
}
});



/*
 * -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- / /* vim: set shiftwidth=2 tabstop=2
 * autoindent cindent expandtab:
 */
/*
 * Copyright 2011 notmasteryet
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

// - The JPEG specification can be found in the ITU CCITT Recommendation T.81
// (www.w3.org/Graphics/JPEG/itu-t81.pdf)
// - The JFIF specification can be found in the JPEG File Interchange Format
// (www.w3.org/Graphics/JPEG/jfif3.pdf)
// - The Adobe Application-Specific JPEG markers in the Supporting the DCT
// Filters
// in PostScript Level 2, Technical Note #5116
// (partners.adobe.com/public/developer/en/ps/sdk/5116.DCT_Filter.pdf)

var JpegImage = (function jpegImage() {
  "use strict";
  var dctZigZag = new Int32Array([
     0,
     1,  8,
    16,  9,  2,
     3, 10, 17, 24,
    32, 25, 18, 11, 4,
     5, 12, 19, 26, 33, 40,
    48, 41, 34, 27, 20, 13,  6,
     7, 14, 21, 28, 35, 42, 49, 56,
    57, 50, 43, 36, 29, 22, 15,
    23, 30, 37, 44, 51, 58,
    59, 52, 45, 38, 31,
    39, 46, 53, 60,
    61, 54, 47,
    55, 62,
    63
  ]);

  var dctCos1  =  4017;   // cos(pi/16)
  var dctSin1  =   799;   // sin(pi/16)
  var dctCos3  =  3406;   // cos(3*pi/16)
  var dctSin3  =  2276;   // sin(3*pi/16)
  var dctCos6  =  1567;   // cos(6*pi/16)
  var dctSin6  =  3784;   // sin(6*pi/16)
  var dctSqrt2 =  5793;   // sqrt(2)
  var dctSqrt1d2 = 2896;  // sqrt(2) / 2

  function constructor() {
  }

  function buildHuffmanTable(codeLengths, values) {
    var k = 0, code = [], i, j, length = 16;
    while (length > 0 && !codeLengths[length - 1])
      length--;
    code.push({children: [], index: 0});
    var p = code[0], q;
    for (i = 0; i < length; i++) {
      for (j = 0; j < codeLengths[i]; j++) {
        p = code.pop();
        p.children[p.index] = values[k];
        while (p.index > 0) {
          p = code.pop();
        }
        p.index++;
        code.push(p);
        while (code.length <= i) {
          code.push(q = {children: [], index: 0});
          p.children[p.index] = q.children;
          p = q;
        }
        k++;
      }
      if (i + 1 < length) {
        // p here points to last code
        code.push(q = {children: [], index: 0});
        p.children[p.index] = q.children;
        p = q;
      }
    }
    return code[0].children;
  }

  function decodeScan(data, offset,
                      frame, components, resetInterval,
                      spectralStart, spectralEnd,
                      successivePrev, successive) {
    var precision = frame.precision;
    var samplesPerLine = frame.samplesPerLine;
    var scanLines = frame.scanLines;
    var mcusPerLine = frame.mcusPerLine;
    var progressive = frame.progressive;
    var maxH = frame.maxH, maxV = frame.maxV;

    var startOffset = offset, bitsData = 0, bitsCount = 0;
    function readBit() {
      if (bitsCount > 0) {
        bitsCount--;
        return (bitsData >> bitsCount) & 1;
      }
      bitsData = data[offset++];
      if (bitsData == 0xFF) {
        var nextByte = data[offset++];
        if (nextByte) {
          throw "unexpected marker: " + ((bitsData << 8) | nextByte).toString(16);
        }
        // unstuff 0
      }
      bitsCount = 7;
      return bitsData >>> 7;
    }
    function decodeHuffman(tree) {
      var node = tree, bit;
      while ((bit = readBit()) !== null) {
        node = node[bit];
        if (typeof node === 'number')
          return node;
        if (typeof node !== 'object')
          throw "invalid huffman sequence";
      }
      return null;
    }
    function receive(length) {
      var n = 0;
      while (length > 0) {
        var bit = readBit();
        if (bit === null) return;
        n = (n << 1) | bit;
        length--;
      }
      return n;
    }
    function receiveAndExtend(length) {
      var n = receive(length);
      if (n >= 1 << (length - 1))
        return n;
      return n + (-1 << length) + 1;
    }
    function decodeBaseline(component, zz) {
      var t = decodeHuffman(component.huffmanTableDC);
      var diff = t === 0 ? 0 : receiveAndExtend(t);
      zz[0]= (component.pred += diff);
      var k = 1;
      while (k < 64) {
        var rs = decodeHuffman(component.huffmanTableAC);
        var s = rs & 15, r = rs >> 4;
        if (s === 0) {
          if (r < 15)
            break;
          k += 16;
          continue;
        }
        k += r;
        var z = dctZigZag[k];
        zz[z] = receiveAndExtend(s);
        k++;
      }
    }
    function decodeDCFirst(component, zz) {
      var t = decodeHuffman(component.huffmanTableDC);
      var diff = t === 0 ? 0 : (receiveAndExtend(t) << successive);
      zz[0] = (component.pred += diff);
    }
    function decodeDCSuccessive(component, zz) {
      zz[0] |= readBit() << successive;
    }
    var eobrun = 0;
    function decodeACFirst(component, zz) {
      if (eobrun > 0) {
        eobrun--;
        return;
      }
      var k = spectralStart, e = spectralEnd;
      while (k <= e) {
        var rs = decodeHuffman(component.huffmanTableAC);
        var s = rs & 15, r = rs >> 4;
        if (s === 0) {
          if (r < 15) {
            eobrun = receive(r) + (1 << r) - 1;
            break;
          }
          k += 16;
          continue;
        }
        k += r;
        var z = dctZigZag[k];
        zz[z] = receiveAndExtend(s) * (1 << successive);
        k++;
      }
    }
    var successiveACState = 0, successiveACNextValue;
    function decodeACSuccessive(component, zz) {
      var k = spectralStart, e = spectralEnd, r = 0;
      while (k <= e) {
        var z = dctZigZag[k];
        switch (successiveACState) {
        case 0: // initial state
          var rs = decodeHuffman(component.huffmanTableAC);
          var s = rs & 15, r = rs >> 4;
          if (s === 0) {
            if (r < 15) {
              eobrun = receive(r) + (1 << r);
              successiveACState = 4;
            } else {
              r = 16;
              successiveACState = 1;
            }
          } else {
            if (s !== 1)
              throw "invalid ACn encoding";
            successiveACNextValue = receiveAndExtend(s);
            successiveACState = r ? 2 : 3;
          }
          continue;
        case 1: // skipping r zero items
        case 2:
          if (zz[z])
            zz[z] += (readBit() << successive);
          else {
            r--;
            if (r === 0)
              successiveACState = successiveACState == 2 ? 3 : 0;
          }
          break;
        case 3: // set value for a zero item
          if (zz[z])
            zz[z] += (readBit() << successive);
          else {
            zz[z] = successiveACNextValue << successive;
            successiveACState = 0;
          }
          break;
        case 4: // eob
          if (zz[z])
            zz[z] += (readBit() << successive);
          break;
        }
        k++;
      }
      if (successiveACState === 4) {
        eobrun--;
        if (eobrun === 0)
          successiveACState = 0;
      }
    }
    function decodeMcu(component, decode, mcu, row, col) {
      var mcuRow = (mcu / mcusPerLine) | 0;
      var mcuCol = mcu % mcusPerLine;
      var blockRow = mcuRow * component.v + row;
      var blockCol = mcuCol * component.h + col;
      decode(component, component.blocks[blockRow][blockCol]);
    }
    function decodeBlock(component, decode, mcu) {
      var blockRow = (mcu / component.blocksPerLine) | 0;
      var blockCol = mcu % component.blocksPerLine;
      decode(component, component.blocks[blockRow][blockCol]);
    }

    var componentsLength = components.length;
    var component, i, j, k, n;
    var decodeFn;
    if (progressive) {
      if (spectralStart === 0)
        decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
      else
        decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
    } else {
      decodeFn = decodeBaseline;
    }

    var mcu = 0, marker;
    var mcuExpected;
    if (componentsLength == 1) {
      mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn;
    } else {
      mcuExpected = mcusPerLine * frame.mcusPerColumn;
    }
    if (!resetInterval) resetInterval = mcuExpected;

    var h, v;
    while (mcu < mcuExpected) {
      // reset interval stuff
      for (i = 0; i < componentsLength; i++)
        components[i].pred = 0;
      eobrun = 0;

      if (componentsLength == 1) {
        component = components[0];
        for (n = 0; n < resetInterval; n++) {
          decodeBlock(component, decodeFn, mcu);
          mcu++;
        }
      } else {
        for (n = 0; n < resetInterval; n++) {
          for (i = 0; i < componentsLength; i++) {
            component = components[i];
            h = component.h;
            v = component.v;
            for (j = 0; j < v; j++) {
              for (k = 0; k < h; k++) {
                decodeMcu(component, decodeFn, mcu, j, k);
              }
            }
          }
          mcu++;
        }
      }

      // find marker
      bitsCount = 0;
      marker = (data[offset] << 8) | data[offset + 1];
      if (marker <= 0xFF00) {
        throw "marker was not found";
      }

      if (marker >= 0xFFD0 && marker <= 0xFFD7) { // RSTx
        offset += 2;
      }
      else
        break;
    }

    return offset - startOffset;
  }

  function buildComponentData(frame, component) {
    var lines = [];
    var blocksPerLine = component.blocksPerLine;
    var blocksPerColumn = component.blocksPerColumn;
    var samplesPerLine = blocksPerLine << 3;
    var R = new Int32Array(64), r = new Uint8Array(64);

    // A port of poppler's IDCT method which in turn is taken from:
    // Christoph Loeffler, Adriaan Ligtenberg, George S. Moschytz,
    // "Practical Fast 1-D DCT Algorithms with 11 Multiplications",
    // IEEE Intl. Conf. on Acoustics, Speech & Signal Processing, 1989,
    // 988-991.
    function quantizeAndInverse(zz, dataOut, dataIn) {
      var qt = component.quantizationTable;
      var v0, v1, v2, v3, v4, v5, v6, v7, t;
      var p = dataIn;
      var i;

      // dequant
      for (i = 0; i < 64; i++)
        p[i] = zz[i] * qt[i];

      // inverse DCT on rows
      for (i = 0; i < 8; ++i) {
        var row = 8 * i;

        // check for all-zero AC coefficients
        if (p[1 + row] == 0 && p[2 + row] == 0 && p[3 + row] == 0 &&
            p[4 + row] == 0 && p[5 + row] == 0 && p[6 + row] == 0 &&
            p[7 + row] == 0) {
          t = (dctSqrt2 * p[0 + row] + 512) >> 10;
          p[0 + row] = t;
          p[1 + row] = t;
          p[2 + row] = t;
          p[3 + row] = t;
          p[4 + row] = t;
          p[5 + row] = t;
          p[6 + row] = t;
          p[7 + row] = t;
          continue;
        }

        // stage 4
        v0 = (dctSqrt2 * p[0 + row] + 128) >> 8;
        v1 = (dctSqrt2 * p[4 + row] + 128) >> 8;
        v2 = p[2 + row];
        v3 = p[6 + row];
        v4 = (dctSqrt1d2 * (p[1 + row] - p[7 + row]) + 128) >> 8;
        v7 = (dctSqrt1d2 * (p[1 + row] + p[7 + row]) + 128) >> 8;
        v5 = p[3 + row] << 4;
        v6 = p[5 + row] << 4;

        // stage 3
        t = (v0 - v1+ 1) >> 1;
        v0 = (v0 + v1 + 1) >> 1;
        v1 = t;
        t = (v2 * dctSin6 + v3 * dctCos6 + 128) >> 8;
        v2 = (v2 * dctCos6 - v3 * dctSin6 + 128) >> 8;
        v3 = t;
        t = (v4 - v6 + 1) >> 1;
        v4 = (v4 + v6 + 1) >> 1;
        v6 = t;
        t = (v7 + v5 + 1) >> 1;
        v5 = (v7 - v5 + 1) >> 1;
        v7 = t;

        // stage 2
        t = (v0 - v3 + 1) >> 1;
        v0 = (v0 + v3 + 1) >> 1;
        v3 = t;
        t = (v1 - v2 + 1) >> 1;
        v1 = (v1 + v2 + 1) >> 1;
        v2 = t;
        t = (v4 * dctSin3 + v7 * dctCos3 + 2048) >> 12;
        v4 = (v4 * dctCos3 - v7 * dctSin3 + 2048) >> 12;
        v7 = t;
        t = (v5 * dctSin1 + v6 * dctCos1 + 2048) >> 12;
        v5 = (v5 * dctCos1 - v6 * dctSin1 + 2048) >> 12;
        v6 = t;

        // stage 1
        p[0 + row] = v0 + v7;
        p[7 + row] = v0 - v7;
        p[1 + row] = v1 + v6;
        p[6 + row] = v1 - v6;
        p[2 + row] = v2 + v5;
        p[5 + row] = v2 - v5;
        p[3 + row] = v3 + v4;
        p[4 + row] = v3 - v4;
      }

      // inverse DCT on columns
      for (i = 0; i < 8; ++i) {
        var col = i;

        // check for all-zero AC coefficients
        if (p[1*8 + col] == 0 && p[2*8 + col] == 0 && p[3*8 + col] == 0 &&
            p[4*8 + col] == 0 && p[5*8 + col] == 0 && p[6*8 + col] == 0 &&
            p[7*8 + col] == 0) {
          t = (dctSqrt2 * dataIn[i+0] + 8192) >> 14;
          p[0*8 + col] = t;
          p[1*8 + col] = t;
          p[2*8 + col] = t;
          p[3*8 + col] = t;
          p[4*8 + col] = t;
          p[5*8 + col] = t;
          p[6*8 + col] = t;
          p[7*8 + col] = t;
          continue;
        }

        // stage 4
        v0 = (dctSqrt2 * p[0*8 + col] + 2048) >> 12;
        v1 = (dctSqrt2 * p[4*8 + col] + 2048) >> 12;
        v2 = p[2*8 + col];
        v3 = p[6*8 + col];
        v4 = (dctSqrt1d2 * (p[1*8 + col] - p[7*8 + col]) + 2048) >> 12;
        v7 = (dctSqrt1d2 * (p[1*8 + col] + p[7*8 + col]) + 2048) >> 12;
        v5 = p[3*8 + col];
        v6 = p[5*8 + col];

        // stage 3
        t = (v0 - v1 + 1) >> 1;
        v0 = (v0 + v1 + 1) >> 1;
        v1 = t;
        t = (v2 * dctSin6 + v3 * dctCos6 + 2048) >> 12;
        v2 = (v2 * dctCos6 - v3 * dctSin6 + 2048) >> 12;
        v3 = t;
        t = (v4 - v6 + 1) >> 1;
        v4 = (v4 + v6 + 1) >> 1;
        v6 = t;
        t = (v7 + v5 + 1) >> 1;
        v5 = (v7 - v5 + 1) >> 1;
        v7 = t;

        // stage 2
        t = (v0 - v3 + 1) >> 1;
        v0 = (v0 + v3 + 1) >> 1;
        v3 = t;
        t = (v1 - v2 + 1) >> 1;
        v1 = (v1 + v2 + 1) >> 1;
        v2 = t;
        t = (v4 * dctSin3 + v7 * dctCos3 + 2048) >> 12;
        v4 = (v4 * dctCos3 - v7 * dctSin3 + 2048) >> 12;
        v7 = t;
        t = (v5 * dctSin1 + v6 * dctCos1 + 2048) >> 12;
        v5 = (v5 * dctCos1 - v6 * dctSin1 + 2048) >> 12;
        v6 = t;

        // stage 1
        p[0*8 + col] = v0 + v7;
        p[7*8 + col] = v0 - v7;
        p[1*8 + col] = v1 + v6;
        p[6*8 + col] = v1 - v6;
        p[2*8 + col] = v2 + v5;
        p[5*8 + col] = v2 - v5;
        p[3*8 + col] = v3 + v4;
        p[4*8 + col] = v3 - v4;
      }

      // convert to 8-bit integers
      for (i = 0; i < 64; ++i) {
        var sample = 128 + ((p[i] + 8) >> 4);
        dataOut[i] = sample < 0 ? 0 : sample > 0xFF ? 0xFF : sample;
      }
    }

    var i, j;
    for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
      var scanLine = blockRow << 3;
      for (i = 0; i < 8; i++)
        lines.push(new Uint8Array(samplesPerLine));
      for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) {
        quantizeAndInverse(component.blocks[blockRow][blockCol], r, R);

        var offset = 0, sample = blockCol << 3;
        for (j = 0; j < 8; j++) {
          var line = lines[scanLine + j];
          for (i = 0; i < 8; i++)
            line[sample + i] = r[offset++];
        }
      }
    }
    return lines;
  }

  function clampTo8bit(a) {
    return a < 0 ? 0 : a > 255 ? 255 : a;
  }

  constructor.prototype = {
    load: function load(path) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", path, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = (function() {
        // TODO catch parse error
        var data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
        this.parse(data);
        if (this.onload)
          this.onload();
      }).bind(this);
      xhr.send(null);
    },
    parse: function parse(data) {
      var offset = 0, length = data.length;
      function readUint16() {
        var value = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        return value;
      }
      function readDataBlock() {
        var length = readUint16();
        var array = data.subarray(offset, offset + length - 2);
        offset += array.length;
        return array;
      }
      function prepareComponents(frame) {
        var maxH = 0, maxV = 0;
        var component, componentId;
        for (componentId in frame.components) {
          if (frame.components.hasOwnProperty(componentId)) {
            component = frame.components[componentId];
            if (maxH < component.h) maxH = component.h;
            if (maxV < component.v) maxV = component.v;
          }
        }
        var mcusPerLine = Math.ceil(frame.samplesPerLine / 8 / maxH);
        var mcusPerColumn = Math.ceil(frame.scanLines / 8 / maxV);
        for (componentId in frame.components) {
          if (frame.components.hasOwnProperty(componentId)) {
            component = frame.components[componentId];
            var blocksPerLine = Math.ceil(Math.ceil(frame.samplesPerLine / 8) * component.h / maxH);
            var blocksPerColumn = Math.ceil(Math.ceil(frame.scanLines  / 8) * component.v / maxV);
            var blocksPerLineForMcu = mcusPerLine * component.h;
            var blocksPerColumnForMcu = mcusPerColumn * component.v;
            var blocks = [];
            for (var i = 0; i < blocksPerColumnForMcu; i++) {
              var row = [];
              for (var j = 0; j < blocksPerLineForMcu; j++)
                row.push(new Int32Array(64));
              blocks.push(row);
            }
            component.blocksPerLine = blocksPerLine;
            component.blocksPerColumn = blocksPerColumn;
            component.blocks = blocks;
          }
        }
        frame.maxH = maxH;
        frame.maxV = maxV;
        frame.mcusPerLine = mcusPerLine;
        frame.mcusPerColumn = mcusPerColumn;
      }
      var jfif = null;
      var adobe = null;
      var pixels = null;
      var frame, resetInterval;
      var quantizationTables = [], frames = [];
      var huffmanTablesAC = [], huffmanTablesDC = [];
      var fileMarker = readUint16();
      if (fileMarker != 0xFFD8) { // SOI (Start of Image)
        throw "SOI not found";
      }

      fileMarker = readUint16();
      while (fileMarker != 0xFFD9) { // EOI (End of image)
        var i, j, l;
        switch(fileMarker) {
          case 0xFFE0: // APP0 (Application Specific)
          case 0xFFE1: // APP1
          case 0xFFE2: // APP2
          case 0xFFE3: // APP3
          case 0xFFE4: // APP4
          case 0xFFE5: // APP5
          case 0xFFE6: // APP6
          case 0xFFE7: // APP7
          case 0xFFE8: // APP8
          case 0xFFE9: // APP9
          case 0xFFEA: // APP10
          case 0xFFEB: // APP11
          case 0xFFEC: // APP12
          case 0xFFED: // APP13
          case 0xFFEE: // APP14
          case 0xFFEF: // APP15
          case 0xFFFE: // COM (Comment)
            var appData = readDataBlock();

            if (fileMarker === 0xFFE0) {
              if (appData[0] === 0x4A && appData[1] === 0x46 && appData[2] === 0x49 &&
                appData[3] === 0x46 && appData[4] === 0) { // 'JFIF\x00'
                jfif = {
                  version: { major: appData[5], minor: appData[6] },
                  densityUnits: appData[7],
                  xDensity: (appData[8] << 8) | appData[9],
                  yDensity: (appData[10] << 8) | appData[11],
                  thumbWidth: appData[12],
                  thumbHeight: appData[13],
                  thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
                };
              }
            }
            // TODO APP1 - Exif
            if (fileMarker === 0xFFEE) {
              if (appData[0] === 0x41 && appData[1] === 0x64 && appData[2] === 0x6F &&
                appData[3] === 0x62 && appData[4] === 0x65 && appData[5] === 0) { // 'Adobe\x00'
                adobe = {
                  version: appData[6],
                  flags0: (appData[7] << 8) | appData[8],
                  flags1: (appData[9] << 8) | appData[10],
                  transformCode: appData[11]
                };
              }
            }
            break;

          case 0xFFDB: // DQT (Define Quantization Tables)
            var quantizationTablesLength = readUint16();
            var quantizationTablesEnd = quantizationTablesLength + offset - 2;
            while (offset < quantizationTablesEnd) {
              var quantizationTableSpec = data[offset++];
              var tableData = new Int32Array(64);
              if ((quantizationTableSpec >> 4) === 0) { // 8 bit values
                for (j = 0; j < 64; j++) {
                  var z = dctZigZag[j];
                  tableData[z] = data[offset++];
                }
              } else if ((quantizationTableSpec >> 4) === 1) { // 16 bit
                for (j = 0; j < 64; j++) {
                  var z = dctZigZag[j];
                  tableData[z] = readUint16();
                }
              } else
                throw "DQT: invalid table spec";
              quantizationTables[quantizationTableSpec & 15] = tableData;
            }
            break;

          case 0xFFC0: // SOF0 (Start of Frame, Baseline DCT)
          case 0xFFC1: // SOF1 (Start of Frame, Extended DCT)
          case 0xFFC2: // SOF2 (Start of Frame, Progressive DCT)
            readUint16(); // skip data length
            frame = {};
            frame.extended = (fileMarker === 0xFFC1);
            frame.progressive = (fileMarker === 0xFFC2);
            frame.precision = data[offset++];
            frame.scanLines = readUint16();
            frame.samplesPerLine = readUint16();
            frame.components = {};
            frame.componentsOrder = [];
            var componentsCount = data[offset++], componentId;
            var maxH = 0, maxV = 0;
            for (i = 0; i < componentsCount; i++) {
              componentId = data[offset];
              var h = data[offset + 1] >> 4;
              var v = data[offset + 1] & 15;
              var qId = data[offset + 2];
              frame.componentsOrder.push(componentId);
              frame.components[componentId] = {
                h: h,
                v: v,
                quantizationTable: quantizationTables[qId]
              };
              offset += 3;
            }
            prepareComponents(frame);
            frames.push(frame);
            break;

          case 0xFFC4: // DHT (Define Huffman Tables)
            var huffmanLength = readUint16();
            for (i = 2; i < huffmanLength;) {
              var huffmanTableSpec = data[offset++];
              var codeLengths = new Uint8Array(16);
              var codeLengthSum = 0;
              for (j = 0; j < 16; j++, offset++)
                codeLengthSum += (codeLengths[j] = data[offset]);
              var huffmanValues = new Uint8Array(codeLengthSum);
              for (j = 0; j < codeLengthSum; j++, offset++)
                huffmanValues[j] = data[offset];
              i += 17 + codeLengthSum;

              ((huffmanTableSpec >> 4) === 0 ? 
                huffmanTablesDC : huffmanTablesAC)[huffmanTableSpec & 15] =
                buildHuffmanTable(codeLengths, huffmanValues);
            }
            break;

          case 0xFFDD: // DRI (Define Restart Interval)
            readUint16(); // skip data length
            resetInterval = readUint16();
            break;

          case 0xFFDA: // SOS (Start of Scan)
            var scanLength = readUint16();
            var selectorsCount = data[offset++];
            var components = [], component;
            for (i = 0; i < selectorsCount; i++) {
              component = frame.components[data[offset++]];
              var tableSpec = data[offset++];
              component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
              component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
              components.push(component);
            }
            var spectralStart = data[offset++];
            var spectralEnd = data[offset++];
            var successiveApproximation = data[offset++];
            var processed = decodeScan(data, offset,
              frame, components, resetInterval,
              spectralStart, spectralEnd,
              successiveApproximation >> 4, successiveApproximation & 15);
            offset += processed;
            break;
          default:
            if (data[offset - 3] == 0xFF &&
                data[offset - 2] >= 0xC0 && data[offset - 2] <= 0xFE) {
              // could be incorrect encoding -- last 0xFF byte of the previous
              // block was eaten by the encoder
              offset -= 3;
              break;
            }
            throw "unknown JPEG marker " + fileMarker.toString(16);
        }
        fileMarker = readUint16();
      }
      if (frames.length != 1)
        throw "only single frame JPEGs supported";

      this.width = frame.samplesPerLine;
      this.height = frame.scanLines;
      this.jfif = jfif;
      this.adobe = adobe;
      this.components = [];
      for (var i = 0; i < frame.componentsOrder.length; i++) {
        var component = frame.components[frame.componentsOrder[i]];
        this.components.push({
          lines: buildComponentData(frame, component),
          scaleX: component.h / frame.maxH,
          scaleY: component.v / frame.maxV
        });
      }
    },
    getData: function getData(width, height) {
      var scaleX = this.width / width, scaleY = this.height / height;

      var component1, component2, component3, component4;
      var component1Line, component2Line, component3Line, component4Line;
      var x, y;
      var offset = 0;
      var Y, Cb, Cr, K, C, M, Ye, R, G, B;
      var colorTransform;
      var dataLength = width * height * this.components.length;
      var data = new Uint8Array(dataLength);
      switch (this.components.length) {
        case 1:
          component1 = this.components[0];
          for (y = 0; y < height; y++) {
            component1Line = component1.lines[0 | (y * component1.scaleY * scaleY)];
            for (x = 0; x < width; x++) {
              Y = component1Line[0 | (x * component1.scaleX * scaleX)];

              data[offset++] = Y;
            }
          }
          break;
        case 2:
          // PDF might compress two component data in custom colorspace
          component1 = this.components[0];
          component2 = this.components[1];
          for (y = 0; y < height; y++) {
            component1Line = component1.lines[0 | (y * component1.scaleY * scaleY)];
            component2Line = component2.lines[0 | (y * component2.scaleY * scaleY)];
            for (x = 0; x < width; x++) {
              Y = component1Line[0 | (x * component1.scaleX * scaleX)];
              data[offset++] = Y;
              Y = component2Line[0 | (x * component2.scaleX * scaleX)];
              data[offset++] = Y;
            }
          }
          break;
        case 3:
          // The default transform for three components is true
          colorTransform = true;
          // The adobe transform marker overrides any previous setting
          if (this.adobe && this.adobe.transformCode)
            colorTransform = true;
          else if (typeof this.colorTransform !== 'undefined')
            colorTransform = !!this.colorTransform;

          component1 = this.components[0];
          component2 = this.components[1];
          component3 = this.components[2];
          for (y = 0; y < height; y++) {
            component1Line = component1.lines[0 | (y * component1.scaleY * scaleY)];
            component2Line = component2.lines[0 | (y * component2.scaleY * scaleY)];
            component3Line = component3.lines[0 | (y * component3.scaleY * scaleY)];
            for (x = 0; x < width; x++) {
              if (!colorTransform) {
                R = component1Line[0 | (x * component1.scaleX * scaleX)];
                G = component2Line[0 | (x * component2.scaleX * scaleX)];
                B = component3Line[0 | (x * component3.scaleX * scaleX)];
              } else {
                Y = component1Line[0 | (x * component1.scaleX * scaleX)];
                Cb = component2Line[0 | (x * component2.scaleX * scaleX)];
                Cr = component3Line[0 | (x * component3.scaleX * scaleX)];

                R = clampTo8bit(Y + 1.402 * (Cr - 128));
                G = clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
                B = clampTo8bit(Y + 1.772 * (Cb - 128));
              }

              data[offset++] = R;
              data[offset++] = G;
              data[offset++] = B;
            }
          }
          break;
        case 4:
          if (!this.adobe)
            throw 'Unsupported color mode (4 components)';
          // The default transform for four components is false
          colorTransform = false;
          // The adobe transform marker overrides any previous setting
          if (this.adobe && this.adobe.transformCode)
            colorTransform = true;
          else if (typeof this.colorTransform !== 'undefined')
            colorTransform = !!this.colorTransform;

          component1 = this.components[0];
          component2 = this.components[1];
          component3 = this.components[2];
          component4 = this.components[3];
          for (y = 0; y < height; y++) {
            component1Line = component1.lines[0 | (y * component1.scaleY * scaleY)];
            component2Line = component2.lines[0 | (y * component2.scaleY * scaleY)];
            component3Line = component3.lines[0 | (y * component3.scaleY * scaleY)];
            component4Line = component4.lines[0 | (y * component4.scaleY * scaleY)];
            for (x = 0; x < width; x++) {
              if (!colorTransform) {
                C = component1Line[0 | (x * component1.scaleX * scaleX)];
                M = component2Line[0 | (x * component2.scaleX * scaleX)];
                Ye = component3Line[0 | (x * component3.scaleX * scaleX)];
                K = component4Line[0 | (x * component4.scaleX * scaleX)];
              } else {
                Y = component1Line[0 | (x * component1.scaleX * scaleX)];
                Cb = component2Line[0 | (x * component2.scaleX * scaleX)];
                Cr = component3Line[0 | (x * component3.scaleX * scaleX)];
                K = component4Line[0 | (x * component4.scaleX * scaleX)];

                C = 255 - clampTo8bit(Y + 1.402 * (Cr - 128));
                M = 255 - clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
                Ye = 255 - clampTo8bit(Y + 1.772 * (Cb - 128));
              }
              data[offset++] = C;
              data[offset++] = M;
              data[offset++] = Ye;
              data[offset++] = K;
            }
          }
          break;
        default:
          throw 'Unsupported color mode';
      }
      return data;
    },
    copyToImageData: function copyToImageData(imageData) {
      var width = imageData.width, height = imageData.height;
      var imageDataArray = imageData.data;
      var data = this.getData(width, height);
      var i = 0, j = 0, x, y;
      var Y, K, C, M, R, G, B;
      switch (this.components.length) {
        case 1:
          for (y = 0; y < height; y++) {
            for (x = 0; x < width; x++) {
              Y = data[i++];

              imageDataArray[j++] = Y;
              imageDataArray[j++] = Y;
              imageDataArray[j++] = Y;
              imageDataArray[j++] = 255;
            }
          }
          break;
        case 3:
          for (y = 0; y < height; y++) {
            for (x = 0; x < width; x++) {
              R = data[i++];
              G = data[i++];
              B = data[i++];

              imageDataArray[j++] = R;
              imageDataArray[j++] = G;
              imageDataArray[j++] = B;
              imageDataArray[j++] = 255;
            }
          }
          break;
        case 4:
          for (y = 0; y < height; y++) {
            for (x = 0; x < width; x++) {
              C = data[i++];
              M = data[i++];
              Y = data[i++];
              K = data[i++];

              R = 255 - clampTo8bit(C * (1 - K / 255) + K);
              G = 255 - clampTo8bit(M * (1 - K / 255) + K);
              B = 255 - clampTo8bit(Y * (1 - K / 255) + K);

              imageDataArray[j++] = R;
              imageDataArray[j++] = G;
              imageDataArray[j++] = B;
              imageDataArray[j++] = 255;
            }
          }
          break;
        default:
          throw 'Unsupported color mode';
      }
    }
  };

  return constructor;
})();




/**
 * @license CanvasTool.PngEncoder 2012 - imaya [ https://github.com/imaya/CanvasTool.PngEncoder ] The MIT License
 */
(function() {'use strict';var aa=this;function j(a,c,b){a=a.split(".");b=b||aa;!(a[0]in b)&&b.execScript&&b.execScript("var "+a[0]);for(var e;a.length&&(e=a.shift());)!a.length&&void 0!==c?b[e]=c:b=b[e]?b[e]:b[e]={}}Math.floor(2147483648*Math.random()).toString(36);var p="undefined"!==typeof Uint8Array&&"undefined"!==typeof Uint16Array&&"undefined"!==typeof Uint32Array;function r(a,c){this.index="number"===typeof c?c:0;this.o=0;this.buffer=a instanceof(p?Uint8Array:Array)?a:new (p?Uint8Array:Array)(32768);if(2*this.buffer.length<=this.index)throw Error("invalid index");this.buffer.length<=this.index&&this.K()}r.prototype.K=function(){var a=this.buffer,c,b=a.length,e=new (p?Uint8Array:Array)(b<<1);if(p)e.set(a);else for(c=0;c<b;++c)e[c]=a[c];return this.buffer=e};
r.prototype.c=function(a,c,b){var e=this.buffer,d=this.index,f=this.o,g=e[d];b&&1<c&&(a=8<c?(u[a&255]<<24|u[a>>>8&255]<<16|u[a>>>16&255]<<8|u[a>>>24&255])>>32-c:u[a]>>8-c);if(8>c+f)g=g<<c|a,f+=c;else for(b=0;b<c;++b)g=g<<1|a>>c-b-1&1,8===++f&&(f=0,e[d++]=u[g],g=0,d===e.length&&(e=this.K()));e[d]=g;this.buffer=e;this.o=f;this.index=d};r.prototype.finish=function(){var a=this.buffer,c=this.index;0<this.o&&(a[c]<<=8-this.o,a[c]=u[a[c]],c++);p?a=a.subarray(0,c):a.length=c;return a};
var ba=new (p?Uint8Array:Array)(256),v;for(v=0;256>v;++v){for(var ca=ba,da=v,x=v,y=x,ea=7,x=x>>>1;x;x>>>=1)y<<=1,y|=x&1,--ea;ca[da]=(y<<ea&255)>>>0}var u=ba;var z={$:function(a,c,b){return z.update(a,0,c,b)},update:function(a,c,b,e){for(var d=z.Y,f="number"===typeof b?b:b=0,e="number"===typeof e?e:a.length,c=c^4294967295,f=e&7;f--;++b)c=c>>>8^d[(c^a[b])&255];for(f=e>>3;f--;b+=8)c=c>>>8^d[(c^a[b])&255],c=c>>>8^d[(c^a[b+1])&255],c=c>>>8^d[(c^a[b+2])&255],c=c>>>8^d[(c^a[b+3])&255],c=c>>>8^d[(c^a[b+4])&255],c=c>>>8^d[(c^a[b+5])&255],c=c>>>8^d[(c^a[b+6])&255],c=c>>>8^d[(c^a[b+7])&255];return(c^4294967295)>>>0}},ga,ha=[0,1996959894,3993919788,2567524794,124634137,
1886057615,3915621685,2657392035,249268274,2044508324,3772115230,2547177864,162941995,2125561021,3887607047,2428444049,498536548,1789927666,4089016648,2227061214,450548861,1843258603,4107580753,2211677639,325883990,1684777152,4251122042,2321926636,335633487,1661365465,4195302755,2366115317,997073096,1281953886,3579855332,2724688242,1006888145,1258607687,3524101629,2768942443,901097722,1119000684,3686517206,2898065728,853044451,1172266101,3705015759,2882616665,651767980,1373503546,3369554304,3218104598,
565507253,1454621731,3485111705,3099436303,671266974,1594198024,3322730930,2970347812,795835527,1483230225,3244367275,3060149565,1994146192,31158534,2563907772,4023717930,1907459465,112637215,2680153253,3904427059,2013776290,251722036,2517215374,3775830040,2137656763,141376813,2439277719,3865271297,1802195444,476864866,2238001368,4066508878,1812370925,453092731,2181625025,4111451223,1706088902,314042704,2344532202,4240017532,1658658271,366619977,2362670323,4224994405,1303535960,984961486,2747007092,
3569037538,1256170817,1037604311,2765210733,3554079995,1131014506,879679996,2909243462,3663771856,1141124467,855842277,2852801631,3708648649,1342533948,654459306,3188396048,3373015174,1466479909,544179635,3110523913,3462522015,1591671054,702138776,2966460450,3352799412,1504918807,783551873,3082640443,3233442989,3988292384,2596254646,62317068,1957810842,3939845945,2647816111,81470997,1943803523,3814918930,2489596804,225274430,2053790376,3826175755,2466906013,167816743,2097651377,4027552580,2265490386,
503444072,1762050814,4150417245,2154129355,426522225,1852507879,4275313526,2312317920,282753626,1742555852,4189708143,2394877945,397917763,1622183637,3604390888,2714866558,953729732,1340076626,3518719985,2797360999,1068828381,1219638859,3624741850,2936675148,906185462,1090812512,3747672003,2825379669,829329135,1181335161,3412177804,3160834842,628085408,1382605366,3423369109,3138078467,570562233,1426400815,3317316542,2998733608,733239954,1555261956,3268935591,3050360625,752459403,1541320221,2607071920,
3965973030,1969922972,40735498,2617837225,3943577151,1913087877,83908371,2512341634,3803740692,2075208622,213261112,2463272603,3855990285,2094854071,198958881,2262029012,4057260610,1759359992,534414190,2176718541,4139329115,1873836001,414664567,2282248934,4279200368,1711684554,285281116,2405801727,4167216745,1634467795,376229701,2685067896,3608007406,1308918612,956543938,2808555105,3495958263,1231636301,1047427035,2932959818,3654703836,1088359270,936918E3,2847714899,3736837829,1202900863,817233897,
3183342108,3401237130,1404277552,615818150,3134207493,3453421203,1423857449,601450431,3009837614,3294710456,1567103746,711928724,3020668471,3272380065,1510334235,755167117];ga=p?new Uint32Array(ha):ha;z.Y=ga;function A(a){this.buffer=new (p?Uint16Array:Array)(2*a);this.length=0}A.prototype.getParent=function(a){return 2*((a-2)/4|0)};A.prototype.na=function(a){return 2*a+2};A.prototype.push=function(a,c){var b,e,d=this.buffer,f;b=this.length;d[this.length++]=c;for(d[this.length++]=a;0<b;)if(e=this.getParent(b),d[b]>d[e])f=d[b],d[b]=d[e],d[e]=f,f=d[b+1],d[b+1]=d[e+1],d[e+1]=f,b=e;else break;return this.length};
A.prototype.pop=function(){var a,c,b=this.buffer,e,d,f;c=b[0];a=b[1];this.length-=2;b[0]=b[this.length];b[1]=b[this.length+1];for(f=0;;){d=this.na(f);if(d>=this.length)break;d+2<this.length&&b[d+2]>b[d]&&(d+=2);if(b[d]>b[f])e=b[f],b[f]=b[d],b[d]=e,e=b[f+1],b[f+1]=b[d+1],b[d+1]=e;else break;f=d}return{index:a,value:c,length:this.length}};function B(a){var c=a.length,b=0,e=Number.POSITIVE_INFINITY,d,f,g,i,h,m,l,n,k;for(n=0;n<c;++n)a[n]>b&&(b=a[n]),a[n]<e&&(e=a[n]);d=1<<b;f=new (p?Uint32Array:Array)(d);g=1;i=0;for(h=2;g<=b;){for(n=0;n<c;++n)if(a[n]===g){m=0;l=i;for(k=0;k<g;++k)m=m<<1|l&1,l>>=1;for(k=m;k<d;k+=h)f[k]=g<<16|n;++i}++g;i<<=1;h<<=1}return[f,b,e]};function C(a,c){this.m=D;this.O=0;this.input=a;this.f=0;if(c&&(c.lazy&&(this.O=c.lazy),"number"===typeof c.compressionType&&(this.m=c.compressionType),c.outputBuffer&&(this.a=p&&c.outputBuffer instanceof Array?new Uint8Array(c.outputBuffer):c.outputBuffer),"number"===typeof c.outputIndex))this.f=c.outputIndex;this.a||(this.a=new (p?Uint8Array:Array)(32768))}var D=2,ia={NONE:0,W:1,G:D,$a:3},E=[],F;
for(F=0;288>F;F++)switch(!0){case 143>=F:E.push([F+48,8]);break;case 255>=F:E.push([F-144+400,9]);break;case 279>=F:E.push([F-256+0,7]);break;case 287>=F:E.push([F-280+192,8]);break;default:throw"invalid literal: "+F;}
C.prototype.l=function(){var a,c,b,e=this.input;switch(this.m){case 0:c=0;for(b=e.length;c<b;)a=p?e.subarray(c,c+65535):e.slice(c,c+65535),c+=a.length,this.Ba(a,c===b);break;case 1:this.a=this.xa(e,!0);this.f=this.a.length;break;case D:this.a=this.wa(e,!0);this.f=this.a.length;break;default:throw"invalid compression type";}return this.a};
C.prototype.Ba=function(a,c){var b,e,d=this.a,f=this.f;if(p){for(d=new Uint8Array(this.a.buffer);d.length<=f+a.length+5;)d=new Uint8Array(d.length<<1);d.set(this.a)}d[f++]=(c?1:0)|0;b=a.length;e=~b+65536&65535;d[f++]=b&255;d[f++]=b>>>8&255;d[f++]=e&255;d[f++]=e>>>8&255;if(p)d.set(a,f),f+=a.length,d=d.subarray(0,f);else{b=0;for(e=a.length;b<e;++b)d[f++]=a[b];d.length=f}this.f=f;return this.a=d};
C.prototype.xa=function(a,c){var b=new r(new Uint8Array(this.a.buffer),this.f);b.c(c?1:0,1,!0);b.c(1,2,!0);this.ia(this.P(a),b);return b.finish()};
C.prototype.wa=function(a,c){var b=new r(new Uint8Array(this.a),this.f),e,d,f,g,i=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],h,m,l,n,k,s,t=Array(19),q;e=D;b.c(c?1:0,1,!0);b.c(e,2,!0);e=this.P(a);h=this.v(this.la,15);m=this.u(h);l=this.v(this.ka,7);n=this.u(l);for(d=286;257<d&&0===h[d-1];d--);for(f=30;1<f&&0===l[f-1];f--);k=this.ra(d,h,f,l);s=this.v(k.ja,7);for(q=0;19>q;q++)t[q]=s[i[q]];for(g=19;4<g&&0===t[g-1];g--);i=this.u(s);b.c(d-257,5,!0);b.c(f-1,5,!0);b.c(g-4,4,!0);for(q=0;q<g;q++)b.c(t[q],
3,!0);q=0;for(t=k.s.length;q<t;q++)if(d=k.s[q],b.c(i[d],s[d],!0),16<=d){q++;switch(d){case 16:d=2;break;case 17:d=3;break;case 18:d=7;break;default:throw"invalid code: "+d;}b.c(k.s[q],d,!0)}this.ba(e,[m,h],[n,l],b);return b.finish()};C.prototype.ba=function(a,c,b,e){var d,f,g,i,h;g=c[0];c=c[1];i=b[0];h=b[1];b=0;for(d=a.length;b<d;++b)if(f=a[b],e.c(g[f],c[f],!0),256<f)e.c(a[++b],a[++b],!0),f=a[++b],e.c(i[f],h[f],!0),e.c(a[++b],a[++b],!0);else if(256===f)break;return e};
C.prototype.ia=function(a,c){var b,e,d;b=0;for(e=a.length;b<e;b++)if(d=a[b],r.prototype.c.apply(c,E[d]),256<d)c.c(a[++b],a[++b],!0),c.c(a[++b],5),c.c(a[++b],a[++b],!0);else if(256===d)break;return c};function G(a,c){this.length=a;this.Z=c}
function ja(a){switch(!0){case 3===a:return[257,a-3,0];case 4===a:return[258,a-4,0];case 5===a:return[259,a-5,0];case 6===a:return[260,a-6,0];case 7===a:return[261,a-7,0];case 8===a:return[262,a-8,0];case 9===a:return[263,a-9,0];case 10===a:return[264,a-10,0];case 12>=a:return[265,a-11,1];case 14>=a:return[266,a-13,1];case 16>=a:return[267,a-15,1];case 18>=a:return[268,a-17,1];case 22>=a:return[269,a-19,2];case 26>=a:return[270,a-23,2];case 30>=a:return[271,a-27,2];case 34>=a:return[272,a-31,2];case 42>=
a:return[273,a-35,3];case 50>=a:return[274,a-43,3];case 58>=a:return[275,a-51,3];case 66>=a:return[276,a-59,3];case 82>=a:return[277,a-67,4];case 98>=a:return[278,a-83,4];case 114>=a:return[279,a-99,4];case 130>=a:return[280,a-115,4];case 162>=a:return[281,a-131,5];case 194>=a:return[282,a-163,5];case 226>=a:return[283,a-195,5];case 257>=a:return[284,a-227,5];case 258===a:return[285,a-258,0];default:throw"invalid length: "+a;}}var H=[],I,J;for(I=3;258>=I;I++)J=ja(I),H[I]=J[2]<<24|J[1]<<16|J[0];
var ka=p?new Uint32Array(H):H;
G.prototype.oa=function(a){switch(!0){case 1===a:a=[0,a-1,0];break;case 2===a:a=[1,a-2,0];break;case 3===a:a=[2,a-3,0];break;case 4===a:a=[3,a-4,0];break;case 6>=a:a=[4,a-5,1];break;case 8>=a:a=[5,a-7,1];break;case 12>=a:a=[6,a-9,2];break;case 16>=a:a=[7,a-13,2];break;case 24>=a:a=[8,a-17,3];break;case 32>=a:a=[9,a-25,3];break;case 48>=a:a=[10,a-33,4];break;case 64>=a:a=[11,a-49,4];break;case 96>=a:a=[12,a-65,5];break;case 128>=a:a=[13,a-97,5];break;case 192>=a:a=[14,a-129,6];break;case 256>=a:a=
[15,a-193,6];break;case 384>=a:a=[16,a-257,7];break;case 512>=a:a=[17,a-385,7];break;case 768>=a:a=[18,a-513,8];break;case 1024>=a:a=[19,a-769,8];break;case 1536>=a:a=[20,a-1025,9];break;case 2048>=a:a=[21,a-1537,9];break;case 3072>=a:a=[22,a-2049,10];break;case 4096>=a:a=[23,a-3073,10];break;case 6144>=a:a=[24,a-4097,11];break;case 8192>=a:a=[25,a-6145,11];break;case 12288>=a:a=[26,a-8193,12];break;case 16384>=a:a=[27,a-12289,12];break;case 24576>=a:a=[28,a-16385,13];break;case 32768>=a:a=[29,a-
24577,13];break;default:throw"invalid distance";}return a};G.prototype.Ya=function(){var a=this.Z,c=[],b=0,e;e=ka[this.length];c[b++]=e&65535;c[b++]=e>>16&255;c[b++]=e>>24;e=this.oa(a);c[b++]=e[0];c[b++]=e[1];c[b++]=e[2];return c};
C.prototype.P=function(a){function c(a,b){var c=a.Ya(),d,e;d=0;for(e=c.length;d<e;++d)m[l++]=c[d];k[c[0]]++;s[c[3]]++;n=a.length+b-1;h=null}var b,e,d,f,g,i={},h,m=p?new Uint16Array(2*a.length):[],l=0,n=0,k=new (p?Uint32Array:Array)(286),s=new (p?Uint32Array:Array)(30),t=this.O;if(!p){for(d=0;285>=d;)k[d++]=0;for(d=0;29>=d;)s[d++]=0}k[256]=1;b=0;for(e=a.length;b<e;++b){d=g=0;for(f=3;d<f&&b+d!==e;++d)g=g<<8|a[b+d];void 0===i[g]&&(i[g]=[]);d=i[g];if(!(0<n--)){for(;0<d.length&&32768<b-d[0];)d.shift();
if(b+3>=e){h&&c(h,-1);d=0;for(f=e-b;d<f;++d)g=a[b+d],m[l++]=g,++k[g];break}0<d.length?(f=this.Ua(a,b,d),h?h.length<f.length?(g=a[b-1],m[l++]=g,++k[g],c(f,0)):c(h,-1):f.length<t?h=f:c(f,0)):h?c(h,-1):(g=a[b],m[l++]=g,++k[g])}d.push(b)}m[l++]=256;k[256]++;this.la=k;this.ka=s;return p?m.subarray(0,l):m};
C.prototype.Ua=function(a,c,b){var e,d,f=0,g,i,h,m=a.length;i=0;h=b.length;a:for(;i<h;i++){e=b[h-i-1];g=3;if(3<f){for(g=f;3<g;g--)if(a[e+g-1]!==a[c+g-1])continue a;g=f}for(;258>g&&c+g<m&&a[e+g]===a[c+g];)++g;g>f&&(d=e,f=g);if(258===g)break}return new G(f,c-d)};
C.prototype.ra=function(a,c,b,e){var d=new (p?Uint32Array:Array)(a+b),f,g,i=new (p?Uint32Array:Array)(316),h=new (p?Uint8Array:Array)(19);for(f=g=0;f<a;f++)d[g++]=c[f];for(f=0;f<b;f++)d[g++]=e[f];if(!p){f=0;for(c=h.length;f<c;++f)h[f]=0}f=b=0;for(c=d.length;f<c;f+=g){for(g=1;f+g<c&&d[f+g]===d[f];++g);a=g;if(0===d[f])if(3>a)for(;0<a--;)i[b++]=0,h[0]++;else for(;0<a;)e=138>a?a:138,e>a-3&&e<a&&(e=a-3),10>=e?(i[b++]=17,i[b++]=e-3,h[17]++):(i[b++]=18,i[b++]=e-11,h[18]++),a-=e;else if(i[b++]=d[f],h[d[f]]++,
a--,3>a)for(;0<a--;)i[b++]=d[f],h[d[f]]++;else for(;0<a;)e=6>a?a:6,e>a-3&&e<a&&(e=a-3),i[b++]=16,i[b++]=e-3,h[16]++,a-=e}return{s:p?i.subarray(0,b):i.slice(0,b),ja:h}};
C.prototype.v=function(a,c){var b=a.length,e=new A(572),d=new (p?Uint8Array:Array)(b),f,g,i;if(!p)for(g=0;g<b;g++)d[g]=0;for(g=0;g<b;++g)0<a[g]&&e.push(g,a[g]);b=Array(e.length/2);f=new (p?Uint32Array:Array)(e.length/2);if(1===b.length)return d[e.pop().index]=1,d;g=0;for(i=e.length/2;g<i;++g)b[g]=e.pop(),f[g]=b[g].value;e=this.Ta(f,f.length,c);g=0;for(i=b.length;g<i;++g)d[b[g].index]=e[g];return d};
C.prototype.Ta=function(a,c,b){function e(a){var b=h[a][m[a]];b===c?(e(a+1),e(a+1)):--g[b];++m[a]}var d=new (p?Uint16Array:Array)(b),f=new (p?Uint8Array:Array)(b),g=new (p?Uint8Array:Array)(c),i=Array(b),h=Array(b),m=Array(b),l=(1<<b)-c,n=1<<b-1,k,s;d[b-1]=c;for(k=0;k<b;++k)l<n?f[k]=0:(f[k]=1,l-=n),l<<=1,d[b-2-k]=(d[b-1-k]/2|0)+c;d[0]=f[0];i[0]=Array(d[0]);h[0]=Array(d[0]);for(k=1;k<b;++k)d[k]>2*d[k-1]+f[k]&&(d[k]=2*d[k-1]+f[k]),i[k]=Array(d[k]),h[k]=Array(d[k]);for(l=0;l<c;++l)g[l]=b;for(n=0;n<d[b-
1];++n)i[b-1][n]=a[n],h[b-1][n]=n;for(l=0;l<b;++l)m[l]=0;1===f[b-1]&&(--g[0],++m[b-1]);for(k=b-2;0<=k;--k){b=l=0;s=m[k+1];for(n=0;n<d[k];n++)b=i[k+1][s]+i[k+1][s+1],b>a[l]?(i[k][n]=b,h[k][n]=c,s+=2):(i[k][n]=a[l],h[k][n]=l,++l);m[k]=0;1===f[k]&&e(k)}return g};
C.prototype.u=function(a){var c=new (p?Uint16Array:Array)(a.length),b=[],e=[],d=0,f,g,i;f=0;for(g=a.length;f<g;f++)b[a[f]]=(b[a[f]]|0)+1;f=1;for(g=16;f<=g;f++)e[f]=d,d+=b[f]|0,d<<=1;f=0;for(g=a.length;f<g;f++){d=e[a[f]];e[a[f]]+=1;b=c[f]=0;for(i=a[f];b<i;b++)c[f]=c[f]<<1|d&1,d>>>=1}return c};function K(a,c){this.input=a;this.a=new (p?Uint8Array:Array)(32768);this.m=M.G;var b={},e;if((c||!(c={}))&&"number"===typeof c.compressionType)this.m=c.compressionType;for(e in c)b[e]=c[e];b.outputBuffer=this.a;this.S=new C(this.input,b)}var M=ia;
K.prototype.l=function(){var a,c,b,e=0;b=this.a;a=N;switch(a){case N:c=Math.LOG2E*Math.log(32768)-8;break;default:throw Error("invalid compression method");}c=c<<4|a;b[e++]=c;switch(a){case N:switch(this.m){case M.NONE:a=0;break;case M.W:a=1;break;case M.G:a=2;break;default:throw Error("unsupported compression type");}break;default:throw Error("invalid compression method");}a=a<<6|0;b[e++]=a|31-(256*c+a)%31;b=this.input;if("string"===typeof b){b=b.split("");c=0;for(a=b.length;c<a;c++)b[c]=(b[c].charCodeAt(0)&
255)>>>0}c=1;a=0;for(var d=b.length,f,g=0;0<d;){f=1024<d?1024:d;d-=f;do c+=b[g++],a+=c;while(--f);c%=65521;a%=65521}c=(a<<16|c)>>>0;this.S.f=e;b=this.S.l();e=b.length;p&&(b=new Uint8Array(b.buffer),b.length<=e+4&&(this.a=new Uint8Array(b.length+4),this.a.set(b),b=this.a),b=b.subarray(0,e+4));b[e++]=c>>24&255;b[e++]=c>>16&255;b[e++]=c>>8&255;b[e++]=c&255;return b};var la=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];p&&new Uint16Array(la);var ma=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258];p&&new Uint16Array(ma);var na=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0];p&&new Uint8Array(na);var oa=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];p&&new Uint16Array(oa);
var pa=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];p&&new Uint8Array(pa);var O=new (p?Uint8Array:Array)(288),P,qa;P=0;for(qa=O.length;P<qa;++P)O[P]=143>=P?8:255>=P?9:279>=P?7:8;B(O);var sa=new (p?Uint8Array:Array)(30),Q,ta;Q=0;for(ta=sa.length;Q<ta;++Q)sa[Q]=5;B(sa);var ua=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];p&&new Uint16Array(ua);var va=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258];p&&new Uint16Array(va);var wa=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0];p&&new Uint8Array(wa);var xa=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];p&&new Uint16Array(xa);
var ya=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];p&&new Uint8Array(ya);var za=new (p?Uint8Array:Array)(288),R,Aa;R=0;for(Aa=za.length;R<Aa;++R)za[R]=143>=R?8:255>=R?9:279>=R?7:8;B(za);var Ba=new (p?Uint8Array:Array)(30),S,Ca;S=0;for(Ca=Ba.length;S<Ca;++S)Ba[S]=5;B(Ba);var N=8;function T(a,c){var b,e,d;if(false)e=a.width,d=a.height,b=a.getContext("2d"),this.data=b.getImageData(0,0,e,d).data;else if("number"===typeof a.length){if("object"!==typeof c)throw Error("need opt_param object");if("number"!==typeof c.width)throw Error("width property not found");if("number"!==typeof c.height)throw Error("height property not found");e=c.width;d=c.height;this.data=a}else throw Error("invalid arguments");this.Va(e,d,c)}
T.prototype.Va=function(a,c,b){"object"!==typeof b&&(b={});this.width=a;this.height=c;this.d="number"===typeof b.bitDepth?b.bitDepth:8;this.e="number"===typeof b.colourType?b.colourType:U;this.I="number"===typeof b.compressionMethod?b.compressionMethod:V;this.t="number"===typeof b.filterMethod?b.filterMethod:W;this.L="number"===typeof b.filterType?b.filterType:Da;this.N="number"===typeof b.interlaceMethod?b.interlaceMethod:Ea;this.M="number"===typeof b.gamma?b.gamma:void 0;this.r="object"===typeof b.chrm&&
null!==b.chrm?b.chrm:void 0;this.D="object"===typeof b.splt&&null!==b.splt?b.splt:void 0;this.U="number"===typeof b.srgb?b.srgb:void 0;this.T=b.sbit instanceof Array?b.sbit:void 0;this.w="object"===typeof b.iccp&&null!==b.iccp?b.iccp:void 0;this.sa=void 0!==b.hist;this.C="object"===typeof b.phys&&null!==b.phys?b.phys:void 0;this.time=b.time instanceof Date?b.time:void 0;this.text="object"===typeof b.text&&null!==b.text?b.text:void 0;this.F="object"===typeof b.ztxt&&null!==b.ztxt?b.ztxt:void 0;this.z=
"object"===typeof b.itxt&&null!==b.itxt?b.itxt:void 0;this.V=b.trns;this.p=b.deflateOption;this.n=null;this.H=[];this.A=[];this.Za()};
var Fa=X("IHDR"),Ga=X("PLTE"),Ha=X("IDAT"),Ia=X("IEND"),Ja=X("tRNS"),Ka=X("gAMA"),La=X("cHRM"),Ma=X("sBIT"),Na=X("sRGB"),Oa=X("iCCP"),Pa=X("bKGD"),Qa=X("hIST"),Ra=X("pHYs"),Sa=X("sPLT"),Ta=X("tEXt"),Ua=X("zTXt"),Va=X("iTXt"),Wa=X("tIME"),V=0,U=6,W=0,Da=0,Ea=0,Xa=[137,80,78,71,13,10,26,10],Ya=p?new Uint8Array(Xa):Xa,Za=[{g:0,i:0,h:8,j:8},{g:4,i:0,h:8,j:8},{g:0,i:4,h:4,j:8},{g:2,i:0,h:4,j:4},{g:0,i:2,h:2,j:4},{g:1,i:0,h:2,j:2},{g:0,i:1,h:1,j:2}];
T.prototype.aa=function(){for(var a=this.J(),c=[],b=0,e=a.length;b<e;b++)c[b]=String.fromCharCode(a[b]);return c.join("")};
T.prototype.J=function(){var a=[],c;c=this.Q(this.data);a.push(Ya);a.push(this.Aa());"object"===typeof this.r&&null!==this.r&&a.push(this.Ea(this.r));"number"===typeof this.M&&a.push(this.Fa(this.M));"object"===typeof this.w&&null!==this.w&&a.push(this.Ha(this.w));this.T instanceof Array&&a.push(this.Ka(this.T));"number"===typeof this.U&&a.push(this.Ma(this.U));switch(this.e){case 3:a.push(this.Ca(c.q));this.B=c.q;this.k instanceof Array&&a.push(this.Da(this.k,this.B));this.sa&&a.push(this.Ga(this.A));
this.V&&a.push(this.Pa(c.Xa));break;case 0:case 2:case 4:case U:break;default:throw Error("unknown colour type");}"object"===typeof this.C&&null!==this.C&&a.push(this.Ja(this.C));"object"===typeof this.D&&null!==this.D&&a.push(this.La(this.D,this.H));this.time instanceof Date&&a.push(this.Oa(this.time));"object"===typeof this.text&&null!==this.text&&a.push(this.Na(this.text));"object"===typeof this.F&&null!==this.F&&a.push(this.Qa(this.F));"object"===typeof this.z&&null!==this.z&&a.push(this.Ia(this.z));
a.push(this.ya(c.X));a.push(this.za());var b,e,d;if(p){c=0;b=a.length;for(e=0;c<b;++c)e+=a[c].length;e=new Uint8Array(e);for(d=c=0;c<b;++c)e.set(a[c],d),d+=a[c].length;a=e}else a=Array.prototype.concat.apply([],a);return a};T.prototype.bb=function(){return this.B instanceof Array?this.B:this.Q(this.data).q.map(function(a){return a.split("").map(function(a){return a.charCodeAt(0)})})};
T.prototype.Za=function(){var a,c,b,e=!1;switch(this.e){case 0:a=[1,2,4,8,16];break;case 3:a=[1,2,4,8];break;case 2:case 4:case U:a=[8,16];break;default:throw Error("invalid colour type");}c=0;for(b=a.length;c<b;c++)if(this.d===a[c]){e=!0;break}if(!1===e)throw Error("invalid parameter");};
T.prototype.Aa=function(){var a=new (p?Uint8Array:Array)(25),c=8;a[c++]=this.width>>24&255;a[c++]=this.width>>16&255;a[c++]=this.width>>8&255;a[c++]=this.width&255;a[c++]=this.height>>24&255;a[c++]=this.height>>16&255;a[c++]=this.height>>8&255;a[c++]=this.height&255;a[c++]=this.d;a[c++]=this.e;a[c++]=this.I;a[c++]=this.t;a[c]=this.N;return this.b(Fa,a)};
T.prototype.Q=function(a){var c=[],b=this.V,e=this.d,d=[],f=[],g={},i={},h=0,m=0,l=0,n=0,k={},s=0,t=0,q,o,w,Y=0,L,fa=this.H,ra=0!==(this.e&4);o=0;for(w=a.length;o<w;o+=4)h=a[o],m=a[o+1],l=a[o+2],n=a[o+3],q=b?String.fromCharCode(h,m,l,n):$a(h,m,l),g[q]=(g[q]||0)+1,s=((h<<8|m)<<8|l)<<8|n,void 0===k[s]&&(t=fa.length,fa.push({red:h,green:m,blue:l,alpha:n,count:0}),k[s]=t),fa[k[s]].count++;switch(this.e){case 4:case 0:o=0;for(w=a.length;o<w;o+=4)h=a[o],m=a[o+1],l=a[o+2],n=a[o+3],b=void 0,b=0.29891*h+0.58661*
m+0.11448*l+1.0E-4,q=(255<b?255:b)|0,8>e&&(q>>>=8-e,n>>>=8-e),c[Y++]=ra?[q,n]:[q];break;case 2:case U:o=0;for(w=a.length;o<w;o+=4)c[Y++]=ra?[a[o],a[o+1],a[o+2],a[o+3]]:[a[o],a[o+1],a[o+2]];break;case 3:if(Object.keys)L=Object.keys(g);else for(q in g)L.push(q);b&&L.sort(function(a,b){return a.charCodeAt(3)<b.charCodeAt(3)?-1:a.charCodeAt(3)>b.charCodeAt(3)?1:a.charCodeAt(0)<b.charCodeAt(0)?-1:a.charCodeAt(0)>b.charCodeAt(0)?1:a.charCodeAt(1)<b.charCodeAt(1)?-1:a.charCodeAt(1)>b.charCodeAt(1)?1:a.charCodeAt(2)<
b.charCodeAt(2)?-1:a.charCodeAt(2)>b.charCodeAt(2)?1:0});o=0;for(w=L.length;o<w;o++)q=L[o],b?(255!==q.charCodeAt(3)&&(f[o]=q.charCodeAt(3)),i[q]=o):i[q.slice(0,3)]=o,d.push(q.charCodeAt(0)),d.push(q.charCodeAt(1)),d.push(q.charCodeAt(2));if(this.k instanceof Array){if(3!==this.k.length)throw Error("wrong background-color length");if(!($a.apply(null,this.k)in g)){if(d.length/3===1<<this.d)throw Error("can not add background-color to palette");d.push(this.k[0]);d.push(this.k[1]);d.push(this.k[2])}}if(d.length/
3>1<<this.d)throw Error("over "+(1<<this.d)+" colors: "+d.length/3);o=0;for(w=d.length/3;o<w;o++)this.A[o]=0;o=0;for(w=a.length;o<w;o+=4)h=a[o],m=a[o+1],l=a[o+2],n=a[o+3],q=b?String.fromCharCode(h,m,l,n):$a(h,m,l),this.A[i[q]]++,c[Y++]=[i[q]];break;default:throw Error("invalid colour type");}return{q:d,Xa:f,X:c}};
T.prototype.Ea=function(a){var c=new (p?Uint8Array:Array)(44),b=8,e=1E5*a.whitePointX,d=1E5*a.whitePointY,f=1E5*a.redX,g=1E5*a.redY,i=1E5*a.greenX,h=1E5*a.greenY,m=1E5*a.blueX,a=1E5*a.blueY;c[b++]=e>>24&255;c[b++]=e>>16&255;c[b++]=e>>8&255;c[b++]=e&255;c[b++]=d>>24&255;c[b++]=d>>16&255;c[b++]=d>>8&255;c[b++]=d&255;c[b++]=f>>24&255;c[b++]=f>>16&255;c[b++]=f>>8&255;c[b++]=f&255;c[b++]=g>>24&255;c[b++]=g>>16&255;c[b++]=g>>8&255;c[b++]=g&255;c[b++]=i>>24&255;c[b++]=i>>16&255;c[b++]=i>>8&255;c[b++]=i&
255;c[b++]=h>>24&255;c[b++]=h>>16&255;c[b++]=h>>8&255;c[b++]=h&255;c[b++]=m>>24&255;c[b++]=m>>16&255;c[b++]=m>>8&255;c[b++]=m&255;c[b++]=a>>24&255;c[b++]=a>>16&255;c[b++]=a>>8&255;c[b]=a&255;return this.b(La,c)};T.prototype.Fa=function(a){var c=new (p?Uint8Array:Array)(16),a=1E5/a+0.5|0,b=8;c[b++]=a>>24&255;c[b++]=a>>16&255;c[b++]=a>>8&255;c[b]=a&255;return this.b(Ka,c)};
T.prototype.Ka=function(a){var c,b=8;switch(this.e){case 0:if(1!==a.length)throw Error("wrong sBIT length");c=new (p?Uint8Array:Array)(13);c[b]=a[0];break;case 2:if(3!==a.length)throw Error("wrong sBIT length");c=new (p?Uint8Array:Array)(15);c[b++]=a[0];c[b++]=a[1];c[b]=a[2];break;case 3:if(3!==a.length)throw Error("wrong sBIT length");c=new (p?Uint8Array:Array)(15);c[b++]=a[0];c[b++]=a[1];c[b]=a[2];break;case 4:if(2!==a.length)throw Error("wrong sBIT length");c=new (p?Uint8Array:Array)(14);c[b++]=
a[0];c[b]=a[1];break;case U:if(4!==a.length)throw Error("wrong sBIT length");c=new (p?Uint8Array:Array)(16);c[b++]=a[0];c[b++]=a[1];c[b++]=a[2];c[b]=a[3];break;default:throw Error("unknown colour type");}return this.b(Ma,c)};T.prototype.Ma=function(a){var c=new (p?Uint8Array:Array)(13);c[8]=a;return this.b(Na,c)};
T.prototype.Ha=function(a){var c,b,e,d=8;c=X(a.name);e=c.length;if(79<e)throw Error("ICCP Profile name is over 79 characters");for(b=0;b<e;b++)if(32>c[b]||126<c[b]&&161>c[b]||255<c[b])throw Error("wrong iccp profile name.");c=p?Array.prototype.slice.call(c):c;c.push(0);c.push(a.compressionMethod);switch(a.compressionMethod){case V:b=(new K(a.profile,this.p)).l();break;default:throw Error("unknown ICC Profile compression method");}p?(a=new Uint8Array(c.length+b.length+12),a.set(c,d),d+=c.length,a.set(b,
d)):(a=[0,0,0,0,0,0,0,0].concat(c,b),a.length+=4);return this.b(Oa,a)};
T.prototype.Da=function(a,c){var b,e=null,d,f=8;switch(this.e){case 0:case 4:if(1!==a.length)throw Error("wrong background-color length");b=new (p?Uint8Array:Array)(14);b[f++]=a[0]>>8&255;b[f]=a[0]&255;break;case 2:case U:if(3!==a.length)throw Error("wrong background-color length");b=new (p?Uint8Array:Array)(18);b[f++]=a[0]>>8&255;b[f++]=a[0]&255;b[f++]=a[1]>>8&255;b[f++]=a[1]&255;b[f++]=a[2]>>8&255;b[f]=a[2]&255;break;case 3:if(3!==a.length)throw Error("wrong background-color length");b=0;for(d=
c.length;b<d;b+=3)c[b+0]===a[0]&&(c[b+1]===a[1]&&c[b+2]===a[2])&&(e=b/3);if(null===e)return[];b=new (p?Uint8Array:Array)(13);b[f]=e;break;default:throw Error("unknown colour type");}return this.b(Pa,b)};T.prototype.Ga=function(a){for(var c=new (p?Uint8Array:Array)(2*a.length+12),b,e=b=0,d=a.length;e<d;e++)b=b<a[e]||0===e?a[e]:b;for(var f=a.length,g=8,d=0;d<f;d++)e=a[d],e=0===e?0:65534*(e/b)+1.5|0,c[g++]=e>>8&255,c[g++]=e&255;return this.b(Qa,c)};
T.prototype.La=function(a,c){var b,e,d,f,g=0>a.num?c.length:a.num,i=0,h=8;if(0===g)return[];b=[0,0,0,0,0,0,0,0].concat(X(a.name));b[h++]=0;switch(this.d){case 16:b[h++]=16;break;case 8:case 4:case 2:case 1:b[h++]=8;break;default:throw Error("invalid bit depth");}e=c.sort(function(a,b){return a.count<b.count?1:a.count>b.count?-1:0});d=e[0].count;for(f=0;f<g;++f){c=e[f];switch(this.d){case 16:b[h++]=c.red&255;b[h++]=c.red&255;b[h++]=c.green&255;b[h++]=c.green&255;b[h++]=c.blue&255;b[h++]=c.blue&255;
b[h++]=c.alpha&255;b[h++]=c.alpha&255;break;case 8:case 4:case 2:case 1:b[h++]=c.red&255;b[h++]=c.green&255;b[h++]=c.blue&255;b[h++]=c.alpha&255;break;default:throw Error("invalid bit depth");}i=65535*(c.count/d)+0.5|0;b[h++]=i>>8&255;b[h++]=i&255}b.length+=4;return this.b(Sa,p?new Uint8Array(b):b)};
T.prototype.Ca=function(a){var c;if(256<a.length/3)throw Error("over 256 colors: "+a.length/3);p?(c=new Uint8Array(a.length+12),c.set(a,8)):(c=a,c.unshift(0,0,0,0,0,0,0,0),c.length+=8);return this.b(Ga,c)};T.prototype.Ja=function(a){var c=new (p?Uint8Array:Array)(21),b=8;c[b++]=a.x>>24&255;c[b++]=a.x>>16&255;c[b++]=a.x>>8&255;c[b++]=a.x&255;c[b++]=a.y>>24&255;c[b++]=a.y>>16&255;c[b++]=a.y>>8&255;c[b++]=a.y&255;c[b]=a.unit;return this.b(Ra,c)};
T.prototype.Na=function(a){var c=X(a.keyword),a=X(a.text),b=new (p?Uint8Array:Array)(c.length+a.length+1+12),e=8,d,f;d=0;for(f=c.length;d<f;++d)b[e++]=c[d];d=b[e++]=0;for(f=a.length;d<f;++d)b[e++]=a[d];return this.b(Ta,b)};
T.prototype.Qa=function(a){var c,b;b=X(a.text);c=X(a.keyword);c=[0,0,0,0,0,0,0,0].concat(p?Array.prototype.slice.call(c):c,0,a.compressionMethod);switch(a.compressionMethod){case V:a=(new K(b,this.p)).l();break;default:throw Error("unknown compression method");}p?(b=new Uint8Array(c.length+a.length+4),b.set(c),b.set(a,c.length)):(b=c.concat(a),b.length+=4);return this.b(Ua,b)};
T.prototype.Ia=function(a){var c;c=X(a.keyword);var b,e=8;c=p?Array.prototype.slice.call(c):c;c.push(0);if("number"===typeof a.compressionMethod)switch(c.push(1),c.push(a.compressionMethod),a.compressionMethod){case V:b=(new K(X(unescape(encodeURIComponent(a.text))),this.p)).l();break;default:throw Error("unknown compression method");}else c.push(0),c.push(0),b=X(unescape(encodeURIComponent(a.text)));c=c.concat(X(a.lang));c.push(0);"string"===typeof a.translatedKeyword&&(c=c.concat(X(unescape(encodeURIComponent(a.translatedKeyword)))));
c.push(0);p?(a=new Uint8Array(c.length+b.length+12),a.set(c,e),e+=c.length,a.set(b,e)):(a=[0,0,0,0,0,0,0,0].concat(c,b),a.length+=4);return this.b(Va,a)};T.prototype.Oa=function(a){var c=new (p?Uint8Array:Array)(19),b=8;c[b++]=a.getUTCFullYear()>>8&255;c[b++]=a.getUTCFullYear()&255;c[b++]=a.getUTCMonth()+1;c[b++]=a.getUTCDate();c[b++]=a.getUTCHours();c[b++]=a.getUTCMinutes();c[b]=a.getUTCSeconds();return this.b(Wa,c)};
T.prototype.ya=function(a){var c=[],b=this.t,e=this.L,d,f,g,i,h,m,l,n;this.va=this.qa();this.ha=this.pa();h=this.ma();m=this.va(a);l=0;for(n=m.length;l<n;l++)if(g=m[l],a=g.R,0!==a.length){d=g.width;this.n=null;f=0;for(g=g.height;f<g;f++){i=this.Wa(a,f*d,d);i=this.Sa(i);switch(b){case W:c.push(e);var k=c,s=this.ha(i,h),t=0,q=s.length,o=s.length;if(k.push)for(;t<o;t++)k.push(s[t]);else for(;t<o;t++)k[q+t]=s[t];break;default:throw Error("unknown filter method");}this.n=i}}switch(this.I){case V:c=(new K(c,
this.p)).l();break;default:throw Error("unknown compression method");}p?(a=new Uint8Array(c.length+12),a.set(c,8)):(a=c,a.unshift(0,0,0,0,0,0,0,0),a.length+=4);return this.b(Ha,a)};T.prototype.za=function(){return this.b(Ia,new (p?Uint8Array:Array)(12))};
T.prototype.Pa=function(a){var c,b=8;switch(this.e){case 0:c=new (p?Uint8Array:Array)(14);c[b++]=a[0]>>8&255;c[b++]=a[0]&255;break;case 2:c=new (p?Uint8Array:Array)(18);c[b++]=a[0]>>8&255;c[b++]=a[0]&255;c[b++]=a[1]>>8&255;c[b++]=a[1]&255;c[b++]=a[2]>>8&255;c[b++]=a[2]&255;break;case 3:c=new (p?Uint8Array:Array)(a.length+12);p?c.set(a,b):(c=a,c.unshift(0,0,0,0,0,0,0,0),c.length+=4);break;default:throw Error("invalid colour type");}return this.b(Ja,c)};
T.prototype.ma=function(){var a,c=0<(this.e&4);switch(this.e){case 3:a=1;break;case 0:case 4:a=1;c&&(a+=1);16===this.d&&(a*=2);break;case 2:case U:a=3;c&&(a+=1);16===this.d&&(a*=2);break;default:throw Error("unknown colour type");}return a};T.prototype.qa=function(){var a;switch(this.N){case Ea:a=this.ua;break;case 1:a=this.ta;break;default:throw Error("unknown interlace method");}return a};function Z(a,c,b){this.width=a;this.height=c;this.R=b}
T.prototype.ua=function(a){return[new Z(this.width,this.height,a)]};T.prototype.ta=function(a){var c=this.height,b=a.length/c,e,d,f,g,i,h,m,l,n,k,s,t;s=[new Z(0,0,[]),new Z(0,0,[]),new Z(0,0,[]),new Z(0,0,[]),new Z(0,0,[]),new Z(0,0,[]),new Z(0,0,[])];l=0;for(n=Za.length;l<n;l++){t=s[l];k=Za[l];for(d=i=h=0;d<c;d+=8)for(g=k.i;8>g;g+=k.j)for(e=0;e<b;e+=8)for(f=k.g;8>f;f+=k.h)if(m=a[e+f+(d+g)*b])i=(e+f-k.g)/k.h,h=(d+g-k.i)/k.j,t.R.push(m);t.width=i+1;t.height=h+1}return s};
T.prototype.Sa=function(a){var c=[],b,e,d,f,g,i,h=this.d,m,l;m=8/h;d=0;for(f=a.length;d<f;d++)if(b=a[d],8>h)0===d%m&&(l=d/m,c[l]=0),c[l]|=b[0]<<(m-d%m-1)*h;else{g=0;for(i=b.length;g<i;g++)e=b[g],c.push(e),16===h&&c.push(e)}return c};
T.prototype.pa=function(){var a;switch(this.t){case W:switch(this.L){case Da:a=this.da;break;case 1:a=this.fa;break;case 2:a=this.ga;break;case 3:a=this.ca;break;case 4:a=this.ea;break;default:throw Error("unknown filter type");}break;default:throw Error("unknown filter method");}return a};T.prototype.da=function(a){return a};T.prototype.fa=function(a,c){var b=[],e=0,d,f;d=0;for(f=a.length;d<f;d++)e=a[d-c]||0,b.push(a[d]-e+256&255);return b};
T.prototype.ga=function(a){var c=[],b,e=this.n,d,f;d=0;for(f=a.length;d<f;d++)b=e&&e[d]?e[d]:0,c.push(a[d]-b+256&255);return c};T.prototype.ca=function(a,c){var b=[],e,d,f=this.n,g,i;g=0;for(i=a.length;g<i;g++)e=a[g-c]||0,d=f&&f[g]||0,e=e+d>>>1,b.push(a[g]+256-e&255);return b};T.prototype.ea=function(a,c){var b=[],e,d,f,g=this.n,i,h;i=0;for(h=a.length;i<h;i++)e=a[i-c]||0,d=g&&g[i]||0,f=g&&g[i-c]||0,e=this.Ra(e,d,f),b.push(a[i]-e+256&255);return b};
T.prototype.Ra=function(a,c,b){var e,d,f;e=a+c-b;d=Math.abs(e-a);f=Math.abs(e-c);e=Math.abs(e-b);return d<=f&&d<=e?a:f<=e?c:b};T.prototype.Wa=function(a,c,b){return"function"===typeof a.slice?a.slice(c,c+b):Array.prototype.slice.call(a,c,c+b)};T.prototype.b=function(a,c){var b=c.length-12,e=0;c[e++]=b>>24&255;c[e++]=b>>16&255;c[e++]=b>>8&255;c[e++]=b&255;c[e++]=a[0];c[e++]=a[1];c[e++]=a[2];c[e++]=a[3];b=z.$(c,4,4+b);e=c.length-4;c[e++]=b>>24&255;c[e++]=b>>16&255;c[e++]=b>>8&255;c[e]=b&255;return c};
T.prototype.cb=function(a,c){var b=[],e;do e=a&255,b.push(e),a>>>=8;while(0<a);if("number"===typeof c)for(;b.length<c;)b.push(0);return b.reverse()};function $a(a,c,b){return String.fromCharCode(a,c,b)}T.prototype.ab=function(a){return String.fromCharCode(a).charAt(0)};function X(a){var a=a.split(""),c,b=a.length,e=new (p?Uint8Array:Array)(b);for(c=0;c<b;++c)e[c]=a[c].charCodeAt(0);return e}function $(a,c){for(var b in c){var e=[a,b].join(".");j(e,c[b],void 0)}}j("CanvasTool.PngEncoder",T,void 0);
$("CanvasTool.PngEncoder.CompressionMethod",{DEFLATE:V});$("CanvasTool.PngEncoder.ColourType",{GRAYSCALE:0,TRUECOLOR:2,INDEXED_COLOR:3,GRAYSCALE_WITH_ALPHA:4,TRUECOLOR_WITH_ALPHA:U});$("CanvasTool.PngEncoder.FilterMethod",{BASIC:W});$("CanvasTool.PngEncoder.BasicFilterType",{NONE:Da,SUB:1,UP:2,AVERAGE:3,PAETH:4});$("CanvasTool.PngEncoder.InterlaceMethod",{NONE:Ea,ADAM7:1});$("CanvasTool.PngEncoder.CompressionFlag",{UNCOMPRESSED:0,COMPRESSED:1});
j("CanvasTool.PngEncoder.prototype.convert",T.prototype.aa,void 0);j("CanvasTool.PngEncoder.prototype.convertToArray",T.prototype.J,void 0);}).call(this);




// (c) Dean McNamee <dean@gmail.com>, 2013.
//
// https://github.com/deanm/omggif
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.
//
// omggif is a JavaScript implementation of a GIF 89a encoder and decoder,
// including animation and compression. It does not rely on any specific
// underlying system, so should run in the browser, Node, or Plask.

function GifWriter(buf, width, height, gopts) {
  var p = 0;

  var gopts = gopts === undefined ? { } : gopts;
  var loop_count = gopts.loop === undefined ? null : gopts.loop;
  var global_palette = gopts.palette === undefined ? null : gopts.palette;

  if (width <= 0 || height <= 0 || width > 65535 || height > 65535)
    throw "Width/Height invalid."

  function check_palette_and_num_colors(palette) {
    var num_colors = palette.length;
    if (num_colors < 2 || num_colors > 256 ||  num_colors & (num_colors-1))
      throw "Invalid code/color length, must be power of 2 and 2 .. 256.";
    return num_colors;
  }

  // - Header.
  buf[p++] = 0x47; buf[p++] = 0x49; buf[p++] = 0x46;  // GIF
  buf[p++] = 0x38; buf[p++] = 0x39; buf[p++] = 0x61;  // 89a

  // Handling of Global Color Table (palette) and background index.
  var gp_num_colors_pow2 = 0;
  var background = 0;
  if (global_palette !== null) {
    var gp_num_colors = check_palette_and_num_colors(global_palette);
    while (gp_num_colors >>= 1) ++gp_num_colors_pow2;
    gp_num_colors = 1 << gp_num_colors_pow2;
    --gp_num_colors_pow2;
    if (gopts.background !== undefined) {
      background = gopts.background;
      if (background >= gp_num_colors) throw "Background index out of range.";
      // The GIF spec states that a background index of 0 should be ignored, so
      // this is probably a mistake and you really want to set it to another
      // slot in the palette. But actually in the end most browsers, etc end
      // up ignoring this almost completely (including for dispose background).
      if (background === 0)
        throw "Background index explicitly passed as 0.";
    }
  }

  // - Logical Screen Descriptor.
  // NOTE(deanm): w/h apparently ignored by implementations, but set anyway.
  buf[p++] = width & 0xff; buf[p++] = width >> 8 & 0xff;
  buf[p++] = height & 0xff; buf[p++] = height >> 8 & 0xff;
  // NOTE: Indicates 0-bpp original color resolution (unused?).
  buf[p++] = (global_palette !== null ? 0x80 : 0) |  // Global Color Table
                                                      // Flag.
             gp_num_colors_pow2;  // NOTE: No sort flag (unused?).
  buf[p++] = background;  // Background Color Index.
  buf[p++] = 0;  // Pixel aspect ratio (unused?).

  // - Global Color Table
  if (global_palette !== null) {
    for (var i = 0, il = global_palette.length; i < il; ++i) {
      var rgb = global_palette[i];
      buf[p++] = rgb >> 16 & 0xff;
      buf[p++] = rgb >> 8 & 0xff;
      buf[p++] = rgb & 0xff;
    }
  }

  if (loop_count !== null) {  // Netscape block for looping.
    if (loop_count < 0 || loop_count > 65535)
      throw "Loop count invalid."
    // Extension code, label, and length.
    buf[p++] = 0x21; buf[p++] = 0xff; buf[p++] = 0x0b;
    // NETSCAPE2.0
    buf[p++] = 0x4e; buf[p++] = 0x45; buf[p++] = 0x54; buf[p++] = 0x53;
    buf[p++] = 0x43; buf[p++] = 0x41; buf[p++] = 0x50; buf[p++] = 0x45;
    buf[p++] = 0x32; buf[p++] = 0x2e; buf[p++] = 0x30;
    // Sub-block
    buf[p++] = 0x03; buf[p++] = 0x01;
    buf[p++] = loop_count & 0xff; buf[p++] = loop_count >> 8 & 0xff;
    buf[p++] = 0x00;  // Terminator.
  }


  var ended = false;

  this.addFrame = function(x, y, w, h, indexed_pixels, opts) {
    if (ended === true) { --p; ended = false; }  // Un-end.

    opts = opts === undefined ? { } : opts;

    // TODO(deanm): Bounds check x, y. Do they need to be within the virtual
    // canvas width/height, I imagine?
    if (x < 0 || y < 0 || x > 65535 || y > 65535)
      throw "x/y invalid."

    if (w <= 0 || h <= 0 || w > 65535 || h > 65535)
      throw "Width/Height invalid."

    if (indexed_pixels.length < w * h)
      throw "Not enough pixels for the frame size.";

    var using_local_palette = true;
    var palette = opts.palette;
    if (palette === undefined || palette === null) {
      using_local_palette = false;
      palette = global_palette;
    }

    if (palette === undefined || palette === null)
      throw "Must supply either a local or global palette.";

    var num_colors = check_palette_and_num_colors(palette);

    // Compute the min_code_size (power of 2), destroying num_colors.
    var min_code_size = 0;
    while (num_colors >>= 1) ++min_code_size;
    num_colors = 1 << min_code_size;  // Now we can easily get it back.

    var delay = opts.delay === undefined ? 0 : opts.delay;

    // From the spec:
    // 0 - No disposal specified. The decoder is
    // not required to take any action.
    // 1 - Do not dispose. The graphic is to be left
    // in place.
    // 2 - Restore to background color. The area used by the
    // graphic must be restored to the background color.
    // 3 - Restore to previous. The decoder is required to
    // restore the area overwritten by the graphic with
    // what was there prior to rendering the graphic.
    // 4-7 - To be defined.
    // NOTE(deanm): Dispose background doesn't really work, apparently most
    // browsers ignore the background palette index and clear to transparency.
    var disposal = opts.disposal === undefined ? 0 : opts.disposal;
    if (disposal < 0 || disposal > 3)  // 4-7 is reserved.
      throw "Disposal out of range.";

    var use_transparency = false;
    var transparent_index = 0;
    if (opts.transparent !== undefined && opts.transparent !== null) {
      use_transparency = true;
      transparent_index = opts.transparent;
      if (transparent_index < 0 || transparent_index >= num_colors)
        throw "Transparent color index.";
    }

    if (disposal !== 0 || use_transparency || delay !== 0) {
      // - Graphics Control Extension
      buf[p++] = 0x21; buf[p++] = 0xf9;  // Extension / Label.
      buf[p++] = 4;  // Byte size.

      buf[p++] = disposal << 2 | (use_transparency === true ? 1 : 0);
      buf[p++] = delay & 0xff; buf[p++] = delay >> 8 & 0xff;
      buf[p++] = transparent_index;  // Transparent color index.
      buf[p++] = 0;  // Block Terminator.
    }

    // - Image Descriptor
    buf[p++] = 0x2c;  // Image Seperator.
    buf[p++] = x & 0xff; buf[p++] = x >> 8 & 0xff;  // Left.
    buf[p++] = y & 0xff; buf[p++] = y >> 8 & 0xff;  // Top.
    buf[p++] = w & 0xff; buf[p++] = w >> 8 & 0xff;
    buf[p++] = h & 0xff; buf[p++] = h >> 8 & 0xff;
    // NOTE: No sort flag (unused?).
    // TODO(deanm): Support interlace.
    buf[p++] = using_local_palette === true ? (0x80 | (min_code_size-1)) : 0;

    // - Local Color Table
    if (using_local_palette === true) {
      for (var i = 0, il = palette.length; i < il; ++i) {
        var rgb = palette[i];
        buf[p++] = rgb >> 16 & 0xff;
        buf[p++] = rgb >> 8 & 0xff;
        buf[p++] = rgb & 0xff;
      }
    }

    p = GifWriterOutputLZWCodeStream(
            buf, p, min_code_size < 2 ? 2 : min_code_size, indexed_pixels);
  };

  this.end = function() {
    if (ended === false) {
      buf[p++] = 0x3b;  // Trailer.
      ended = true;
    }
    return p;
  };
}

// Main compression routine, palette indexes -> LZW code stream.
// |index_stream| must have at least one entry.
function GifWriterOutputLZWCodeStream(buf, p, min_code_size, index_stream) {
  buf[p++] = min_code_size;
  var cur_subblock = p++;  // Pointing at the length field.

  var clear_code = 1 << min_code_size;
  var code_mask = clear_code - 1;
  var eoi_code = clear_code + 1;
  var next_code = eoi_code + 1;

  var cur_code_size = min_code_size + 1;  // Number of bits per code.
  var cur_shift = 0;
  // We have at most 12-bit codes, so we should have to hold a max of 19
  // bits here (and then we would write out).
  var cur = 0;

  function emit_bytes_to_buffer(bit_block_size) {
    while (cur_shift >= bit_block_size) {
      buf[p++] = cur & 0xff;
      cur >>= 8; cur_shift -= 8;
      if (p === cur_subblock + 256) {  // Finished a subblock.
        buf[cur_subblock] = 255;
        cur_subblock = p++;
      }
    }
  }

  function emit_code(c) {
    cur |= c << cur_shift;
    cur_shift += cur_code_size;
    emit_bytes_to_buffer(8);
  }

  // I am not an expert on the topic, and I don't want to write a thesis.
  // However, it is good to outline here the basic algorithm and the few data
  // structures and optimizations here that make this implementation fast.
  // The basic idea behind LZW is to build a table of previously seen runs
  // addressed by a short id (herein called output code). All data is
  // referenced by a code, which represents one or more values from the
  // original input stream. All input bytes can be referenced as the same
  // value as an output code. So if you didn't want any compression, you
  // could more or less just output the original bytes as codes (there are
  // some details to this, but it is the idea). In order to achieve
  // compression, values greater then the input range (codes can be up to
  // 12-bit while input only 8-bit) represent a sequence of previously seen
  // inputs. The decompressor is able to build the same mapping while
  // decoding, so there is always a shared common knowledge between the
  // encoding and decoder, which is also important for "timing" aspects like
  // how to handle variable bit width code encoding.
  //
  // One obvious but very important consequence of the table system is there
  // is always a unique id (at most 12-bits) to map the runs. 'A' might be
  // 4, then 'AA' might be 10, 'AAA' 11, 'AAAA' 12, etc. This relationship
  // can be used for an effecient lookup strategy for the code mapping. We
  // need to know if a run has been seen before, and be able to map that run
  // to the output code. Since we start with known unique ids (input bytes),
  // and then from those build more unique ids (table entries), we can
  // continue this chain (almost like a linked list) to always have small
  // integer values that represent the current byte chains in the encoder.
  // This means instead of tracking the input bytes (AAAABCD) to know our
  // current state, we can track the table entry for AAAABC (it is guaranteed
  // to exist by the nature of the algorithm) and the next character D.
  // Therefor the tuple of (table_entry, byte) is guaranteed to also be
  // unique. This allows us to create a simple lookup key for mapping input
  // sequences to codes (table indices) without having to store or search
  // any of the code sequences. So if 'AAAA' has a table entry of 12, the
  // tuple of ('AAAA', K) for any input byte K will be unique, and can be our
  // key. This leads to a integer value at most 20-bits, which can always
  // fit in an SMI value and be used as a fast sparse array / object key.

  // Output code for the current contents of the index buffer.
  var ib_code = index_stream[0] & code_mask;  // Load first input index.
  var code_table = { };  // Key'd on our 20-bit "tuple".

  emit_code(clear_code);  // Spec says first code should be a clear code.

  // First index already loaded, process the rest of the stream.
  for (var i = 1, il = index_stream.length; i < il; ++i) {
    var k = index_stream[i] & code_mask;
    var cur_key = ib_code << 8 | k;  // (prev, k) unique tuple.
    var cur_code = code_table[cur_key];  // buffer + k.

    // Check if we have to create a new code table entry.
    if (cur_code === undefined) {  // We don't have buffer + k.
      // Emit index buffer (without k).
      // This is an inline version of emit_code, because this is the core
      // writing routine of the compressor (and V8 cannot inline emit_code
      // because it is a closure here in a different context). Additionally
      // we can call emit_byte_to_buffer less often, because we can have
      // 30-bits (from our 31-bit signed SMI), and we know our codes will only
      // be 12-bits, so can safely have 18-bits there without overflow.
      // emit_code(ib_code);
      cur |= ib_code << cur_shift;
      cur_shift += cur_code_size;
      while (cur_shift >= 8) {
        buf[p++] = cur & 0xff;
        cur >>= 8; cur_shift -= 8;
        if (p === cur_subblock + 256) {  // Finished a subblock.
          buf[cur_subblock] = 255;
          cur_subblock = p++;
        }
      }

      if (next_code === 4096) {  // Table full, need a clear.
        emit_code(clear_code);
        next_code = eoi_code + 1;
        cur_code_size = min_code_size + 1;
        code_table = { };
      } else {  // Table not full, insert a new entry.
        // Increase our variable bit code sizes if necessary. This is a bit
        // tricky as it is based on "timing" between the encoding and
        // decoder. From the encoders perspective this should happen after
        // we've already emitted the index buffer and are about to create the
        // first table entry that would overflow our current code bit size.
        if (next_code >= (1 << cur_code_size)) ++cur_code_size;
        code_table[cur_key] = next_code++;  // Insert into code table.
      }

      ib_code = k;  // Index buffer to single input k.
    } else {
      ib_code = cur_code;  // Index buffer to sequence in code table.
    }
  }

  emit_code(ib_code);  // There will still be something in the index buffer.
  emit_code(eoi_code);  // End Of Information.

  // Flush / finalize the sub-blocks stream to the buffer.
  emit_bytes_to_buffer(1);

  // Finish the sub-blocks, writing out any unfinished lengths and
  // terminating with a sub-block of length 0. If we have already started
  // but not yet used a sub-block it can just become the terminator.
  if (cur_subblock + 1 === p) {  // Started but unused.
    buf[cur_subblock] = 0;
  } else {  // Started and used, write length and additional terminator block.
    buf[cur_subblock] = p - cur_subblock - 1;
    buf[p++] = 0;
  }
  return p;
}

function GifReader(buf) {
  var p = 0;

  // - Header (GIF87a or GIF89a).
  if (buf[p++] !== 0x47 ||            buf[p++] !== 0x49 || buf[p++] !== 0x46 ||
      buf[p++] !== 0x38 || (buf[p++]+1 & 0xfd) !== 0x38 || buf[p++] !== 0x61) {
    throw "Invalid GIF 87a/89a header.";
  }

  // - Logical Screen Descriptor.
  var width = buf[p++] | buf[p++] << 8;
  var height = buf[p++] | buf[p++] << 8;
  var pf0 = buf[p++];  // <Packed Fields>.
  var global_palette_flag = pf0 >> 7;
  var num_global_colors_pow2 = pf0 & 0x7;
  var num_global_colors = 1 << (num_global_colors_pow2 + 1);
  var background = buf[p++];
  buf[p++];  // Pixel aspect ratio (unused?).

  var global_palette_offset = null;

  if (global_palette_flag) {
    global_palette_offset = p;
    p += num_global_colors * 3;  // Seek past palette.
  }

  var loop_count = null;

  var no_eof = true;

  var frames = [ ];

  var delay = 0;
  var transparent_index = null;
  var disposal = 0;  // 0 - No disposal specified.
  var loop_count = null;

  this.width = width;
  this.height = height;

  while (no_eof && p < buf.length) {
    switch (buf[p++]) {
      case 0x21:  // Graphics Control Extension Block
        switch (buf[p++]) {
          case 0xff:  // Application specific block
            // Try if it's a Netscape block (with animation loop counter).
            if (buf[p   ] !== 0x0b ||  // 21 FF already read, check block size.
                // NETSCAPE2.0
                buf[p+1 ] == 0x4e && buf[p+2 ] == 0x45 && buf[p+3 ] == 0x54 &&
                buf[p+4 ] == 0x53 && buf[p+5 ] == 0x43 && buf[p+6 ] == 0x41 &&
                buf[p+7 ] == 0x50 && buf[p+8 ] == 0x45 && buf[p+9 ] == 0x32 &&
                buf[p+10] == 0x2e && buf[p+11] == 0x30 &&
                // Sub-block
                buf[p+12] == 0x03 && buf[p+13] == 0x01 && buf[p+16] == 0) {
              p += 14;
              loop_count = buf[p++] | buf[p++] << 8;
              p++;  // Skip terminator.
            } else {  // We don't know what it is, just try to get past it.
              p += 12;
              while (true) {  // Seek through subblocks.
                var block_size = buf[p++];
                if (block_size === 0) break;
                p += block_size;
              }
            }
            break;

          case 0xf9:  // Graphics Control Extension
            if (buf[p++] !== 0x4 || buf[p+4] !== 0)
              throw "Invalid graphics extension block.";
            var pf1 = buf[p++];
            delay = buf[p++] | buf[p++] << 8;
            transparent_index = buf[p++];
            if ((pf1 & 1) === 0) transparent_index = null;
            disposal = pf1 >> 2 & 0x7;
            p++;  // Skip terminator.
            break;

          case 0xfe:  // Comment Extension.
            while (true) {  // Seek through subblocks.
              var block_size = buf[p++];
              if (block_size === 0) break;
              // console.log(buf.slice(p, p+block_size).toString('ascii'));
              p += block_size;
            }
            break;

          default:
            throw "Unknown graphic control label: 0x" + buf[p-1].toString(16);
        }
        break;

      case 0x2c:  // Image Descriptor.
        var x = buf[p++] | buf[p++] << 8;
        var y = buf[p++] | buf[p++] << 8;
        var w = buf[p++] | buf[p++] << 8;
        var h = buf[p++] | buf[p++] << 8;
        var pf2 = buf[p++];
        var local_palette_flag = pf2 >> 7;
        var interlace_flag = pf2 >> 6 & 1;
        var num_local_colors_pow2 = pf2 & 0x7;
        var num_local_colors = 1 << (num_local_colors_pow2 + 1);
        var palette_offset = global_palette_offset;
        var has_local_palette = false;
        if (local_palette_flag) {
          var has_local_palette = true;
          palette_offset = p;  // Override with local palette.
          p += num_local_colors * 3;  // Seek past palette.
        }

        var data_offset = p;

        p++;  // codesize
        while (true) {
          var block_size = buf[p++];
          if (block_size === 0) break;
          p += block_size;
        }

        frames.push({x: x, y: y, width: w, height: h,
                     has_local_palette: has_local_palette,
                     palette_offset: palette_offset,
                     data_offset: data_offset,
                     data_length: p - data_offset,
                     transparent_index: transparent_index,
                     interlaced: !!interlace_flag,
                     delay: delay,
                     disposal: disposal});
        break;

      case 0x3b:  // Trailer Marker (end of file).
        no_eof = false;
        break;

      default:
        throw "Unknown gif block: 0x" + buf[p-1].toString(16);
        break;
    }
  }

  this.numFrames = function() {
    return frames.length;
  };

  this.frameInfo = function(frame_num) {
    if (frame_num < 0 || frame_num >= frames.length)
      throw "Frame index out of range.";
    return frames[frame_num];
  }

  this.decodeAndBlitFrameBGRA = function(frame_num, pixels) {
    var frame = this.frameInfo(frame_num);
    var num_pixels = frame.width * frame.height;
    var index_stream = new Uint8Array(num_pixels);  // At most 8-bit indices.
    GifReaderLZWOutputIndexStream(
        buf, frame.data_offset, index_stream, num_pixels);
    var palette_offset = frame.palette_offset;

    // NOTE(deanm): It seems to be much faster to compare index to 256 than
    // to === null. Not sure why, but CompareStub_EQ_STRICT shows up high in
    // the profile, not sure if it's related to using a Uint8Array.
    var trans = frame.transparent_index;
    if (trans === null) trans = 256;

    // We are possibly just blitting to a portion of the entire frame.
    // That is a subrect within the framerect, so the additional pixels
    // must be skipped over after we finished a scanline.
    var framewidth  = frame.width;
    var framestride = width - framewidth;
    var xleft       = framewidth;  // Number of subrect pixels left in
                                    // scanline.

    // Output indicies of the top left and bottom right corners of the subrect.
    var opbeg = ((frame.y * width) + frame.x) * 4;
    var opend = ((frame.y + frame.height) * width + frame.x) * 4;
    var op    = opbeg;

    var scanstride = framestride * 4;

    // Use scanstride to skip past the rows when interlacing. This is skipping
    // 7 rows for the first two passes, then 3 then 1.
    if (frame.interlaced === true) {
      scanstride += (framewidth + framestride) * 4 * 7;  // Pass 1.
    }

    var interlaceskip = 8;  // Tracking the row interval in the current pass.

    for (var i = 0, il = index_stream.length; i < il; ++i) {
      var index = index_stream[i];

      if (xleft === 0) {  // Beginning of new scan line
        op += scanstride;
        xleft = framewidth;
        if (op >= opend) { // Catch the wrap to switch passes when interlacing.
          scanstride =
              framestride + (framewidth + framestride) * 4 * (interlaceskip-1);
          // interlaceskip / 2 * 4 is interlaceskip << 1.
          op = opbeg + (framewidth + framestride) * (interlaceskip << 1);
          interlaceskip >>= 1;
        }
      }

      if (index === trans) {
        op += 4;
      } else {
        var r = buf[palette_offset + index * 3];
        var g = buf[palette_offset + index * 3 + 1];
        var b = buf[palette_offset + index * 3 + 2];
        pixels[op++] = b;
        pixels[op++] = g;
        pixels[op++] = r;
        pixels[op++] = 255;
      }
      --xleft;
    }
  };

  // I will go to copy and paste hell one day...
  this.decodeAndBlitFrameRGBA = function(frame_num, pixels) {
    var frame = this.frameInfo(frame_num);
    var num_pixels = frame.width * frame.height;
    var index_stream = new Uint8Array(num_pixels);  // At most 8-bit indices.
    GifReaderLZWOutputIndexStream(
        buf, frame.data_offset, index_stream, num_pixels);
    var palette_offset = frame.palette_offset;

    // NOTE(deanm): It seems to be much faster to compare index to 256 than
    // to === null. Not sure why, but CompareStub_EQ_STRICT shows up high in
    // the profile, not sure if it's related to using a Uint8Array.
    var trans = frame.transparent_index;
    if (trans === null) trans = 256;

    // We are possibly just blitting to a portion of the entire frame.
    // That is a subrect within the framerect, so the additional pixels
    // must be skipped over after we finished a scanline.
    var framewidth  = frame.width;
    var framestride = width - framewidth;
    var xleft       = framewidth;  // Number of subrect pixels left in
                                    // scanline.

    // Output indicies of the top left and bottom right corners of the subrect.
    var opbeg = ((frame.y * width) + frame.x) * 4;
    var opend = ((frame.y + frame.height) * width + frame.x) * 4;
    var op    = opbeg;

    var scanstride = framestride * 4;

    // Use scanstride to skip past the rows when interlacing. This is skipping
    // 7 rows for the first two passes, then 3 then 1.
    if (frame.interlaced === true) {
      scanstride += (framewidth + framestride) * 4 * 7;  // Pass 1.
    }

    var interlaceskip = 8;  // Tracking the row interval in the current pass.

    for (var i = 0, il = index_stream.length; i < il; ++i) {
      var index = index_stream[i];

      if (xleft === 0) {  // Beginning of new scan line
        op += scanstride;
        xleft = framewidth;
        if (op >= opend) { // Catch the wrap to switch passes when interlacing.
          scanstride =
              framestride + (framewidth + framestride) * 4 * (interlaceskip-1);
          // interlaceskip / 2 * 4 is interlaceskip << 1.
          op = opbeg + (framewidth + framestride) * (interlaceskip << 1);
          interlaceskip >>= 1;
        }
      }

      if (index === trans) {
        op += 4;
      } else {
        var r = buf[palette_offset + index * 3];
        var g = buf[palette_offset + index * 3 + 1];
        var b = buf[palette_offset + index * 3 + 2];
        pixels[op++] = r;
        pixels[op++] = g;
        pixels[op++] = b;
        pixels[op++] = 255;
      }
      --xleft;
    }
  };
}

function GifReaderLZWOutputIndexStream(code_stream, p, output, output_length) {
  var min_code_size = code_stream[p++];

  var clear_code = 1 << min_code_size;
  var eoi_code = clear_code + 1;
  var next_code = eoi_code + 1;

  var cur_code_size = min_code_size + 1;  // Number of bits per code.
  // NOTE: This shares the same name as the encoder, but has a different
  // meaning here. Here this masks each code coming from the code stream.
  var code_mask = (1 << cur_code_size) - 1;
  var cur_shift = 0;
  var cur = 0;

  var op = 0;  // Output pointer.
  
  var subblock_size = code_stream[p++];

  // TODO(deanm): Would using a TypedArray be any faster? At least it would
  // solve the fast mode / backing store uncertainty.
  // var code_table = Array(4096);
  var code_table = new Int32Array(4096);  // Can be signed, we only use 20 bits.

  var prev_code = null;  // Track code-1.

  while (true) {
    // Read up to two bytes, making sure we always 12-bits for max sized code.
    while (cur_shift < 16) {
      if (subblock_size === 0) break;  // No more data to be read.

      cur |= code_stream[p++] << cur_shift;
      cur_shift += 8;

      if (subblock_size === 1) {  // Never let it get to 0 to hold logic above.
        subblock_size = code_stream[p++];  // Next subblock.
      } else {
        --subblock_size;
      }
    }

    // TODO(deanm): We should never really get here, we should have received
    // and EOI.
    if (cur_shift < cur_code_size)
      break;

    var code = cur & code_mask;
    cur >>= cur_code_size;
    cur_shift -= cur_code_size;

    // TODO(deanm): Maybe should check that the first code was a clear code,
    // at least this is what you're supposed to do. But actually our encoder
    // now doesn't emit a clear code first anyway.
    if (code === clear_code) {
      // We don't actually have to clear the table. This could be a good idea
      // for greater error checking, but we don't really do any anyway. We
      // will just track it with next_code and overwrite old entries.

      next_code = eoi_code + 1;
      cur_code_size = min_code_size + 1;
      code_mask = (1 << cur_code_size) - 1;

      // Don't update prev_code ?
      prev_code = null;
      continue;
    } else if (code === eoi_code) {
      break;
    }

    // We have a similar situation as the decoder, where we want to store
    // variable length entries (code table entries), but we want to do in a
    // faster manner than an array of arrays. The code below stores sort of a
    // linked list within the code table, and then "chases" through it to
    // construct the dictionary entries. When a new entry is created, just the
    // last byte is stored, and the rest (prefix) of the entry is only
    // referenced by its table entry. Then the code chases through the
    // prefixes until it reaches a single byte code. We have to chase twice,
    // first to compute the length, and then to actually copy the data to the
    // output (backwards, since we know the length). The alternative would be
    // storing something in an intermediate stack, but that doesn't make any
    // more sense. I implemented an approach where it also stored the length
    // in the code table, although it's a bit tricky because you run out of
    // bits (12 + 12 + 8), but I didn't measure much improvements (the table
    // entries are generally not the long). Even when I created benchmarks for
    // very long table entries the complexity did not seem worth it.
    // The code table stores the prefix entry in 12 bits and then the suffix
    // byte in 8 bits, so each entry is 20 bits.

    var chase_code = code < next_code ? code : prev_code;

    // Chase what we will output, either {CODE} or {CODE-1}.
    var chase_length = 0;
    var chase = chase_code;
    while (chase > clear_code) {
      chase = code_table[chase] >> 8;
      ++chase_length;
    }

    var k = chase;
    
    var op_end = op + chase_length + (chase_code !== code ? 1 : 0);
    if (op_end > output_length) {
      console.log("Warning, gif stream longer than expected.");
      return;
    }

    // Already have the first byte from the chase, might as well write it fast.
    output[op++] = k;

    op += chase_length;
    var b = op;  // Track pointer, writing backwards.

    if (chase_code !== code)  // The case of emitting {CODE-1} + k.
      output[op++] = k;

    chase = chase_code;
    while (chase_length--) {
      chase = code_table[chase];
      output[--b] = chase & 0xff;  // Write backwards.
      chase >>= 8;  // Pull down to the prefix code.
    }

    if (prev_code !== null && next_code < 4096) {
      code_table[next_code++] = prev_code << 8 | k;
      // TODO(deanm): Figure out this clearing vs code growth logic better. I
      // have an feeling that it should just happen somewhere else, for now it
      // is awkward between when we grow past the max and then hit a clear code.
      // For now just check if we hit the max 12-bits (then a clear code should
      // follow, also of course encoded in 12-bits).
      if (next_code >= code_mask+1 && cur_code_size < 12) {
        ++cur_code_size;
        code_mask = code_mask << 1 | 1;
      }
    }

    prev_code = code;
  }

  if (op !== output_length) {
    console.log("Warning, gif stream shorter than expected.");
  }

  return output;
}

try { exports.GifWriter = GifWriter; exports.GifReader = GifReader } catch(e) { }  // CommonJS.
