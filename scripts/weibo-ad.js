/*
 * Quantumult X - 微博去广告
 *
 * 适配微博 16.x（含 16.11.3）详情页 pageHeader、评论区 commentAdType、发现页模块白名单。
 * 结构参考 fmz200/weibo_ads.js（2026-06）与 ddgksf2013/weibo_json.js，收敛为单脚本。
 * 同时支持 Node.js 导出做回归测试。
 */

"use strict";

var AD_CARD_TYPES = [118, 182, 217, 236, 247];
var COMMENT_AD_CARD_TYPES = [6, 236];
var AD_TEXT = ["广告", "廣告", "商业推广", "熱推", "热推", "相关内容", "推荐", "推薦", "荐读"];
var MBLOG_AD_TYPES = ["广告", "廣告", "热推", "熱推"];
// 发现页只保留这些 card_type：17 热搜、235 新热搜、101 热门微博
var DISCOVER_KEEP_CARD_TYPES = [17, 235, 101];

function hasAdText(value) {
  return typeof value === "string" && AD_TEXT.indexOf(value.trim()) !== -1;
}

function hasMblogAdType(value) {
  return typeof value === "string" && MBLOG_AD_TYPES.indexOf(value.trim()) !== -1;
}

function containsAdItemId(value) {
  if (typeof value !== "string") return false;
  return /(?:^|[_:&])(?:is_ad_pos|hotword_ad|adid|ad_pos|c_type:51|city_code|region_data)(?:$|[_:=&])/i.test(
    value
  );
}

function hasAdMark(value) {
  return typeof value === "string" && /(?:reallog_)?mark_ad|weiboad|openadscheme/i.test(value);
}

function promotionIsAd(promotion) {
  if (promotion == null) return false;
  if (typeof promotion !== "object") return true;
  if (promotion.type === "ad") return true;
  if (hasAdText(promotion.recommend)) return true;
  if (hasAdMark(promotion.mark)) return true;
  if (promotion.adid || promotion.object_id || promotion.ad_id) return true;
  return false;
}

function actionlogIsAd(actionlog) {
  if (!actionlog || typeof actionlog !== "object") return false;
  return actionlog.source === "ad" || hasAdMark(actionlog.mark) || hasAdMark(actionlog.ext);
}

function collectTexts(node, out, depth) {
  if (!node || depth > 4) return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (typeof node !== "object") return;
  var keys = ["title", "desc", "content", "text", "hint", "tip_msg", "btn_text", "name"];
  for (var i = 0; i < keys.length; i++) {
    var v = node[keys[i]];
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") {
      if (typeof v.content === "string") out.push(v.content);
      if (typeof v.text === "string") out.push(v.text);
    }
  }
  if (Array.isArray(node.buttons)) {
    for (var b = 0; b < node.buttons.length; b++) collectTexts(node.buttons[b], out, depth + 1);
  }
}

function textLooksLikeAppDownloadAd(item) {
  var texts = [];
  collectTexts(item, texts, 0);
  if (item && item.data) collectTexts(item.data, texts, 0);
  var joined = texts.join(" ");
  if (joined.indexOf("APP下载") !== -1 || joined.indexOf("立即下载") !== -1) return true;
  if (joined.indexOf("广告") !== -1 && (joined.indexOf("下载") !== -1 || joined.indexOf("查看详情") !== -1)) {
    return true;
  }
  return false;
}

function isEveryoneSearching(item) {
  if (!item || typeof item !== "object") return false;
  if (item.type === "trend") return true;
  var data = item.data && typeof item.data === "object" ? item.data : item;
  if (data.itemid === "top_searching" || item.itemid === "top_searching") return true;
  if (data.hint === "大家都在搜" || item.hint === "大家都在搜") return true;
  var texts = [];
  collectTexts(item, texts, 0);
  collectTexts(data, texts, 0);
  for (var i = 0; i < texts.length; i++) {
    if (texts[i].indexOf("大家都在搜") !== -1) return true;
  }
  return false;
}

