/*
 * Quantumult X - 微博去广告
 *
 * 仅依赖响应中的明确广告/推广标记，避免误删普通微博。
 * 同时支持 Node.js 导出，便于使用本地样例做回归测试。
 *
 * 2026-11-28: 补强信息流/评论区/详情页/红包浮窗检测
 * - 兼容 dynamic_info / is_ad_card / ad_marked / 热推 等新字段
 * - 清理「大家都在搜」、详情 tip、评论区推荐广告
 * - 删除 push/active 中的 ug_red_paper（必得/红包浮窗）
 */

"use strict";

var AD_CARD_TYPES = [118, 247];
var COMMENT_AD_CARD_TYPES = [6, 236];
var AD_TEXT = ["广告", "廣告", "商业推广", "熱推", "热推", "相关内容", "推荐", "推薦", "荐读"];
var MBLOG_AD_TYPES = ["广告", "廣告", "热推", "熱推"];

function hasAdText(value) {
  return typeof value === "string" && AD_TEXT.indexOf(value.trim()) !== -1;
}

function hasMblogAdType(value) {
  return typeof value === "string" && MBLOG_AD_TYPES.indexOf(value.trim()) !== -1;
}

function containsAdItemId(value) {
  if (typeof value !== "string") return false;
  return /(?:^|[_:&])(?:is_ad_pos|hotword_ad|adid|ad_pos)(?:$|[_:=&])/i.test(value);
}

function hasAdMark(value) {
  return typeof value === "string" && /(?:reallog_)?mark_ad|weiboad|openadscheme/i.test(value);
}

function promotionIsAd(promotion) {
  if (!promotion || typeof promotion !== "object") return false;
  if (promotion.type === "ad") return true;
  if (hasAdText(promotion.recommend)) return true;
  if (hasAdMark(promotion.mark)) return true;
  // 无 type 但存在广告位对象时，按推广处理（视频号原生广告常见）
  if (promotion.adid || promotion.object_id || promotion.ad_id) return true;
  return false;
}

function actionlogIsAd(actionlog) {
  if (!actionlog || typeof actionlog !== "object") return false;
  return actionlog.source === "ad" || hasAdMark(actionlog.mark) || hasAdMark(actionlog.ext);
}

function isAd(item) {
  if (!item || typeof item !== "object") return false;

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

  if (promotionIsAd(data.promotion) || promotionIsAd(mblog.promotion)) return true;

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
    (data.content_auth_info_dark &&
      hasAdText(data.content_auth_info_dark.content_auth_title))
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
    (data.page_info && actionlogIsAd(data.page_info.actionlog)) ||
    (mblog.page_info && actionlogIsAd(mblog.page_info.actionlog)) ||
    (data.content_auth_info && actionlogIsAd(data.content_auth_info.actionlog))
  ) {
    return true;
  }

  if (
    AD_CARD_TYPES.indexOf(data.card_type) !== -1 ||
    containsAdItemId(data.itemid) ||
    containsAdItemId(data.itemId)
  ) {
    return true;
  }

  if (Array.isArray(data.url_struct)) {
    for (var i = 0; i < data.url_struct.length; i++) {
      var u = data.url_struct[i];
      if (u && (hasAdMark(u.long_url) || hasAdMark(u.ori_url) || hasAdMark(u.url_title))) {
        return true;
      }
    }
  }

  return false;
}

function isEveryoneSearching(item) {
  if (!item || typeof item !== "object") return false;
  var data = item.data && typeof item.data === "object" ? item.data : item;
  if (data.itemid === "top_searching" || item.itemid === "top_searching") return true;
  if (data.hint === "大家都在搜" || item.hint === "大家都在搜") return true;
  if (typeof data.title === "string" && data.title.indexOf("大家都在搜") !== -1) return true;
  if (
    data.title &&
    typeof data.title === "object" &&
    typeof data.title.content === "string" &&
    data.title.content.indexOf("大家都在搜") !== -1
  ) {
    return true;
  }
  // card_type 248 + top_searching 已在 itemid 判断覆盖；纯 248 过宽，不单靠 card_type
  return false;
}

function isFansRelationBar(item) {
  if (!item || typeof item !== "object") return false;
  var data = item.data && typeof item.data === "object" ? item.data : item;
  var texts = [];
  if (typeof data.title === "string") texts.push(data.title);
  if (typeof data.desc === "string") texts.push(data.desc);
  if (typeof data.content === "string") texts.push(data.content);
  if (typeof data.text === "string") texts.push(data.text);
  if (data.title && typeof data.title.content === "string") texts.push(data.title.content);
  if (typeof item.tip_msg === "string") texts.push(item.tip_msg);
  for (var i = 0; i < texts.length; i++) {
    if (texts[i].indexOf("铁粉关系") !== -1) return true;
  }
  return false;
}

