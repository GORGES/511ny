//  file: 511ny.c
//  Copyright (C)2016 Matthew Clark
//  created for DevPost #HackFrost

#include <pebble.h>

//  constants

#define kMaxEvents 20
#define kBlocks 8
const int kAbsoluteZero10 = -2731;                    //  absolute zero times 10
const int kLogoHeight = PBL_IF_RECT_ELSE(30, 52);     //  logo height
const int kPacketMax = PBL_IF_COLOR_ELSE(2000, 1536); //  max packet size
const int kRefreshWeather = 15 * 60;                  //  weather update
const int kScrollHorizontalPadding = 4;               //  pixel padding
const int kScrollMax = 4000;                          //  maximum size
const int kScrollRepeat = 125;                        //  repeated scroll
const int kMaxPackets = 12;                           //  maximum packets to store
const int kSyncErrorDelay = 500;                      //  sync error delay
const int kSyncSettingsDelay = 3000;                  //  settings delay
const int kSyncShortDelay = 100;                      //  short sync delay
const int kMaxFailures = 6;                           //  sync failures
const int kToastShow = 300;                           //  time to display toast
const int kToastHide = 2500;                          //  time to hide toast
const int kZoomDefault = 12;                          //  default zoom
const int kZoomMin = 2;                               //  minimum zoom value
const int kZoomMax = 18;                              //  maximum zoom value
const int kScrollVerticalPadding = 4;                 //  pixel padding
enum { tuple_action = 1, tuple_data, tuple_id };
enum { persist_weather = 100, persist_location, persist_size, persist_refresh, persist_zoom };
enum { action_none = 0, action_init, action_reload, action_event, action_image, action_map, action_zoom, action_weather };
enum { data_none = 0, data_weather, data_location, data_map, data_events, data_event, data_cameras, data_image, data_error };
enum { setting_size = 0, setting_refresh, setting_count };
const char* kUpdatingText = "Updating...";
const char* kRefreshingText = "Refreshing...";
const char* kAboutText = "Created for DevPost #HackFrost by Geoffrey Clark and Matthew Clark\nFebruary, 2016";
const char* kFontSizes[] = { FONT_KEY_GOTHIC_18, FONT_KEY_GOTHIC_24, FONT_KEY_GOTHIC_14 };
const char* kMenuSettings[] = { "Text Size", "Auto Refresh" };
const char* kSettingsValues[][3] = { { "medium", "large", "small" }, { "on", "off" } };
const char* kWindDirections[] = { "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW" };
#ifdef PBL_COLOR
#define kMaxCameras 20
enum { main_weather = 0, main_events, main_cameras, main_map, main_reload, main_settings, main_about };
const char* kMenuMain[] = { "Weather", "Road Hazards", "Cameras", "Map", "Reload", "Settings", "About" };
const uint8_t kMainIcons[] = {
    RESOURCE_ID_WEATHER_00, RESOURCE_ID_MAIN_HAZARD, RESOURCE_ID_MAIN_CAMERA, RESOURCE_ID_MAIN_MAP, RESOURCE_ID_MAIN_REFRESH,
    RESOURCE_ID_MAIN_SETTINGS, RESOURCE_ID_MAIN_ABOUT };
#else
enum { main_weather = 0, main_events, main_reload, main_settings, main_about };
const char* kMenuMain[] = { "Weather", "Road Hazards", "Reload", "Settings", "About" };
const uint8_t kMainIcons[] = {
    RESOURCE_ID_WEATHER_00, RESOURCE_ID_MAIN_HAZARD, RESOURCE_ID_MAIN_REFRESH, RESOURCE_ID_MAIN_SETTINGS, RESOURCE_ID_MAIN_ABOUT };
#endif
const uint8_t kWeatherIcons[] = {
    RESOURCE_ID_WEATHER_00, RESOURCE_ID_WEATHER_01, RESOURCE_ID_WEATHER_02, RESOURCE_ID_WEATHER_03, RESOURCE_ID_WEATHER_04,
    RESOURCE_ID_WEATHER_05, RESOURCE_ID_WEATHER_06, RESOURCE_ID_WEATHER_07, RESOURCE_ID_WEATHER_08, RESOURCE_ID_WEATHER_09,
    RESOURCE_ID_WEATHER_10, RESOURCE_ID_WEATHER_11, RESOURCE_ID_WEATHER_12 };
const uint8_t kEventIcons[] = {
    RESOURCE_ID_EVENT_UNKNOWN, RESOURCE_ID_EVENT_ACCIDENT, RESOURCE_ID_EVENT_ROADWORK, RESOURCE_ID_EVENT_SPECIAL,
    RESOURCE_ID_EVENT_CLOSURE, RESOURCE_ID_EVENT_TRANSIT, RESOURCE_ID_EVENT_GENERAL, RESOURCE_ID_EVENT_WINTER};
const uint8_t kSettingsIcons[] = {
    RESOURCE_ID_SETTING_SIZE, RESOURCE_ID_SETTING_REFRESH };
#define MIN(a,b) (((a)<=(b))?(a):(b))
#define MAX(a,b) (((a)>=(b))?(a):(b))

//  types

typedef void (*SyncTupleCallback)(const uint32_t key, const Tuple *tuple_new);
typedef void (*SyncErrorCallback)(DictionaryResult dict_error, AppMessageResult app_message_error);
typedef struct {
  Tuplet tuplet;
  uint8_t data[16];
} Packet;
typedef struct __attribute__((__packed__)) {
  uint16_t id, roadway, description, distance;
  uint8_t type;
} Event;
#ifdef PBL_COLOR
typedef struct __attribute__((__packed__)) {
  uint16_t id, roadway, name, distance;
} Camera;
#endif

//  variables

static Window* window_main, * window_weather, * window_map, * window_events, * window_event, * window_settings, * window_about;
static MenuLayer* menu_main, * menu_events, * menu_settings;
static Layer* layer_main, * layer_about;
static ScrollLayer* scroll_weather, * scroll_event;
static TextLayer* text_weather, * text_event, * text_toast;
static int n_temperature, n_weather, n_humidity, n_pressure, n_wind_speed, n_wind_direction, n_zoom, n_events, n_menu_events, n_menu_settings, n_failures, n_packets;
static time_t seconds_reload, seconds_weather, seconds_sunrise, seconds_sunset;
static char str_temp[64], str_city[32], str_description[32], str_weather[364], str_location[32], str_id[32], str_event[512];
static bool b_weather, b_in_transit;
static Event events[kMaxEvents];
static uint8_t* p_event_strings, * p_buffer;
static PropertyAnimation* animation_toast = NULL;
#ifdef PBL_RECT
static GRect kToastUp = { {0, -22}, {144, 22} }, kToastDown = { {0, -2}, {144, 22} };
#else
static GRect kToastUp = { {0, -27}, {180, 27} }, kToastDown = { {0, 4}, {180, 27} };
#endif
static Packet* packets;
static AppSync app_sync;
static AppTimer* timer_sync;
#ifdef PBL_COLOR
static Window* window_cameras, * window_image;
static Layer* layer_map, * layer_image;
static GBitmap* bitmap_images[kBlocks];
static MenuLayer* menu_cameras;
static char str_name[32], str_distance[32];
static int n_menu_cameras, n_cameras,n_image_last;
static uint8_t* p_camera_strings;
static Camera cameras[kMaxCameras];
#endif
static enum { size_medium = 0, size_large, size_small, size_count } size;
static enum { refresh_on = 0, refresh_off, refresh_count } refresh;

