/*
 * Quantumult X - X (Twitter) 去广告
 *
 * 只删除带稳定推广标记的时间线条目，解析失败时保留原始响应。
 * 有机推文、分页游标、未知模块不动。登录、发帖、私信不在重写规则内，
 * 这里再挡一层，避免规则被放宽后误伤。
 * 同时支持 Node.js 导出做回归测试。
 *
 * 认这些标记（2024–2026 的 GraphQL / 旧版 REST）：
 * - itemContent / tweet / TweetWithVisibilityResults 上的 promotedMetadata
 * - REST 推文与趋势上的 promoted_content
 * - entryId：promoted-tweet、promotedTweet、promoted-trend、who-to-follow、premium-upsell
 * - clientEventInfo.component / action：promoted_tweet、suggest_who_to_follow、premium_upsell
 * - socialContext.contextType 为 Promoted，或文案正好是 Promoted / 已推广
 */

"use strict";

var INJECTABLE_MARKERS = {
  promoted_tweet: true,
  promoted_trend: true,
  promoted_account: true,
  promoted_user: true,
  who_to_follow: true,
  suggest_who_to_follow: true,
  premium_upsell: true,
  twitter_blue_upsell: true,
  superfollow_upsell: true,
  super_follow_upsell: true,
  subscription_upsell: true,
  subscriptions_upsell: true,
};

var PROMOTED_CONTEXT_TEXT = {
  promoted: true,
  sponsored: true,
  ad: true,
  "已推广": true,
  "プロモーション": true,
  "贊助": true,
  "赞助": true,
};

var SKIP_DESCENT = {
  entries: true,
  items: true,
  moduleItems: true,
  tweet_results: true,
  tweetResults: true,
  legacy: true,
  user_results: true,
  userResults: true,
  core: true,
  users: true,
  globalObjects: true,
  instructions: true,
};

function normalizeMarker(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/-/g, "_");
}

function markerIsInjectable(value) {
  var key = normalizeMarker(value);
  if (!key) return false;
  return Object.prototype.hasOwnProperty.call(INJECTABLE_MARKERS, key);
}

function entryIdOf(node) {
  if (!node || typeof node !== "object") return "";
  if (typeof node.entryId === "string") return node.entryId;
  if (typeof node.entry_id === "string") return node.entry_id;
  return "";
}

function idIsInjectable(id) {
  if (typeof id !== "string" || !id || id.length > 240) return false;
  if (/^promoted[-_]?(?:tweet|trend|account|user)/i.test(id)) return true;
  if (/(?:^|[-_])who[-_]?to[-_]?follow(?:$|[-_0-9])/i.test(id)) return true;
  if (/(?:^|[-_])suggest[-_]?who[-_]?to[-_]?follow(?:$|[-_])/i.test(id)) return true;
  if (/(?:^|[-_])premium[-_]?upsell(?:$|[-_])/i.test(id)) return true;
  if (/(?:^|[-_])upsell[-_]?premium(?:$|[-_])/i.test(id)) return true;
  if (/(?:^|[-_])twitter[-_]?blue[-_]?upsell(?:$|[-_])/i.test(id)) return true;
  if (/(?:^|[-_])super[-_]?follows?[-_]?upsell(?:$|[-_])/i.test(id)) return true;
  if (/(?:^|[-_])subscriptions?[-_]?upsell(?:$|[-_])/i.test(id)) return true;
  return false;
}

function promotedMeta(node) {
  if (!node || typeof node !== "object") return false;
  if (node.promotedMetadata != null) return true;
  if (node.promoted_metadata != null) return true;
  if (node.promoted_content) return true;
  return false;
}

function socialContextIsPromoted(ctx) {
  if (!ctx || typeof ctx !== "object") return false;
  if (typeof ctx.contextType === "string" && ctx.contextType.toLowerCase().indexOf("promoted") === 0) {
    return true;
  }
  if (typeof ctx.text !== "string") return false;
  var text = ctx.text.trim();
  if (!text) return false;
  if (Object.prototype.hasOwnProperty.call(PROMOTED_CONTEXT_TEXT, text)) return true;
  var lower = text.toLowerCase();
  return Object.prototype.hasOwnProperty.call(PROMOTED_CONTEXT_TEXT, lower);
}

function itemTypeIsUpsell(itemType) {
  return typeof itemType === "string" && /upsell/i.test(itemType);
}

function resultIsPromoted(result) {
  if (!result || typeof result !== "object") return false;
  if (promotedMeta(result)) return true;
  if (socialContextIsPromoted(result.socialContext)) return true;
  if (result.legacy && result.legacy.promoted_content) return true;
  if (result.tweet && typeof result.tweet === "object") {
    if (promotedMeta(result.tweet)) return true;
    if (socialContextIsPromoted(result.tweet.socialContext)) return true;
    if (result.tweet.legacy && result.tweet.legacy.promoted_content) return true;
  }
  return false;
}

