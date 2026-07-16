"use strict";

var assert = require("assert");
var weibo = require("../scripts/weibo-ad");

var timeline = {
  statuses: [
    { id: 1, text: "普通微博", user: { name: "用户" } },
    { id: 2, text: "推广微博", ad_state: 1 },
    { id: 3, text: "另一条微博", extend_info: { shopwindow_cards: [{}] } },
  ],
  cards: [
    { card_type: 9, mblog: { id: 4, text: "正常卡片" } },
    { card_type: 118, title: "横幅广告" },
    { card_type: 17, card_group: [{ desc: "热搜" }, { promotion: { ad: 1 } }] },
  ],
};

var cleaned = weibo.cleanNode(timeline);
assert.deepStrictEqual(
  cleaned.statuses.map(function (item) {
    return item.id;
  }),
  [1, 3]
);
assert.strictEqual(cleaned.statuses[1].extend_info.shopwindow_cards, undefined);
assert.deepStrictEqual(
  cleaned.cards.map(function (item) {
    return item.card_type;
  }),
  [9, 17]
);
assert.strictEqual(cleaned.cards[1].card_group.length, 1);

var sdkBody = '{"ads":[{"id":1}],"show_push_splash_ad":true}OK';
var sdkResult = weibo.processResponse(
  "https://sdkapp.uve.weibo.com/interface/sdk/sdkad.php",
  sdkBody
);
assert.deepStrictEqual(JSON.parse(sdkResult.slice(0, -2)).ads, []);
assert.strictEqual(
  JSON.parse(sdkResult.slice(0, -2)).show_push_splash_ad,
  false
);

var luaResult = weibo.processResponse(
  "https://wbapp.uve.weibo.com/wbapplua/wbpullad.lua",
  '{"cached_ad":{"ads":[{"id":1}]}}'
);
assert.deepStrictEqual(JSON.parse(luaResult).cached_ad.ads, []);

console.log("微博去广告脚本测试通过");