function isFansRelationBar(item) {
  if (!item || typeof item !== "object") return false;
  var texts = [];
  collectTexts(item, texts, 0);
  if (item.data) collectTexts(item.data, texts, 0);
  for (var i = 0; i < texts.length; i++) {
    if (texts[i].indexOf("铁粉关系") !== -1 || texts[i].indexOf("铁粉互动") !== -1) return true;
  }
  return false;
}

function isAd(item) {
  if (!item || typeof item !== "object") return false;

  // 评论区：字段在 item 顶层（16.x container_detail_comment）
  if (item.commentAdType) return true;
  if (item.type === "trend") return true;
  if (hasAdText(item.adType)) return true;

  var data = item.data && typeof item.data === "object" ? item.data : item;
  var mblog =
    data.mblog && typeof data.mblog === "object"
      ? data.mblog
      : data.blog && typeof data.blog === "object"
        ? data.blog
        : data;

  if (
    data.is_ad === 1 ||
    data.is_ad === true ||
    data.ad_state === 1 ||
    data.ad_state === true ||
    data.is_ad_card === 1 ||
    data.is_ad_card === true ||
    data.ad_marked === true ||
    data.ad_object != null ||
    data.adid != null ||
    mblog.is_ad === 1 ||
    mblog.ad_state === 1 ||
    mblog.is_ad_card === 1 ||
    mblog.ad_marked === true
  ) {
    return true;
  }

  if (promotionIsAd(data.promotion) || promotionIsAd(mblog.promotion) || promotionIsAd(item.promotion)) {
    return true;
  }

  if (
    hasMblogAdType(data.mblogtypename) ||
    hasMblogAdType(mblog.mblogtypename) ||
    hasAdText(data.adType) ||
    hasAdText(data.commentAdType) ||
    hasAdText(mblog.adType)
  ) {
    return true;
  }

  if (
    (data.content_auth_info && hasAdText(data.content_auth_info.content_auth_title)) ||
    (mblog.content_auth_info && hasAdText(mblog.content_auth_info.content_auth_title)) ||
    (data.content_auth_info_dark && hasAdText(data.content_auth_info_dark.content_auth_title))
  ) {
    return true;
  }

  if (
    (data.dynamic_info && data.dynamic_info.type === "ad") ||
    (mblog.dynamic_info && mblog.dynamic_info.type === "ad")
  ) {
    return true;
  }

  if (
    actionlogIsAd(data.actionlog) ||
    actionlogIsAd(mblog.actionlog) ||
    actionlogIsAd(item.actionlog) ||
    (data.page_info && actionlogIsAd(data.page_info.actionlog)) ||
    (mblog.page_info && actionlogIsAd(mblog.page_info.actionlog)) ||
    (data.content_auth_info && actionlogIsAd(data.content_auth_info.actionlog))
  ) {
    return true;
  }

  if (
    AD_CARD_TYPES.indexOf(data.card_type) !== -1 ||
    containsAdItemId(data.itemid) ||
    containsAdItemId(data.itemId) ||
    containsAdItemId(item.itemid)
  ) {
    return true;
  }

  if (Array.isArray(data.url_struct)) {
    for (var i = 0; i < data.url_struct.length; i++) {
      var u = data.url_struct[i];
      if (u && (hasAdMark(u.long_url) || hasAdMark(u.ori_url) || hasAdMark(u.url_title))) return true;
    }
  }

  // 带「广告」角标 + APP下载 的植入卡（超话评论区常见）
  if (textLooksLikeAppDownloadAd(item)) return true;

  return false;
}

function shouldDrop(item) {
  return isAd(item) || isEveryoneSearching(item) || isFansRelationBar(item);
}

function parseBody(body) {
  if (typeof body !== "string") body = String(body || "");
  try {
    return JSON.parse(body);
  } catch (e1) {
    var match = body.match(/\{[\s\S]*\}/);
    if (!match) throw e1;
    return JSON.parse(match[0]);
  }
}

function cleanArray(items) {
  var result = [];
  items.forEach(function (item) {
    if (shouldDrop(item)) return;
    // 被置空的占位
    if (item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0) {
      return;
    }
    result.push(cleanNode(item));
  });
  return result;
}