//  sync

static void sync_pop(void) {
  //  check packet queue
  if (n_packets > 0) {
    //  set new pointer
    Packet* packets_new = NULL;
    //  decrement tuple count to remove message
    if (n_packets > 1) {
      //  reduce memory
      packets_new = malloc((n_packets - 1) * sizeof(Packet));
      if (packets_new)
        memmove(packets_new, &packets[1], (n_packets - 1) * sizeof(Packet));
      else  //  unable to allocate - free it all
        n_packets = 1;
    }
    //  free memory
    free(packets);
    //  reduce packets
    n_packets--;
    //  set new pointer
    packets = packets_new;
    //  reset failure count
    n_failures = 0;
  }
}

int sync_get16(const uint8_t* data) {
  return (data[0] << 8) | data[1];
}

int sync_get32(const uint8_t* data) {
  return (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
}

void sync_gets(char* str, int size, const uint8_t* data, int len) {
  memset(str, '\0', size);
  memmove(str, data, (len < size) ? len : size - 1);
}

void sync_send(void) {
  //  check queue and transit flag
  if ((n_packets > 0) && !b_in_transit) {
    //  cancel timer since we are sending now
    if (timer_sync) {
      app_timer_cancel(timer_sync);
      timer_sync = NULL;
    }
    //  local storage request
    DictionaryIterator *iter;
    AppMessageResult app_result = app_message_outbox_begin(&iter);
    if (app_result == APP_MSG_OK) {
      //  send tuple (possibly)
      Tuplet* tuplet = &packets[0].tuplet;
      if (tuplet->key) {
        if (tuplet->type == TUPLE_BYTE_ARRAY)
          tuplet->bytes.data = &packets[0].data[0];
        dict_write_tuplet(iter, tuplet);
      }
      dict_write_end(iter);
      //  send message
      if ((app_result = app_message_outbox_send()) == APP_MSG_OK)
        //  set transit flag
        b_in_transit = true;
    }
  }
}

void sync_timer_callback(void* context) {
  //  clear timer (automatically cancelled)
  timer_sync = NULL;
  //  check failures
  if (n_failures < kMaxFailures)
    //  check for tuple to send
    sync_send();
  //  too many failures - remove tuple from queue
  else {
    sync_pop();
  }
}

void sync_sent_callback(DictionaryIterator* iterator, void* context) {
  //  no longer in transit
  b_in_transit = false;
  //  remove from queue
  sync_pop();
  //  reset failure counter
  n_failures = 0;
  //  send another tuple after a short delay
  if (n_packets > 0) {
    if (timer_sync)
      app_timer_reschedule(timer_sync, kSyncShortDelay);
    else
      timer_sync = app_timer_register(kSyncShortDelay, sync_timer_callback, NULL);
  }
}

void sync_failed_callback(DictionaryIterator *iterator, AppMessageResult reason, void *context) {
  //  no longer in transit
  b_in_transit = false;
  //  remove message if failure count too high
  if (++n_failures <= kMaxFailures) {
    //  resend this after an error delay
    if (timer_sync)
      app_timer_reschedule(timer_sync, kSyncErrorDelay);
    else
      timer_sync = app_timer_register(kSyncErrorDelay, sync_timer_callback, NULL);
  //  too many failures - remove from queue
  } else
    sync_pop();
}

void sync_push_tuplet(const Tuplet* tuplet) {
  if (n_packets < kMaxPackets) {
    //  create space
    Packet* packets_new = malloc((n_packets + 1) * sizeof(Packet));
    if (packets_new) {
      //  copy existing packets
      if (n_packets) {
        memmove(packets_new, packets, n_packets * sizeof(Packet));
        free(packets);
      }
      //  copy tuplet and reference data (16 bytes max)
      memset(&packets_new[n_packets], '\0', sizeof(Packet));
      if (tuplet) {
        memmove(&packets_new[n_packets].tuplet, tuplet, sizeof(packets[0].tuplet));
        if (tuplet->type == TUPLE_BYTE_ARRAY)
          memmove(&packets_new[n_packets].data, tuplet->bytes.data, sizeof(packets[0].data));
      }
      //  replace pointer
      packets = packets_new;
      //  increment tuplet counter (after setting tuplet)
      n_packets++;
    }
  }
}

void sync_message(const Tuplet* tuplet) {
  //  make room - remove earlier tuplets
  if (n_packets >= kMaxPackets)
    sync_pop();
  //  append tuplet to queue
  sync_push_tuplet(tuplet);
  //  send first queue item now unless a message is in transit
  if (!b_in_transit)
    sync_send();
}

void sync_schedule(const Tuplet* tuplet, int delay) {
  //  make room - remove earlier tuplets
  if (n_packets >= kMaxPackets)
    sync_pop();
  //  append tuplet to queue
  sync_push_tuplet(tuplet);
  //  send first queue item now unless a message is in transit
  if (!b_in_transit) {
    if (timer_sync)
      app_timer_reschedule(timer_sync, delay);
    else
      timer_sync = app_timer_register(delay, sync_timer_callback, NULL);
  }
}

bool sync_set_tuples(int n_tuples, const Tuplet* tuplets) {
  AppMessageResult app_result = app_sync_set(&app_sync, tuplets, n_tuples);
  return (app_result == APP_MSG_OK);
}

//  layer helpers

Window* my_window_create(WindowHandlers window_handlers) {
  Window* window = window_create();
  window_set_background_color(window, GColorWhite);
  window_set_window_handlers(window, window_handlers);
  window_stack_push(window, true);
  return window;
}

void draw_bitmap(GContext* context, int n_resource, int x, int y) {
  GBitmap* bitmap_icon = gbitmap_create_with_resource(n_resource);
  GSize size_icon = gbitmap_get_bounds(bitmap_icon).size;
  graphics_context_set_compositing_mode(context, GCompOpSet);
  graphics_draw_bitmap_in_rect(context, bitmap_icon, GRect(x, y, size_icon.w, size_icon.h));
  gbitmap_destroy(bitmap_icon);
}

void seconds_to_time(char* str_seconds, time_t seconds) {
  if (seconds) {
    struct tm* tm = localtime(&seconds);
    strftime(str_seconds, 8, clock_is_24h_style() ? "%H:%M" : "%l:%M%P", tm);
    if ((*str_seconds == ' ') || (*str_seconds == '0'))
      memmove(str_seconds, &str_seconds[1], strlen(str_seconds));   //  include trailing null character
  } else
    str_seconds[0] = '\0';
}

//  menu helpers

MenuLayer* menu_create(Window* window, MenuLayerCallbacks menu_callbacks) {
#ifdef PBL_ROUND
  window_set_background_color(window, GColorOxfordBlue);
  MenuLayer* menu_layer = menu_layer_create(grect_inset(layer_get_bounds(window_get_root_layer(window)), GEdgeInsets(STATUS_BAR_LAYER_HEIGHT, 0)));
#else
  MenuLayer* menu_layer = menu_layer_create(layer_get_bounds(window_get_root_layer(window)));
#endif
  menu_layer_set_callbacks(menu_layer, NULL, menu_callbacks);
  menu_layer_set_click_config_onto_window(menu_layer, window);
#ifdef PBL_ROUND
  menu_layer_set_center_focused(menu_layer, true);
  menu_layer_set_normal_colors(menu_layer, GColorOxfordBlue, GColorWhite);
  menu_layer_set_highlight_colors(menu_layer, GColorWhite, GColorOxfordBlue);
#elif PBL_COLOR
  menu_layer_set_normal_colors(menu_layer, GColorWhite, GColorOxfordBlue);
  menu_layer_set_highlight_colors(menu_layer, GColorOxfordBlue, GColorWhite);
#endif
  layer_add_child(window_get_root_layer(window), menu_layer_get_layer(menu_layer));
  return menu_layer;
}

#ifdef PBL_ROUND
int16_t menu_get_cell_height(struct MenuLayer *menu_layer, MenuIndex* cell_index, void* callback_context) {
  return menu_layer_is_index_selected(menu_layer, cell_index)
           ? MENU_CELL_ROUND_FOCUSED_TALL_CELL_HEIGHT
           : MENU_CELL_ROUND_UNFOCUSED_SHORT_CELL_HEIGHT;
}
#endif

void menu_draw(GContext* context, const Layer* cell_layer, const char* str_heading, const char* str_value, uint8_t n_resource) {
  GBitmap* bitmap_menu = n_resource ? gbitmap_create_with_resource(n_resource) : NULL;
   menu_cell_basic_draw(context, cell_layer, str_heading, str_value, bitmap_menu);
   if (bitmap_menu)
     gbitmap_destroy(bitmap_menu);
}

//  toast functions

void toast_stopped(struct Animation* animation, bool finished, void* context) {
  animation_toast = NULL;
}

void toast_shown(struct Animation* animation, bool finished, void* context) {
  animation_toast = property_animation_create_layer_frame(text_layer_get_layer(text_toast), NULL, &kToastUp);
  animation_set_duration(property_animation_get_animation(animation_toast), kToastHide);
  animation_set_curve(property_animation_get_animation(animation_toast), AnimationCurveEaseIn);
  animation_set_handlers(property_animation_get_animation(animation_toast), (AnimationHandlers) {
    .stopped = toast_stopped
  }, NULL);
  animation_schedule(property_animation_get_animation(animation_toast));
}

static void toast_show(const char* message, bool b_large) {
  //  stop any partially-started animation
  if (animation_toast) {
    if (animation_is_scheduled(property_animation_get_animation(animation_toast)))
      animation_unschedule(property_animation_get_animation(animation_toast));
    property_animation_destroy(animation_toast);
  }
  //  check toast objects
  if (text_toast) {
    //  relocate toast
    layer_set_frame(text_layer_get_layer(text_toast), kToastUp);
    //  check parent window
    Window* window_top = window_stack_get_top_window();
    if (layer_get_window(text_layer_get_layer(text_toast)) != window_top) {
      layer_remove_from_parent(text_layer_get_layer(text_toast));
      layer_add_child(window_get_root_layer(window_top), text_layer_get_layer(text_toast));
    }
    //  set toast text
    text_layer_set_text(text_toast, message);
    text_layer_set_font(text_toast, fonts_get_system_font(b_large ? FONT_KEY_GOTHIC_18_BOLD : FONT_KEY_GOTHIC_14));
    //  setup status display
    layer_set_frame(text_layer_get_layer(text_toast), kToastUp);
    //  animate
    animation_toast = property_animation_create_layer_frame(text_layer_get_layer(text_toast), NULL, &kToastDown);
    animation_set_duration(property_animation_get_animation(animation_toast), kToastShow);
    animation_set_curve(property_animation_get_animation(animation_toast), AnimationCurveEaseOut);
    animation_set_handlers(property_animation_get_animation(animation_toast), (AnimationHandlers) {
      .stopped = toast_shown
    }, NULL);
    animation_schedule(property_animation_get_animation(animation_toast));
  }
}

static void toast_unload() {
  if (animation_toast) {
    if (animation_is_scheduled(property_animation_get_animation(animation_toast)))
      animation_unschedule(property_animation_get_animation(animation_toast));
    property_animation_destroy(animation_toast);
    animation_toast = NULL;
  }
}

//  about

void about_update(Layer* layer, GContext* context) {
  GRect rect = layer_get_bounds(layer);
  //  draw logo
  draw_bitmap(context, RESOURCE_ID_IMAGE_LOGO, (rect.size.w - 94) / 2, PBL_IF_RECT_ELSE(10, 16));
  //  about text
  graphics_context_set_text_color(context, GColorBlack);
  graphics_draw_text(context, kAboutText, fonts_get_system_font(FONT_KEY_GOTHIC_24),
                     GRect(0, PBL_IF_RECT_ELSE(34, 40), rect.size.w, rect.size.h),
                     GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
}

void about_load(Window* window) {
  Layer* layer_root = window_get_root_layer(window);
  GRect rect = layer_get_bounds(layer_root);
  //  about layer
  layer_about = layer_create(rect);
  layer_set_update_proc(layer_about, about_update);
  layer_add_child(layer_root, layer_about);
}

void about_unload(Window* window) {
  //  free layers
  layer_destroy(layer_about);
  //  free window memory
  window_destroy(window);
  window_about = NULL;
}

//  settings

uint16_t settings_get_num_rows(MenuLayer* menu, uint16_t section_index, void* data) {
  return setting_count;
}

void settings_draw_row(GContext* context, const Layer* cell_layer, MenuIndex* cell_index, void* data) {
  int n_value = 0;
  switch (cell_index->row) {
    case setting_size:
      n_value = size;
      break;
    case setting_refresh:
      n_value = refresh;
      break;
  }
  GBitmap* bitmap_icon = gbitmap_create_with_resource(kSettingsIcons[cell_index->row]);
  graphics_context_set_compositing_mode(context, GCompOpSet);
  menu_cell_basic_draw(context, cell_layer, kMenuSettings[cell_index->row], kSettingsValues[cell_index->row][n_value], bitmap_icon);
  gbitmap_destroy(bitmap_icon);
}

void settings_select(MenuLayer* menu, MenuIndex* cell_index, void* data) {
  //  update setting
  switch (cell_index->row) {
    case setting_size:
      size = (size + 1) % size_count;
      persist_write_int(persist_size, size);
      break;
    case setting_refresh:
      refresh = (refresh + 1) % refresh_count;
      persist_write_int(persist_refresh, refresh);
      break;
  }
  //  redraw
  layer_mark_dirty(menu_layer_get_layer(menu_settings));
}

void settings_load(Window* window) {
  //  settings menu
  menu_settings = menu_create(window, (MenuLayerCallbacks) {
    .get_num_rows = settings_get_num_rows,
#ifdef PBL_ROUND
    .get_cell_height = menu_get_cell_height,
#endif
    .draw_row = settings_draw_row,
    .select_click = settings_select
  });
  menu_layer_set_selected_index(menu_settings, (MenuIndex) { .section = 0, .row = n_menu_settings }, MenuRowAlignCenter, false);
}

void settings_unload(Window* window) {
  //  remember selection
  n_menu_settings = menu_layer_get_selected_index(menu_settings).row;
  //  free menu layer
  menu_layer_destroy(menu_settings);
  //  free window memory
  window_destroy(window_settings);
  window_settings = NULL;
}

//  weather

void weather_refresh(void) {
  if (b_weather) {
    //  set text
    text_layer_set_text(text_weather, str_weather);
    //  resize
    scroll_layer_set_content_size(scroll_weather, text_layer_get_content_size(text_weather));
#ifdef PBL_ROUND
    text_layer_enable_screen_text_flow_and_paging(text_weather, 2);
    scroll_layer_set_paging(scroll_weather, true);
#endif
  }
}

void weather_button_handler(ClickRecognizerRef recognizer, void* context) {
  if (click_recognizer_get_button_id(recognizer) == BUTTON_ID_UP)
    scroll_layer_scroll_up_click_handler(recognizer, scroll_weather);
  else if (click_recognizer_get_button_id(recognizer) == BUTTON_ID_DOWN)
    scroll_layer_scroll_down_click_handler(recognizer, scroll_weather);
  else if (click_recognizer_get_button_id(recognizer) == BUTTON_ID_SELECT) {
    sync_message(&TupletInteger(tuple_action, 100 * action_weather));
    toast_show(kUpdatingText, true);
  }
}

void weather_config_provider(void* context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, weather_button_handler);
  window_single_click_subscribe(BUTTON_ID_UP, weather_button_handler);
  window_single_repeating_click_subscribe(BUTTON_ID_UP, kScrollRepeat, weather_button_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, weather_button_handler);
  window_single_repeating_click_subscribe(BUTTON_ID_DOWN, kScrollRepeat, weather_button_handler);

}

void weather_load(Window* window) {
  Layer* layer_root = window_get_root_layer(window);
  GRect rect = layer_get_bounds(layer_root);
  //  weather
  scroll_weather = scroll_layer_create(rect);
  scroll_layer_set_content_size(scroll_weather, GSize(rect.size.w, kScrollMax));
  window_set_click_config_provider(window, weather_config_provider);
  text_weather = text_layer_create(GRect(kScrollHorizontalPadding, 0, rect.size.w - 2 * kScrollHorizontalPadding, kScrollMax));
  text_layer_set_background_color(text_weather, GColorClear);
  text_layer_set_text_color(text_weather, PBL_IF_COLOR_ELSE(GColorOxfordBlue, GColorBlack));
  text_layer_set_font(text_weather, fonts_get_system_font(kFontSizes[size]));
  text_layer_set_text_alignment(text_weather, PBL_IF_RECT_ELSE(GTextAlignmentLeft, GTextAlignmentCenter));
  scroll_layer_add_child(scroll_weather, text_layer_get_layer(text_weather));
  layer_add_child(layer_root, scroll_layer_get_layer(scroll_weather));
  //  set text
  weather_refresh();
}

void weather_unload(Window* window) {
  //  free layers
  scroll_layer_destroy(scroll_weather);
  text_layer_destroy(text_weather);
  //  free window memory
  window_destroy(window);
  window_weather = NULL;
}

//  map

#ifdef PBL_COLOR
void map_update(Layer* layer, GContext* context) {
  GRect rect = layer_get_bounds(layer);
  //  display map
  graphics_context_set_compositing_mode(context, GCompOpSet);
  for (int i = 0;  i < kBlocks;  i++)
    if (bitmap_images[i] && gbitmap_get_bytes_per_row(bitmap_images[i]))
      graphics_draw_bitmap_in_rect(context, bitmap_images[i], GRect(0, (i * rect.size.h) / kBlocks, rect.size.w, rect.size.h / kBlocks));
    else {
      graphics_context_set_fill_color(context, GColorWhite);
      graphics_fill_rect(context, GRect(0, (i * rect.size.h) / kBlocks, rect.size.w, rect.size.h / kBlocks), 0, GCornerNone);
    }
}

void map_button_handler(ClickRecognizerRef recognizer, void* context) {
  if ((click_recognizer_get_button_id(recognizer) == BUTTON_ID_UP) && (n_zoom < kZoomMax)) {
    sync_message(&TupletInteger(tuple_action, 100 * action_zoom + ++n_zoom));
    persist_write_int(persist_zoom, n_zoom);
  } else if ((click_recognizer_get_button_id(recognizer) == BUTTON_ID_DOWN) && (n_zoom > kZoomMin)) {
    sync_message(&TupletInteger(tuple_action, 100 * action_zoom + --n_zoom));
    persist_write_int(persist_zoom, n_zoom);
  } else if (click_recognizer_get_button_id(recognizer) == BUTTON_ID_SELECT) {
    sync_message(&TupletInteger(tuple_action, 100 * action_map + n_zoom));
    toast_show(kUpdatingText, true);
  }
}

void map_config_provider(void* context) {
  window_single_click_subscribe(BUTTON_ID_UP, map_button_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, map_button_handler);
  window_single_click_subscribe(BUTTON_ID_SELECT, map_button_handler);
}

void map_load(Window* window) {
  Layer* layer_root = window_get_root_layer(window);
  GRect rect = layer_get_bounds(layer_root);
#ifdef PBL_ROUND
  rect = grect_inset(rect, GEdgeInsets(2, 2));
#endif
  //  create layer
  layer_map = layer_create(rect);
  layer_set_update_proc(layer_map, map_update);
  layer_add_child(layer_root, layer_map);
  //  add click config
  window_set_click_config_provider(window, map_config_provider);
  //  request map
  sync_message(&TupletInteger(tuple_action, 100 * action_zoom + n_zoom));
}

void map_unload(Window* window) {
  //  free layers
  layer_destroy(layer_map);
  layer_map = NULL;
  //  free window memory
  window_destroy(window);
  window_map = NULL;
}
#endif

//  event window

void event_refresh(void) {
  //  set text
  text_layer_set_text(text_event, str_event);
  //  resize
  scroll_layer_set_content_size(scroll_event, text_layer_get_content_size(text_event));
#ifdef PBL_ROUND
  text_layer_enable_screen_text_flow_and_paging(text_event, 2);
  scroll_layer_set_paging(scroll_event, true);
#endif
}

void event_load(Window* window) {
  Layer* layer_root = window_get_root_layer(window);
  GRect rect = layer_get_bounds(layer_root);
  //  instructions
  scroll_event = scroll_layer_create(rect);
  scroll_layer_set_content_size(scroll_event, GSize(rect.size.w, kScrollMax));
  scroll_layer_set_click_config_onto_window(scroll_event, window);
  text_event = text_layer_create(GRect(kScrollHorizontalPadding, 0, rect.size.w - 2 * kScrollHorizontalPadding, kScrollMax));
  text_layer_set_background_color(text_event, GColorClear);
  text_layer_set_text_color(text_event, PBL_IF_COLOR_ELSE(GColorOxfordBlue, GColorBlack));
  text_layer_set_font(text_event, fonts_get_system_font(kFontSizes[size]));
  text_layer_set_text_alignment(text_event, PBL_IF_RECT_ELSE(GTextAlignmentLeft, GTextAlignmentCenter));
  scroll_layer_add_child(scroll_event, text_layer_get_layer(text_event));
  layer_add_child(layer_root, scroll_layer_get_layer(scroll_event));
  //  paging
#ifdef PBL_ROUND
  text_layer_enable_screen_text_flow_and_paging(text_event, 2);
  scroll_layer_set_paging(scroll_event, true);
#endif
  //  set text
  event_refresh();
}

void event_unload(Window* window) {
  //  free layers
  scroll_layer_destroy(scroll_event);
  text_layer_destroy(text_event);
  //  free window memory
  window_destroy(window);
  window_event = NULL;
}

//  events window

uint16_t events_get_num_rows(MenuLayer* menu, uint16_t section_index, void* data) {
  return n_events;
}

void events_draw_row(GContext* context, const Layer* cell_layer, MenuIndex* cell_index, void* data) {
  if (cell_index->row < n_events) {
    const Event* event = events + cell_index->row;
    //  roadway
    memset(str_temp, 0, sizeof(str_temp));
    memcpy(str_temp, &p_event_strings[event->roadway + 1], p_event_strings[event->roadway]);
    //  distance
    char str_distance[24];
    if (event->distance % 10)
      snprintf(str_distance, sizeof(str_distance), "%d.%d miles", event->distance / 10, event->distance % 10);
    else
      snprintf(str_distance, sizeof(str_distance), "%d mile%s", event->distance / 10, (event->distance == 1) ? "" : "s");
    //  add ICON and SECOND LINE
    menu_draw(context, cell_layer, str_temp, str_distance, kEventIcons[event->type % ARRAY_LENGTH(kEventIcons)]);
  }
}

void events_select(MenuLayer* menu, MenuIndex* cell_index, void* data) {
  if (cell_index->row < n_events) {
    const Event* event = events + cell_index->row;
    //  create event window
    window_event = my_window_create((WindowHandlers) { .load = event_load, .unload = event_unload });
    //  identifier
    memset(str_id, 0, sizeof(str_id));
    memcpy(str_id, &p_event_strings[event->id + 1], p_event_strings[event->id]);
    //  request event
    Tuplet tuples[] = {
      TupletInteger(tuple_action, 100 * action_event),
      TupletCString(tuple_id, &str_id[0]) };
    sync_set_tuples(2, tuples);
  }
}

void events_load(Window* window) {
  menu_events = menu_create(window, (MenuLayerCallbacks) {
    .get_num_rows = events_get_num_rows,
#ifdef PBL_ROUND
    .get_cell_height = menu_get_cell_height,
#endif
    .draw_row = events_draw_row,
    .select_click = events_select
  });
  menu_layer_set_selected_index(menu_events, (MenuIndex) { .section = 0, .row = n_menu_events }, MenuRowAlignCenter, false);
}

void events_unload(Window* window) {
  //  remember selection
  n_menu_events = menu_layer_get_selected_index(menu_events).row;
  //  free menu layer
  menu_layer_destroy(menu_events);
  //  free window memory
  window_destroy(window);
  window_events = NULL;
}

//  image

#ifdef PBL_COLOR
void image_reset(int n_image_new) {
  if (n_image_last != n_image_new) {
    n_image_last= n_image_new;
    for (int i = 0;  i < kBlocks;  i++)
      if (bitmap_images[i]) {
        gbitmap_destroy(bitmap_images[i]);
        bitmap_images[i] = NULL;
      }
    bitmap_images[PBL_IF_RECT_ELSE(2, 3)] = gbitmap_create_with_resource(RESOURCE_ID_LOADING_TOP);
    bitmap_images[PBL_IF_RECT_ELSE(3, 4)] = gbitmap_create_with_resource(RESOURCE_ID_LOADING_BOTTOM);
  }
}

void image_update(Layer* layer, GContext* context) {
  GRect rect = layer_get_bounds(layer);
  //  display image
  graphics_context_set_compositing_mode(context, GCompOpSet);
  for (int i = 0;  i < kBlocks;  i++)
    if (bitmap_images[i] && gbitmap_get_bytes_per_row(bitmap_images[i]))
      graphics_draw_bitmap_in_rect(context, bitmap_images[i], GRect(0, (i * rect.size.h) / kBlocks, rect.size.w, rect.size.h / kBlocks));
    else {
      graphics_context_set_fill_color(context, GColorWhite);
      graphics_fill_rect(context, GRect(0, (i * rect.size.h) / kBlocks, rect.size.w, rect.size.h / kBlocks), 0, GCornerNone);
    }
}

void image_button_handler(ClickRecognizerRef recognizer, void* context) {
  if (click_recognizer_get_button_id(recognizer) == BUTTON_ID_UP)
    toast_show(str_name, false);
  else if (click_recognizer_get_button_id(recognizer) == BUTTON_ID_DOWN)
    toast_show(str_distance, false);
  else if (click_recognizer_get_button_id(recognizer) == BUTTON_ID_SELECT) {
    //  request camera
    Tuplet tuples[] = {
      TupletInteger(tuple_action, 100 * action_image),
      TupletCString(tuple_id, &str_id[0]) };
    sync_set_tuples(2, tuples);
    //  toast it
    toast_show(kRefreshingText, true);
  }
}

void image_config_provider(void* context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, image_button_handler);
  window_single_click_subscribe(BUTTON_ID_UP, image_button_handler);
  window_single_click_subscribe(BUTTON_ID_DOWN, image_button_handler);
}