function shouldDrop(item) {
  return isAd(item) || isEveryoneSearching(item) || isFansRelationBar(item);
}

function cleanArray(items) {
  var result = [];
  items.forEach(function (item) {
    if (shouldDrop(item)) return;
    result.push(cleanNode(item));
  });
  return result;
}

function stripTimelineExtras(node) {
  if (!node || typeof node !== "object") return;

  if (node.loadedInfo && typeof node.loadedInfo === "object") {
    delete node.loadedInfo.headers;
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

  if (node.video_info && typeof node.video_info === "object") {
    delete node.video_info.forward_redpacket_info;
    delete node.video_info.shopping;
    delete node.video_info.float_info;
    delete node.video_info.tags;
  }
}

function cleanDetailExtras(payload) {
  if (!payload || typeof payload !== "object") return payload;

  if (payload.pageHeader && payload.pageHeader.data && Array.isArray(payload.pageHeader.data.items)) {
    payload.pageHeader.data.items = payload.pageHeader.data.items.filter(function (item) {
      if (!item || typeof item !== "object") return false;
      if (item.category && item.category !== "detail") return false;
      return !shouldDrop(item);
    });
  }

  delete payload.tip_msg;
  delete payload.head_cards;
  delete payload.top_cards;
  delete payload.page_alerts;

  if (Array.isArray(payload.items)) {
    payload.items = payload.items.filter(function (item) {
      if (!item || typeof item !== "object") return false;
      if (shouldDrop(item)) return false;
      var data = item.data && typeof item.data === "object" ? item.data : item;
      if (COMMENT_AD_CARD_TYPES.indexOf(data.card_type) !== -1) return false;
      return true;
    });
  }
  if (Array.isArray(payload.datas)) {
    payload.datas = payload.datas.filter(function (item) {
      if (!item || typeof item !== "object") return false;
      if (shouldDrop(item)) return false;
      if (COMMENT_AD_CARD_TYPES.indexOf(item.card_type) !== -1) return false;
      if (hasAdText(item.adType)) return false;
      return true;
    });
  }

  if (payload.trend && payload.trend.titles) {
    var title = payload.trend.titles.title;
    if (
      title === "相关推荐" ||
      title === "博主好物种草" ||
      title === "大家都在搜" ||
      (typeof title === "string" && title.indexOf("搜") !== -1 && title.indexOf("相关") !== -1)
    ) {
      delete payload.trend;
    }
  }

  // statuses/extend：顶部搜索推荐卡
  if (Array.isArray(payload.top_cards)) delete payload.top_cards;
  if (payload.follow_data) payload.follow_data = null;
  if (payload.reward_info) payload.reward_info = null;

  return payload;
}

function cleanNode(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return cleanArray(node);

  Object.keys(node).forEach(function (key) {
    // ug_red_paper：首页/推送里的红包浮窗（必得 xx 元）
    if (key === "ug_red_paper") {
      delete node[key];
      return;
    }

    var value = node[key];
    if (Array.isArray(value)) {
      node[key] = cleanArray(value);
    } else if (value && typeof value === "object") {
      node[key] = cleanNode(value);
    }
  });

  stripTimelineExtras(node);
  return node;
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

  var luaPayload = JSON.parse(body);
  if (luaPayload.cached_ad && typeof luaPayload.cached_ad === "object") {
    luaPayload.cached_ad.ads = [];
  }
  if (Array.isArray(luaPayload.ads)) luaPayload.ads = [];
  return JSON.stringify(luaPayload);
}

function needsDetailClean(url) {
  return (
    url.indexOf("/statuses/container_detail") !== -1 ||
    url.indexOf("/statuses/extend") !== -1 ||
    url.indexOf("/comments/build_comments") !== -1 ||
    url.indexOf("/comments/mix_comments") !== -1
  );
}

function processResponse(url, body) {
  if (
    url.indexOf("/interface/sdk/sdkad.php") !== -1 ||
    url.indexOf("/wbapplua/wbpullad.lua") !== -1
  ) {
    return cleanLaunchAd(url, body);
  }

  var payload = JSON.parse(body);
  payload = cleanNode(payload);
  if (needsDetailClean(url)) {
    payload = cleanDetailExtras(payload);
  }
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
    cleanDetailExtras: cleanDetailExtras,
    isAd: isAd,
    isEveryoneSearching: isEveryoneSearching,
    isFansRelationBar: isFansRelationBar,
    shouldDrop: shouldDrop,
    processResponse: processResponse,
  };
}