function stripExtras(node) {
  if (!node || typeof node !== "object") return;
  if (node.loadedInfo && typeof node.loadedInfo === "object") {
    delete node.loadedInfo.headers;
    delete node.loadedInfo.searchBarContent;
    delete node.loadedInfo.headerBack;
  }
  delete node.ad;
  delete node.ads;
  delete node.advertises;
  delete node.trends;
  delete node.common_struct;
  delete node.semantic_brand_params;
  delete node.ug_red_paper;
  if (node.extend_info && typeof node.extend_info === "object") {
    delete node.extend_info.ad_semantic_brand;
    delete node.extend_info.shopwindow_cards;
  }
  if (node.data && typeof node.data === "object") {
    if (node.data.extend_info && typeof node.data.extend_info === "object") {
      delete node.data.extend_info.ad_semantic_brand;
      delete node.data.extend_info.shopwindow_cards;
    }
    delete node.data.common_struct;
    delete node.data.semantic_brand_params;
  }
  if (node.video_info && typeof node.video_info === "object") {
    delete node.video_info.forward_redpacket_info;
    delete node.video_info.shopping;
    delete node.video_info.float_info;
    delete node.video_info.tags;
  }
}

function cleanNode(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return cleanArray(node);

  Object.keys(node).forEach(function (key) {
    if (key === "ug_red_paper") {
      delete node[key];
      return;
    }
    var value = node[key];
    if (Array.isArray(value)) node[key] = cleanArray(value);
    else if (value && typeof value === "object") node[key] = cleanNode(value);
  });

  stripExtras(node);
  return node;
}

function filterPageHeader(payload) {
  if (!payload || !payload.pageHeader || !payload.pageHeader.data) return;
  var items = payload.pageHeader.data.items;
  if (!Array.isArray(items)) return;

  // 16.x：大家都在搜 / 广告卡 / 铁粉条 在 pageHeader 里，category 为 card|group|wboxcard
  payload.pageHeader.data.items = items.filter(function (item) {
    if (!item || typeof item !== "object") return false;
    if (item.category === "card" || item.category === "group" || item.category === "wboxcard") {
      return false;
    }
    if (item.type === "share" || item.type === "trend") return false;
    if (shouldDrop(item)) return false;
    if (item.category && item.category !== "detail") return false;
    // 详情块内部嵌套 items 再清一遍
    if (Array.isArray(item.items)) {
      item.items = item.items.filter(function (sub) {
        return sub && !shouldDrop(sub) && sub.category !== "card" && sub.category !== "group";
      });
    }
    return true;
  });
}

function filterCommentItems(payload) {
  if (!payload || typeof payload !== "object") return;

  function keepComment(item) {
    if (!item || typeof item !== "object") return false;
    if (item.type === "trend") return false;
    if (item.commentAdType) return false;
    if (shouldDrop(item)) return false;
    var data = item.data && typeof item.data === "object" ? item.data : item;
    if (COMMENT_AD_CARD_TYPES.indexOf(data.card_type) !== -1) return false;
    return true;
  }

  if (Array.isArray(payload.items)) payload.items = payload.items.filter(keepComment);
  if (Array.isArray(payload.datas)) {
    payload.datas = payload.datas.filter(function (item) {
      if (!item || typeof item !== "object") return false;
      if (hasAdText(item.adType) || item.adType === "广告") return false;
      if (item.commentAdType) return false;
      if (shouldDrop(item)) return false;
      return true;
    });
  }
  delete payload.tip_msg;
}

function cleanExtend(payload) {
  if (!payload || typeof payload !== "object") return;
  delete payload.head_cards;
  delete payload.top_cards;
  delete payload.extend_info;
  delete payload.trend;
  delete payload.semantic_brand_params;
  delete payload.ad_tag_nature;
  delete payload.title_source;
  delete payload.reward_info;
  delete payload.page_alerts;
  if (payload.follow_data) payload.follow_data = null;
  if (payload.detailInfo && payload.detailInfo.extend && payload.detailInfo.extend.follow_data) {
    delete payload.detailInfo.extend.follow_data;
  }
}

function removeHotSearchAds(groups) {
  if (!Array.isArray(groups)) return;
  for (var i = groups.length - 1; i >= 0; i--) {
    var group = groups[i];
    if (!group) {
      groups.splice(i, 1);
      continue;
    }
    if (group.promotion != null || containsAdItemId(group.itemid) || shouldDrop(group)) {
      groups.splice(i, 1);
    }
  }
}