function itemContentIsPromoted(itemContent) {
  if (!itemContent || typeof itemContent !== "object" || Array.isArray(itemContent)) return false;
  if (promotedMeta(itemContent)) return true;
  if (typeof itemContent.displayType === "string" && /^promoted/i.test(itemContent.displayType)) return true;
  if (itemTypeIsUpsell(itemContent.itemType)) return true;
  if (socialContextIsPromoted(itemContent.socialContext)) return true;
  if (itemContent.trend && promotedMeta(itemContent.trend)) return true;
  if (itemContent.promotedTrend != null) return true;
  if (itemContent.tweet && typeof itemContent.tweet === "object") {
    if (promotedMeta(itemContent.tweet)) return true;
    if (itemContent.tweet.legacy && itemContent.tweet.legacy.promoted_content) return true;
  }
  var results = itemContent.tweet_results || itemContent.tweetResults;
  if (results && resultIsPromoted(results.result)) return true;
  return false;
}

function eventInfoIsInjectable(info) {
  if (!info || typeof info !== "object") return false;
  return (
    markerIsInjectable(info.component) || markerIsInjectable(info.action) || markerIsInjectable(info.element)
  );
}

function ownPayload(entry) {
  var list = [];
  var content = entry.content;
  if (content && typeof content === "object") {
    if (content.itemContent && typeof content.itemContent === "object") list.push(content.itemContent);
    if (eventInfoIsInjectable(content.clientEventInfo)) list.push(content);
    if (content.item && typeof content.item === "object") {
      if (content.item.itemContent) list.push(content.item.itemContent);
      if (content.item.content && typeof content.item.content === "object") list.push(content.item.content);
      if (eventInfoIsInjectable(content.item.clientEventInfo)) list.push(content.item);
    }
  }
  if (entry.item && typeof entry.item === "object") {
    if (entry.item.itemContent) list.push(entry.item.itemContent);
    if (entry.item.content && typeof entry.item.content === "object") list.push(entry.item.content);
    if (eventInfoIsInjectable(entry.item.clientEventInfo)) list.push(entry.item);
  }
  if (entry.itemContent && typeof entry.itemContent === "object") list.push(entry.itemContent);
  return list;
}

function looksLikeTimelineItem(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  var id = entryIdOf(node);
  if (id && idIsInjectable(id)) return true;
  if (!id) return false;
  return !!(node.content || node.item || node.itemContent || node.sortIndex || node.clientEventInfo);
}

function entryIsAd(entry) {
  if (!looksLikeTimelineItem(entry)) return false;
  var id = entryIdOf(entry);
  if (idIsInjectable(id)) return true;
  if (promotedMeta(entry)) return true;
  if (eventInfoIsInjectable(entry.clientEventInfo)) return true;
  if (entry.content && socialContextIsPromoted(entry.content.socialContext)) return true;
  // 模块头部的 clientEventInfo（例如 who-to-follow）也算，但不钻进 items，避免一条广告回复把整段对话删掉。
  if (treeHasInjectableMarker(entry, 0)) return true;
  var payloads = ownPayload(entry);
  for (var i = 0; i < payloads.length; i++) {
    var payload = payloads[i];
    if (!payload || typeof payload !== "object") continue;
    if (eventInfoIsInjectable(payload.clientEventInfo)) return true;
    if (itemContentIsPromoted(payload)) return true;
  }
  return false;
}

function isRestTweet(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  var hasId = typeof node.id_str === "string" || typeof node.id === "number" || typeof node.id === "string";
  var hasText = typeof node.full_text === "string" || typeof node.text === "string";
  if (!hasId || !hasText) return false;
  // GraphQL 的 legacy / 时间线条目不是 REST 时间线数组里的一条推文。
  if (node.entryId || (node.rest_id && node.legacy)) return false;
  return !!(node.user || node.favorited != null || node.retweet_count != null || node.favorite_count != null);
}

function isPromotedRestTweet(node) {
  return isRestTweet(node) && promotedMeta(node);
}

function looksLikeTrend(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  if (typeof node.name !== "string") return false;
  if (node.full_text || node.id_str || node.screen_name || node.entryId) return false;
  return (
    typeof node.query === "string" ||
    node.tweet_volume != null ||
    Object.prototype.hasOwnProperty.call(node, "promoted_content") ||
    node.promotedMetadata != null
  );
}

function isPromotedTrendObject(node) {
  return looksLikeTrend(node) && promotedMeta(node);
}

