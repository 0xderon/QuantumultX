/*
 * Quantumult X - 微博去广告
 *
 * 仅依赖响应中的明确广告标记，避免误删普通微博。
 * 同时支持 Node.js 导出，便于使用本地样例做回归测试。
 */

"use strict";

var AD_CARD_TYPES = [118, 247];
var AD_TEXT = ["广告", "商业推广"];

function hasAdText(value) {
  return typeof value === "string" && AD_TEXT.indexOf(value.trim()) !== -1;
}

function containsAdItemId(value) {
  if (typeof value !== "string") return false;
  return /(?:^|[_:&])(?:is_ad_pos|hotword_ad|adid|ad_pos)(?:$|[_:=&])/i.test(value);
}

function isAd(item) {
  if (!item || typeof item !== "object") return false;

  var data = item.data && typeof item.data === "object" ? item.data : item;
  var mblog = data.mblog && typeof data.mblog === "object" ? data.mblog : data;

  return Boolean(
    data.promotion ||
      data.is_ad === 1 ||
      data.is_ad === true ||
      data.ad_state === 1 ||
      data.ad_state === true ||
      mblog.is_ad === 1 ||
      mblog.ad_state === 1 ||
      hasAdText(data.mblogtypename) ||
      hasAdText(data.adType) ||
      hasAdText(data.commentAdType) ||
      (data.content_auth_info &&
        hasAdText(data.content_auth_info.content_auth_title)) ||
      AD_CARD_TYPES.indexOf(data.card_type) !== -1 ||
      containsAdItemId(data.itemid) ||
      containsAdItemId(data.itemId)
  );
}

function cleanArray(items) {
  var result = [];

  items.forEach(function (item) {
    if (isAd(item)) return;
    result.push(cleanNode(item));
  });

  return result;
}

function cleanNode(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return cleanArray(node);

  Object.keys(node).forEach(function (key) {
    var value = node[key];

    if (Array.isArray(value)) {
      node[key] = cleanArray(value);
    } else if (value && typeof value === "object") {
      node[key] = cleanNode(value);
    }
  });

  // 微博正文下方可能附带橱窗或品牌推广，不应因此删除整条微博。
  delete node.ad;
  delete node.ads;
  delete node.advertises;
  delete node.common_struct;
  delete node.semantic_brand_params;

  if (node.extend_info && typeof node.extend_info === "object") {
    delete node.extend_info.ad_semantic_brand;
    delete node.extend_info.shopwindow_cards;
  }

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

function processResponse(url, body) {
  if (
    url.indexOf("/interface/sdk/sdkad.php") !== -1 ||
    url.indexOf("/wbapplua/wbpullad.lua") !== -1
  ) {
    return cleanLaunchAd(url, body);
  }

  var payload = JSON.parse(body);
  return JSON.stringify(cleanNode(payload));
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
    processResponse: processResponse,
  };
}