function processDiscoverPayload(payload) {
  if (!payload || !Array.isArray(payload.items)) return;

  if (payload.loadedInfo) {
    delete payload.loadedInfo.searchBarContent;
    delete payload.loadedInfo.headerBack;
    delete payload.loadedInfo.headers;
  }

  function scrubDiscoverItems(items) {
    if (!Array.isArray(items)) return;
    var firstVerticalFound = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it !== "object") continue;

      var cardType = it.data && it.data.card_type;
      if (cardType && DISCOVER_KEEP_CARD_TYPES.indexOf(cardType) === -1) {
        // 发现页热搜与热门之间的视频/banner 广告（如车企上市）走这里
        items[i] = null;
        continue;
      }

      if (shouldDrop(it)) {
        items[i] = null;
        continue;
      }

      if (it.type === "vertical") {
        if (!firstVerticalFound) {
          firstVerticalFound = true;
        } else {
          items[i] = null;
          continue;
        }
      }

      if (cardType === 17 && it.data && it.data.group) removeHotSearchAds(it.data.group);
      if (cardType === 235 && it.data && it.data.channel_list && it.data.channel_list[0]) {
        removeHotSearchAds(it.data.channel_list[0].group);
      }

      if (Array.isArray(it.items)) scrubDiscoverItems(it.items);
    }

    for (var j = items.length - 1; j >= 0; j--) {
      if (items[j] == null) items.splice(j, 1);
    }
  }

  if (payload.items[0] && Array.isArray(payload.items[0].items)) {
    scrubDiscoverItems(payload.items[0].items);
  }
  scrubDiscoverItems(payload.items);

  // 再清一遍 feed 广告
  for (var k = payload.items.length - 1; k >= 0; k--) {
    var feed = payload.items[k];
    if (feed && feed.category === "feed" && feed.data && hasMblogAdType(feed.data.mblogtypename)) {
      payload.items.splice(k, 1);
    }
  }
}

function processDiscoverRoot(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.channelInfo && Array.isArray(payload.channelInfo.channels)) {
    var ch0 = payload.channelInfo.channels[0];
    if (ch0 && ch0.payload) processDiscoverPayload(ch0.payload);
    // 去掉明显的商业 channel（保留常见内容 tab）
    var keepIds = [1001, 1015, 1016, 1040, 1041, 1043, 1053, 1030, 1063, 1061, 1046];
    payload.channelInfo.channels = payload.channelInfo.channels.filter(function (ch) {
      return !ch || keepIds.indexOf(ch.id) !== -1;
    });
  }
  if (payload.header && payload.header.data && Array.isArray(payload.header.data.items)) {
    processDiscoverPayload({ items: payload.header.data.items });
  }
  if (payload.header && payload.header.insert_data) delete payload.header.insert_data;
  if (Array.isArray(payload.items)) processDiscoverPayload(payload);
}

function processTopicTimeline(payload) {
  if (!payload || !Array.isArray(payload.items)) return;
  var foundFeed = false;
  var keepCardTypes = [19, 179];
  for (var i = 0; i < payload.items.length; i++) {
    var item = payload.items[i];
    if (!item) continue;
    if (item.data && (item.data.is_ad === 1 || hasMblogAdType(item.data.mblogtypename))) {
      payload.items[i] = {};
      continue;
    }
    if (shouldDrop(item)) {
      payload.items[i] = {};
      continue;
    }
    var cardType = item.data && item.data.card_type;
    if (cardType && keepCardTypes.indexOf(cardType) !== -1) continue;
    if (foundFeed && item.category !== "feed") {
      payload.items[i] = {};
    }
    if (item.category === "feed" || item.category === "card") {
      foundFeed = true;
      if (item.category === "card") payload.items[i] = {};
    }
  }
  payload.items = payload.items.filter(function (it) {
    return it && Object.keys(it).length > 0;
  });
}