function stripModuleAds(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  var holders = [];
  if (node.content && typeof node.content === "object") holders.push(node.content);
  if (node.item && typeof node.item === "object") holders.push(node.item);
  holders.push(node);
  var removedAny = false;
  var kept = 0;
  var saw = false;
  var keys = ["items", "moduleItems"];
  for (var h = 0; h < holders.length; h++) {
    var holder = holders[h];
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (!Array.isArray(holder[key])) continue;
      saw = true;
      var filtered = [];
      for (var i = 0; i < holder[key].length; i++) {
        if (entryIsAd(holder[key][i])) removedAny = true;
        else filtered.push(holder[key][i]);
      }
      holder[key] = filtered;
      kept += filtered.length;
    }
  }
  return saw && removedAny && kept === 0;
}

function treeHasInjectableMarker(node, depth) {
  if (!node || typeof node !== "object" || depth > 8) return false;
  if (eventInfoIsInjectable(node.clientEventInfo)) return true;
  var keys = Object.keys(node);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (SKIP_DESCENT[key]) continue;
    var child = node[key];
    if (child && typeof child === "object" && treeHasInjectableMarker(child, depth + 1)) return true;
  }
  return false;
}

function isNonEntryInstruction(node) {
  if (!node || typeof node.type !== "string" || node.type.indexOf("Timeline") !== 0) return false;
  if (Array.isArray(node.entries) || Array.isArray(node.moduleItems) || Array.isArray(node.items)) return false;
  if (node.entry) return false;
  return true;
}

function shouldDropInstruction(node) {
  if (!isNonEntryInstruction(node)) return false;
  if (node.type === "TimelineTerminateTimeline" || node.type === "TimelineClearCache") return false;
  return treeHasInjectableMarker(node, 0);
}

function isEmptiedWrapper(node) {
  if (!node || typeof node !== "object") return false;
  if (node.type === "TimelinePinEntry" || node.type === "TimelineReplaceEntry") return !node.entry;
  return Object.keys(node).length === 0;
}

function cleanNode(node, depth) {
  if (node == null || typeof node !== "object") return node;
  if (depth > 48) return node;
  if (Array.isArray(node)) return cleanArray(node, depth);

  if (typeof node.moduleEntryId === "string" && idIsInjectable(node.moduleEntryId)) return undefined;
  if (entryIsAd(node)) return undefined;
  if (stripModuleAds(node)) return undefined;

  var removed = false;
  var keys = Object.keys(node);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = node[key];
    if (!value || typeof value !== "object") continue;
    var cleaned = cleanNode(value, depth + 1);
    if (typeof cleaned === "undefined") {
      delete node[key];
      removed = true;
    } else {
      node[key] = cleaned;
    }
  }

  if (shouldDropInstruction(node)) return undefined;
  if (removed && isEmptiedWrapper(node)) return undefined;
  return node;
}

function cleanArray(arr, depth) {
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    if (isPromotedRestTweet(item) || isPromotedTrendObject(item)) continue;
    var cleaned = cleanNode(item, depth + 1);
    if (typeof cleaned === "undefined") continue;
    out.push(cleaned);
  }
  return out;
}

function isSensitiveUrl(url) {
  if (typeof url !== "string" || !url) return false;
  return /\/(?:dm\/|dm_|direct_messages|DmConversation|SendDm|CreateTweet|DeleteTweet|FavoriteTweet|UnfavoriteTweet|CreateRetweet|DeleteRetweet|onboarding\/|oauth|guest\/activate|media\/upload|account\/login)/i.test(
    url
  );
}

function processResponse(url, body) {
  if (isSensitiveUrl(url)) {
    if (typeof body !== "string") throw new Error("empty body");
    return body;
  }
  if (typeof body !== "string") {
    if (body == null) throw new Error("empty body");
    body = String(body);
  }
  if (!body) throw new Error("empty body");

  var payload = JSON.parse(body);
  if (!payload || typeof payload !== "object") throw new Error("not a json object");
  if (!Array.isArray(payload) && payload.errors && payload.data == null) return body;

  var cleaned = cleanNode(payload, 0);
  if (typeof cleaned === "undefined") return body;
  return JSON.stringify(cleaned);
}

function applyResponse(url, body) {
  try {
    return { body: processResponse(url, body) };
  } catch (error) {
    return {};
  }
}

if (typeof $done === "function") {
  try {
    var requestUrl = typeof $request !== "undefined" && $request ? $request.url : "";
    var responseBody = typeof $response !== "undefined" && $response ? $response.body : undefined;
    var result = applyResponse(requestUrl, responseBody);
    if (result.body == null) {
      console.log("[X去广告] 响应未改写");
      $done({});
    } else {
      $done(result);
    }
  } catch (error) {
    console.log("[X去广告] 响应处理失败：" + (error && error.message ? error.message : error));
    $done({});
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    processResponse: processResponse,
    applyResponse: applyResponse,
    entryIsAd: entryIsAd,
    cleanNode: cleanNode,
  };
}