void image_load(Window* window) {
  Layer* layer_root = window_get_root_layer(window);
  GRect rect = layer_get_bounds(layer_root);
#ifdef PBL_ROUND
  rect = grect_inset(rect, GEdgeInsets(2, 2));
#endif
  //  create layer
  layer_image = layer_create(rect);
  layer_set_update_proc(layer_image, image_update);
  layer_add_child(layer_root, layer_image);
  //  add click config
  window_set_click_config_provider(window, image_config_provider);
}

void image_unload(Window* window) {
  //  free layers
  layer_destroy(layer_image);
  layer_image = NULL;
  //  free window memory
  window_destroy(window);
  window_image = NULL;
}

//  cameras window

uint16_t cameras_get_num_rows(MenuLayer* menu, uint16_t section_index, void* data) {
  return n_cameras;
}

void cameras_draw_row(GContext* context, const Layer* cell_layer, MenuIndex* cell_index, void* data) {
  if (cell_index->row < n_cameras) {
    const Camera* camera = cameras + cell_index->row;
    //  roadway
    memset(str_temp, 0, sizeof(str_temp));
    memcpy(str_temp, &p_camera_strings[camera->roadway + 1], p_camera_strings[camera->roadway]);
    //  add distance
    if (camera->distance % 10)
      snprintf(str_distance, sizeof(str_distance), "%d.%d", camera->distance / 10, camera->distance % 10);
    else
      snprintf(str_distance, sizeof(str_distance), "  %d", camera->distance / 10);
    strcat(str_temp, "  ");
    strcat(str_temp, str_distance);
    strcat(str_temp, "mi");
    strcat(str_distance, " miles");
    //  name
    memset(str_name, 0, sizeof(str_name));
    memcpy(str_name, &p_camera_strings[camera->name + 1], MIN(p_camera_strings[camera->name], sizeof(str_name) - 1));
    //  add ICON and SECOND LINE
    menu_draw(context, cell_layer, str_temp, str_name, 0);
  }
}