function cleanLaunchAd(url, body) {
  if (url.indexOf("/interface/sdk/sdkad.php") !== -1) {
    var match = body.match(/\{[\s\S]*\}/);
    if (!match) return body;
    var sdkPayload = JSON.parse(match[0]);
    sdkPayload.ads = [];
    sdkPayload.show_push_splash_ad = false;
    sdkPayload.background_delay_display_time = 86400000;
    return JSON.stringify(sdkPayload) + "OK";
  }
  var luaPayload = parseBody(body);
  if (luaPayload.cached_ad && typeof luaPayload.cached_ad === "object") luaPayload.cached_ad.ads = [];
  if (Array.isArray(luaPayload.ads)) luaPayload.ads = [];
  return JSON.stringify(luaPayload);
}

function processResponse(url, body) {
  if (
    url.indexOf("/interface/sdk/sdkad.php") !== -1 ||
    url.indexOf("/wbapplua/wbpullad.lua") !== -1
  ) {
    return cleanLaunchAd(url, body);
  }

  var payload = parseBody(body);

  // —— 发现页（热搜下视频/banner 广告）——
  if (
    url.indexOf("/search/finder") !== -1 ||
    url.indexOf("/search/container_timeline") !== -1 ||
    url.indexOf("/search/container_discover") !== -1
  ) {
    processDiscoverRoot(payload);
    payload = cleanNode(payload);
    return JSON.stringify(payload);
  }

  // —— 热搜 page / flowpage ——
  if (url.indexOf("/2/flowpage") !== -1 || url.indexOf("/flowpage?") !== -1) {
    payload.pageHeader = {};
    payload = cleanNode(payload);
    return JSON.stringify(payload);
  }
  if ((url.indexOf("/2/page?") !== -1 || url.indexOf("/page?") !== -1) && payload.cards) {
    payload = cleanNode(payload);
    return JSON.stringify(payload);
  }

  // —— 详情页：大家都在搜 / 铁粉 / 中插广告在 pageHeader ——
  if (url.indexOf("/statuses/container_detail") !== -1 && url.indexOf("container_detail_") === -1) {
    filterPageHeader(payload);
    cleanExtend(payload);
    filterCommentItems(payload);
    payload = cleanNode(payload);
    filterPageHeader(payload);
    return JSON.stringify(payload);
  }

  // container_detail_comment / _mix / _forward
  if (
    url.indexOf("/statuses/container_detail_comment") !== -1 ||
    url.indexOf("/statuses/container_detail_mix") !== -1
  ) {
    filterCommentItems(payload);
    payload = cleanNode(payload);
    filterCommentItems(payload);
    return JSON.stringify(payload);
  }
  if (url.indexOf("/statuses/container_detail_forward") !== -1) {
    if (Array.isArray(payload.items)) {
      payload.items = payload.items.filter(function (item) {
        return item && item.type === "forward";
      });
    }
    return JSON.stringify(payload);
  }

  if (url.indexOf("/statuses/extend") !== -1) {
    cleanExtend(payload);
    payload = cleanNode(payload);
    return JSON.stringify(payload);
  }

  if (url.indexOf("/comments/mix_comments") !== -1 || url.indexOf("/comments/build_comments") !== -1) {
    filterCommentItems(payload);
    payload = cleanNode(payload);
    filterCommentItems(payload);
    return JSON.stringify(payload);
  }

  if (url.indexOf("/statuses/container_timeline_topic") !== -1) {
    processTopicTimeline(payload);
    payload = cleanNode(payload);
    return JSON.stringify(payload);
  }

  // 默认：信息流等
  payload = cleanNode(payload);
  return JSON.stringify(payload);
}

if (typeof $done === "function") {
  try {
    $done({ body: processResponse($request.url, $response.body) });
  } catch (error) {
    console.log("[微博去广告] 响应处理失败：" + error.message);
    $done({});
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    cleanNode: cleanNode,
    isAd: isAd,
    isEveryoneSearching: isEveryoneSearching,
    isFansRelationBar: isFansRelationBar,
    shouldDrop: shouldDrop,
    processResponse: processResponse,
    filterPageHeader: filterPageHeader,
    filterCommentItems: filterCommentItems,
    processDiscoverRoot: processDiscoverRoot,
  };
}