void cameras_select(MenuLayer* menu, MenuIndex* cell_index, void* data) {
  if (cell_index->row < n_cameras) {
    const Camera* camera = cameras + cell_index->row;
    //  reset image
    image_reset(cell_index->row);
    //  create camera window
    window_image = my_window_create((WindowHandlers) { .load = image_load, .unload = image_unload });
    //  identifier
    memset(str_id, 0, sizeof(str_id));
    memcpy(str_id, &p_camera_strings[camera->id + 1], p_camera_strings[camera->id]);
    //  name
    memset(str_name, 0, sizeof(str_name));
    memcpy(str_name, &p_camera_strings[camera->name + 1], p_camera_strings[camera->name]);
    //  request camera
    Tuplet tuples[] = {
      TupletInteger(tuple_action, 100 * action_image),
      TupletCString(tuple_id, &str_id[0]) };
    sync_set_tuples(2, tuples);
  }
}

void cameras_load(Window* window) {
  menu_cameras = menu_create(window, (MenuLayerCallbacks) {
    .get_num_rows = cameras_get_num_rows,
#ifdef PBL_ROUND
    .get_cell_height = menu_get_cell_height,
#endif
    .draw_row = cameras_draw_row,
    .select_click = cameras_select
  });
  menu_layer_set_selected_index(menu_cameras, (MenuIndex) { .section = 0, .row = n_menu_cameras }, MenuRowAlignCenter, false);
}

void cameras_unload(Window* window) {
  //  remember selection
  n_menu_cameras = menu_layer_get_selected_index(menu_cameras).row;
  //  free menu layer
  menu_layer_destroy(menu_cameras);
  //  free window memory
  window_destroy(window);
  window_cameras = NULL;
}
#endif

//  main

void main_update(Layer* layer, GContext* context) {
  GRect rect = layer_get_bounds(layer);
  //  display logo
#ifdef PBL_ROUND
  draw_bitmap(context, RESOURCE_ID_IMAGE_LOGO, (rect.size.w - 94) / 2, 24);
#else
  draw_bitmap(context, RESOURCE_ID_IMAGE_LOGO, 1, 2);
#endif
  //  display time
  time_t time_now = time(NULL);
  struct tm* tm_now = localtime(&time_now);
  strftime(str_temp, sizeof(str_temp), clock_is_24h_style() ? "%H:%M" : "%l:%M", tm_now);
  if ((*str_temp == ' ') || (*str_temp == '0'))
    memmove(str_temp, &str_temp[1], sizeof(str_temp) - 1);
#ifdef PBL_ROUND
  graphics_context_set_text_color(context, GColorWhite);
  graphics_draw_text(context, str_temp, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
                     GRect(0, -6, rect.size.w, rect.size.h),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
#else
  graphics_context_set_text_color(context, GColorBlack);
  graphics_draw_text(context, str_temp, fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD),
                     GRect(0, -4, rect.size.w - 1, rect.size.h),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
#endif
}

uint16_t main_get_num_rows(MenuLayer* menu, uint16_t section_index, void* data) {
  return ARRAY_LENGTH(kMenuMain);
}

void main_draw_row(GContext* context, const Layer* cell_layer, MenuIndex* cell_index, void* data) {
  str_temp[0] = '\0';
  int n_icon = kMainIcons[cell_index->row];
  switch (cell_index->row) {
    case main_weather:
      if (b_weather) {
        snprintf(str_temp, sizeof(str_temp), "%d\u00B0 %s", 32 + ((n_temperature * 9 + 25) / 50), str_description);
        if (n_weather >= 0)
          n_icon = kWeatherIcons[n_weather];
      }
      break;
    case main_events:
      if (n_events)
        snprintf(str_temp, sizeof(str_temp), "%d hazard%s", n_events, (n_events != 1) ? "s" : "");
      else
        strcpy(str_temp, "no local hazards");
      break;
#ifdef PBL_COLOR
    case main_cameras:
      if (n_cameras)
        snprintf(str_temp, sizeof(str_temp), "%d camera%s", n_cameras, (n_cameras != 1) ? "s" : "");
      else
        strcpy(str_temp, "no local cameras");
      break;
    case main_map:
      strcpy(str_temp, str_location);
      break;
#endif
    case main_reload:
      if (seconds_reload) {
        strcpy(str_temp, "updated ");
        seconds_to_time(str_temp + strlen(str_temp), seconds_reload);
      }
      break;
    case main_settings:
      snprintf(str_temp, sizeof(str_temp), "%s; auto %s", kSettingsValues[setting_size][size], kSettingsValues[setting_refresh][refresh]);
      break;
    case main_about:
      strcpy(str_temp,"#HackFrost");
      break;
  }
  menu_draw(context, cell_layer, kMenuMain[cell_index->row], str_temp, n_icon);
}

void main_select(MenuLayer* menu, MenuIndex* cell_index, void* data) {
  switch (cell_index->row) {
    case main_weather:
      if (b_weather)
        window_weather = my_window_create((WindowHandlers) { .load = weather_load, .unload = weather_unload });
      break;
    case main_events:
      if (n_events)
        window_events = my_window_create((WindowHandlers) { .load = events_load, .unload = events_unload });
      break;
#ifdef PBL_COLOR
    case main_cameras:
      if (n_cameras)
        window_cameras = my_window_create((WindowHandlers) { .load = cameras_load, .unload = cameras_unload });
      break;
    case main_map:
      image_reset(-1);
      window_map = my_window_create((WindowHandlers) { .load = map_load, .unload = map_unload });
      break;
#endif
    case main_reload:
      sync_message(&TupletInteger(tuple_action, 100 * action_reload));
      toast_show("Reloading...", true);
      break;
    case main_settings:
      window_settings = my_window_create((WindowHandlers) { .load = settings_load, .unload = settings_unload });
      break;
    case main_about:
      window_about = my_window_create((WindowHandlers) { .load = about_load, .unload = about_unload });
      break;
  }
}

//  tick callback

static void tick_callback(struct tm* tick_time, TimeUnits units_changed) {
  //  refresh if main menu is top
  Window* window_top = window_stack_get_top_window();
  if (window_top == window_main)
    layer_mark_dirty(layer_main);
  if (units_changed && (refresh == refresh_on)) {
    if ((window_top == window_main) || (window_top == window_weather)) {
      if (seconds_weather + kRefreshWeather < time(NULL)) {
        sync_message(&TupletInteger(tuple_action, 100 * action_weather));
        toast_show(kUpdatingText, true);
      }
    } else if (window_top == window_map) {
      sync_message(&TupletInteger(tuple_action, 100 * action_map + n_zoom));
      toast_show(kUpdatingText, true);
#ifdef PBL_COLOR
    } else if (window_top == window_image) {
      //  request camera
      Tuplet tuples[] = {
        TupletInteger(tuple_action, 100 * action_image),
        TupletCString(tuple_id, &str_id[0]) };
      sync_set_tuples(2, tuples);
      toast_show(kRefreshingText, true);
#endif
    }
  }
}

//  main

void main_load(Window* window) {
  Layer* layer_root = window_get_root_layer(window);
  GRect rect = layer_get_bounds(layer_root);
  //  main logo
  layer_main = layer_create(GRect(0, 0, rect.size.w, kLogoHeight));
  layer_set_update_proc(layer_main, main_update);
  layer_add_child(layer_root, layer_main);
  //  main menu
  menu_main = menu_create(window, (MenuLayerCallbacks) {
    .get_num_rows = main_get_num_rows,
#ifdef PBL_ROUND
    .get_cell_height = menu_get_cell_height,
#endif
    .draw_row = main_draw_row,
    .select_click = main_select
  });
  layer_set_frame(menu_layer_get_layer(menu_main), GRect(0, kLogoHeight, rect.size.w, rect.size.h - kLogoHeight));
  //  toast
  text_toast = text_layer_create(rect);
  text_layer_set_font(text_toast, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_text_alignment(text_toast, GTextAlignmentCenter);
  text_layer_set_text_color(text_toast, PBL_IF_COLOR_ELSE(GColorBulgarianRose, GColorBlack));
  text_layer_set_background_color(text_toast, GColorWhite);
  //  tick service
  tick_timer_service_subscribe(MINUTE_UNIT, tick_callback);
}

void main_unload(Window* window) {
  //  tick service
  tick_timer_service_unsubscribe();
  //  free menu layer
  menu_layer_destroy(menu_main);
  //  toast
  toast_unload();
  text_layer_destroy(text_toast);
  //  free window memory
  window_destroy(window_main);
  window_main = NULL;
}

//  messages

void decipher_weather(const uint8_t* data, int n_length) {
 //  check length
  if (n_length >= 22) {
    //  update time
    seconds_weather = 60 * sync_get32(data);
    //  temperature
    n_temperature = sync_get16(data + 4) + kAbsoluteZero10;
    //  weather icon
    n_weather = data[6];
    //  humidity
    n_humidity = data[7];
    //  air pressure
    n_pressure = sync_get16(data + 8);
    //  wind
    n_wind_speed = data[10];
    n_wind_direction = data[11];
    //  sunrise, sunset
    seconds_sunrise = 60 * sync_get32(data + 12);
    seconds_sunset = 60 * sync_get32(data + 16);
    //  update pointer and length
    data += 20;   n_length -= 20;
    //  description
    int n_size = *(data++);   n_length--;
    if (n_length >= n_size) {
      sync_gets(str_description, sizeof(str_description), data, n_size);
      data += n_size;   n_length -= n_size;
      //  city
      n_size = *(data++);   n_length--;
      if (n_length >= n_size) {
        sync_gets(str_city, sizeof(str_city), data, n_size);
        data += n_size;   n_length -= n_size;
        //  air pressure
        char str_pressure[12];
        snprintf(str_pressure, sizeof(str_pressure), "%d", (n_pressure * 29530 + 50000) / 100000);
        if (strlen(str_pressure) > 3) {
          //  insert decimal
          int len = strlen(str_pressure);
          memmove(str_pressure + len - 1, str_pressure + len - 2, 3);
          str_pressure[len - 2] = '.';
          //  remove trailing hundreds if zero
          if (str_pressure[len] == '0') {
            str_pressure[len] = '\0';
            //  remove trailing tenths and decimal point if zero
            if (str_pressure[len - 1] == '0')
              str_pressure[len - 2] = '\0';
          }
        }
        //  wind
        char str_wind[12];
        int n_speed = (n_wind_speed * 22369) / 10000;
        snprintf(str_wind, sizeof(str_wind), "%d", n_speed);
        if (n_speed <= 99) {
          //  check tenth value
          int len = strlen(str_wind);
          if (str_wind[len - 1] != '0') {
            //  make lowest value a decimal
            memmove(str_wind + len, str_wind + len - 1, 2);
            str_wind[len - 1] = '.';
          } else if (strlen(str_wind) > 1)
            //  remove lowest value
            str_wind[len - 1] = '\0';
        } else
          //  number too big - just remove tenth value
          str_wind[strlen(str_wind) - 1] = '\0';
        //  sunrise, sunset
        char str_sunrise[8], str_sunset[8];
        seconds_to_time(str_sunrise, seconds_sunrise);
        seconds_to_time(str_sunset, seconds_sunset);
        //  last updated time
        char str_updated[8];
        seconds_to_time(str_updated, seconds_weather);
        //  create full weather description
        const char* kWeatherFormat = "%s" \
                                     "Temperature  %d\u00B0\n\n" \
                                     "%s\n\n" \
                                     "Humidity  %d%%\n" \
                                     "Air Pressure  %s\"\n" \
                                     "Wind  %s mph %s\n\n" \
                                     "Sunrise  %s\n" \
                                     "Sunset  %s\n\n" \
                                     "%s\n\n" \
                                     "last updated %s\n" \
                                     "%s ";
        snprintf(str_weather, sizeof(str_weather), kWeatherFormat,
                 PBL_IF_RECT_ELSE("", "\n"),
                 32 + ((n_temperature * 9 + 25) / 50), str_description, n_humidity, str_pressure,
                 str_wind, kWindDirections[n_wind_direction % ARRAY_LENGTH(kWindDirections)],
                 str_sunrise, str_sunset, str_city, str_updated,
                 PBL_IF_RECT_ELSE("", "\n"));
        //  redraw
        if (window_weather)
          weather_refresh();
      }
    }
  }
}

static void sync_tuple_changed_callback(const uint32_t key, const Tuple* tuple, const Tuple* tuple_old, void* context) {
  if ((key == tuple_data) && (tuple->type == TUPLE_BYTE_ARRAY) && tuple->length) {
    const uint8_t* data = tuple->value->data;
    int n_length = tuple->length - 1;
    switch (*(data++)) {
      case data_weather:
        //  decipher weather
        decipher_weather(data, n_length);
        //  set weather flag
        b_weather = true;
        //  last update time
        seconds_weather = time(NULL);
        //  persist weather
        persist_write_data(persist_weather, data, n_length);
        //  redraw main menu
        menu_layer_reload_data(menu_main);
        break;
      case data_location:
        sync_gets(str_location, sizeof(str_location), data + 1, *data);
        //  persist location
        persist_write_data(persist_location, str_location, strlen(str_location));
        //  redraw main menu
        menu_layer_reload_data(menu_main);
        break;
      case data_map:
      case data_image:
#ifdef PBL_COLOR
        //  check block
        if (*data < kBlocks) {
          int n_block = *(data++);   n_length--;
          //  load image block
          if (bitmap_images[n_block])
            gbitmap_destroy(bitmap_images[n_block]);
          bitmap_images[n_block] = gbitmap_create_from_png_data(data, n_length);
          if (n_block == kBlocks - 1) {
            if (window_map)
              layer_mark_dirty(layer_map);
            else if (window_image)
              layer_mark_dirty(layer_image);
          }
        }
#endif
        break;
      case data_events:
        //  clear apps
        n_events = 0;
        memset(events, 0, sizeof(events));
        //  memory
        if (p_event_strings)
          free(p_event_strings);
        if (tuple->length > 0) {
          p_event_strings = malloc(tuple->length - 1);
          if (p_event_strings) {
            memcpy(p_event_strings, data, tuple->length - 1);
            //  count items
            while ((data < (tuple->value->data + 1) + n_length) && (n_events < kMaxEvents)) {
              Event* event = &events[n_events];
              //  event id
              event->id = data++ - (tuple->value->data + 1);
              data += p_event_strings[event->id];
              //  event type
              event->type = *(data++);
              //  event roadway
              event->roadway = data++ - (tuple->value->data + 1);
              data += p_event_strings[event->roadway];
              //  event description
              event->description = data++ - (tuple->value->data + 1);
              data += p_event_strings[event->description];
              //  event distance
              event->distance = (data[0] << 8) | data[1];
              data += 2;
              //  increment number of events
              n_events++;
            }
          }
        } else
          p_event_strings = NULL;
        //  reset time
        seconds_reload = time(NULL);
        //  redraw main menu
        if (window_stack_get_top_window() == window_main)
          layer_mark_dirty(menu_layer_get_layer(menu_main));
        break;
      case data_event:
        //  load new event
        memset(str_event, 0, sizeof(str_event));
        memcpy(str_event, data, n_length);
        //  refresh
        if (window_event)
          event_refresh();
        break;
#ifdef PBL_COLOR
      case data_cameras:
        //  clear apps
        n_cameras = 0;
        memset(cameras, 0, sizeof(cameras));
        //  memory
        if (p_camera_strings)
          free(p_camera_strings);
        if (tuple->length > 0) {
          p_camera_strings = malloc(tuple->length - 1);
          if (p_camera_strings) {
            memcpy(p_camera_strings, data, tuple->length - 1);
            //  count items
            while ((data < (tuple->value->data + 1) + n_length) && (n_cameras < kMaxEvents)) {
              Camera* camera = &cameras[n_cameras];
              //  camera id
              camera->id = data++ - (tuple->value->data + 1);
              data += p_camera_strings[camera->id];
              //  camera roadway & name
              camera->roadway = data++ - (tuple->value->data + 1);
              data += p_camera_strings[camera->roadway];
              camera->name = data++ - (tuple->value->data + 1);
              data += p_camera_strings[camera->name];
              //  camera distance
              camera->distance = (data[0] << 8) | data[1];
              data += 2;
              //  increment number of cameras
              n_cameras++;
            }
          }
        } else
          p_camera_strings = NULL;
        //  redraw main menu
        if (window_stack_get_top_window() == window_main)
          layer_mark_dirty(menu_layer_get_layer(menu_main));
        break;
#endif
    }
  }
}

//  main

static void init(void) {
  //  initialize variables
  window_main = window_weather = window_map = window_event = window_settings = window_about = NULL;
  str_city[0] = str_description[0] = str_weather[0] = str_location[0] = str_event[0] = '\0';
  b_weather = b_in_transit = false;
  n_temperature = kAbsoluteZero10;
  n_weather = n_pressure = n_humidity = n_wind_speed = n_wind_direction = -1;
  n_zoom = kZoomDefault;
  n_events = n_menu_events = n_failures = n_packets = 0;
  seconds_reload = seconds_weather = seconds_sunrise = seconds_sunset = 0;
  size = size_medium;
  refresh = refresh_on;
  memset(events, 0, sizeof(events));
  p_event_strings = p_buffer = NULL;
  timer_sync = NULL;
#ifdef PBL_COLOR
  window_cameras = window_image = NULL;
  memset(bitmap_images, 0, sizeof(bitmap_images));
  n_cameras = n_menu_cameras = 0;
  n_image_last = -2;
  memset(cameras, 0, sizeof(cameras));
  p_camera_strings = NULL;
  str_name[0] = str_distance[0] = '\0';
#endif
  //  app communication
  uint8_t* p_data = malloc(kPacketMax);
  Tuplet tuples[] = {
    TupletInteger(tuple_action, 0),
    TupletBytes(tuple_data, p_data, kPacketMax),
    TupletCString(tuple_id, "\001234567890123456789")
  };
  //  open message app
  int n_dict_size = (int) dict_calc_buffer_size_from_tuplets(tuples, ARRAY_LENGTH(tuples)) + 96;
  app_message_open((n_dict_size > APP_MESSAGE_INBOX_SIZE_MINIMUM) ? n_dict_size : APP_MESSAGE_INBOX_SIZE_MINIMUM,
                   (n_dict_size > APP_MESSAGE_OUTBOX_SIZE_MINIMUM) ? n_dict_size : APP_MESSAGE_OUTBOX_SIZE_MINIMUM);
  //  synchronize messaging
  p_buffer = malloc(n_dict_size);
  app_sync_init(&app_sync, p_buffer, n_dict_size, tuples, ARRAY_LENGTH(tuples),
                sync_tuple_changed_callback, NULL, NULL);
  //  success callback
  app_message_register_outbox_sent(sync_sent_callback);
  app_message_register_outbox_failed(sync_failed_callback);
  //  persistence
  if (persist_exists(persist_weather)) {
    int n_length = persist_read_data(persist_weather, p_data, kPacketMax);
    decipher_weather(p_data, n_length);
    b_weather = true;
  }
  if (persist_exists(persist_location))
    persist_read_data(persist_location, str_location, sizeof(str_location));
  if (persist_exists(persist_size))
    size = persist_read_int(persist_size) % size_count;
  if (persist_exists(persist_refresh))
    refresh = persist_read_int(persist_refresh) % refresh_count;
  if (persist_exists(persist_zoom)) {
    n_zoom = persist_read_int(persist_zoom);
    if ((n_zoom < kZoomMin) || (n_zoom > kZoomMax))
      n_zoom = kZoomDefault;
  }
  //  free buffer
  free(p_data);
  //  schedule communication kickoff
  sync_schedule(&TupletInteger(tuple_action, 100 * action_init), kSyncSettingsDelay);
  //  apps window
  window_main = my_window_create((WindowHandlers) { .load = main_load, .unload = main_unload });
}

static void deinit(void) {
  //  free memory
  if (p_event_strings)
    free(p_event_strings);
#ifdef PBL_COLOR
  if (p_camera_strings)
    free(p_camera_strings);
#endif
  if (p_buffer)
    free(p_buffer);
  if (n_packets)
    free(packets);
  //  timer
  if (timer_sync)
    app_timer_cancel(timer_sync);
  //  unsync
  app_message_deregister_callbacks();
  app_sync_deinit(&app_sync);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
