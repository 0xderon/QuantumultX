"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var xad = require("../scripts/x-ad");

var HOME = "https://api.x.com/graphql/AbCdEf_1/HomeTimeline";
var LATEST = "https://api.twitter.com/graphql/AbCdEf_1/HomeLatestTimeline?variables=%7B%7D";

function tweetEntry(id, text, extra) {
  var itemContent = {
    itemType: "TimelineTweet",
    tweet_results: {
      result: {
        __typename: "Tweet",
        rest_id: id,
        legacy: { full_text: text, id_str: id },
      },
    },
  };
  if (extra) {
    Object.keys(extra).forEach(function (key) {
      itemContent[key] = extra[key];
    });
  }
  return {
    entryId: "tweet-" + id,
    sortIndex: id,
    content: {
      entryType: "TimelineTimelineItem",
      clientEventInfo: { component: "suggest_ranked_organic_tweet", element: "tweet" },
      itemContent: itemContent,
    },
  };
}

function cursorEntry(kind) {
  return {
    entryId: "cursor-" + kind + "-promoted-looking-token",
    sortIndex: "0",
    content: {
      entryType: "TimelineTimelineCursor",
      cursorType: kind === "top" ? "Top" : "Bottom",
      value: "CUR",
    },
  };
}

function run(url, payload) {
  return JSON.parse(xad.processResponse(url, JSON.stringify(payload)));
}

function entryIds(entries) {
  return entries.map(function (entry) {
    return entry.entryId;
  });
}

var home = {
  data: {
    home: {
      home_timeline_urt: {
        instructions: [
          {
            type: "TimelinePinEntry",
            entry: tweetEntry("pinned", "置顶的普通推文"),
          },
          {
            type: "TimelinePinEntry",
            entry: {
              entryId: "promoted-tweet-pin",
              sortIndex: "pin",
              content: {
                itemContent: {
                  promotedMetadata: { impressionId: "pin", disclosureType: "NoDisclosure" },
                  tweet_results: { result: { rest_id: "pin-ad", legacy: { full_text: "置顶广告" } } },
                },
              },
            },
          },
          {
            type: "TimelineAddEntries",
            entries: [
              tweetEntry("1", "普通推文，正文里出现 promotedMetadata 这个词"),
              {
                entryId: "tweet-2",
                sortIndex: "2",
                content: {
                  itemContent: {
                    itemType: "TimelineTweet",
                    promotedMetadata: {
                      advertiser_results: {},
                      disclosureType: "NoDisclosure",
                      impressionId: "imp-2",
                    },
                    tweet_results: { result: { rest_id: "2", legacy: { full_text: "信息流广告" } } },
                  },
                },
              },
              {
                entryId: "sq-I-t-3",
                sortIndex: "3",
                content: {
                  item: {
                    content: {
                      tweet: {
                        id: "3",
                        displayType: "Tweet",
                        promotedMetadata: { impressionId: "legacy-3", disclosureType: "NoDisclosure" },
                      },
                    },
                  },
                },
              },
              {
                entryId: "tweet-4",
                sortIndex: "4",
                content: {
                  itemContent: {
                    itemType: "TimelineTweet",
                    tweet_results: {
                      result: {
                        __typename: "TweetWithVisibilityResults",
                        tweet: {
                          rest_id: "4",
                          promotedMetadata: { impressionId: "vis-4" },
                          legacy: { full_text: "可见性包装里的广告" },
                        },
                      },
                    },
                  },
                },
              },
              {
                entryId: "tweet-5",
                sortIndex: "5",
                content: {
                  clientEventInfo: { component: "suggest_ranked_organic_tweet", element: "tweet" },
                  itemContent: {
                    itemType: "TimelineTweet",
                    tweet_results: {
                      result: {
                        __typename: "TweetWithVisibilityResults",
                        tweet: { rest_id: "5", legacy: { full_text: "受限可见但仍是普通推文" } },
                      },
                    },
                  },
                },
              },
              {
                entryId: "tweet-5b",
                sortIndex: "5b",
                content: {
                  itemContent: {
                    itemType: "TimelineTweet",
                    tweet_results: {
                      result: {
                        __typename: "TweetWithVisibilityResults",
                        tweet: { rest_id: "5b", legacy: { full_text: "没有推广标记的可见性包装" } },
                      },
                    },
                  },
                },
              },
              {
                entryId: "who-to-follow-9",
                sortIndex: "9",
                content: {
                  entryType: "TimelineTimelineModule",
                  clientEventInfo: { component: "suggest_who_to_follow" },
                  items: [
                    {
                      entryId: "user-99",
                      sortIndex: "99",
                      item: { itemContent: { user_results: { result: { rest_id: "99" } } } },
                    },
                  ],
                },
              },
              {
                entryId: "messageprompt-premium-upsell-1",
                sortIndex: "10",
                content: {
                  clientEventInfo: { component: "premium_upsell", element: "prompt" },
                  itemContent: { itemType: "TimelineMessagePrompt", content: { headerText: "Get Premium" } },
                },
              },
              {
                entryId: "trend-module",
                sortIndex: "11",
                content: {
                  entryType: "TimelineTimelineModule",
                  items: [
                    {
                      entryId: "trend-news",
                      sortIndex: "11a",
                      item: { itemContent: { trend: { name: "#news" } } },
                    },
                    {
                      entryId: "promoted-trend-1",
                      sortIndex: "11b",
                      item: {
                        itemContent: {
                          trend: { name: "#ad", promotedMetadata: { impressionId: "trend-1" } },
                        },
                      },
                    },
                  ],
                },
              },
              {
                entryId: "community-join-7",
                sortIndex: "12",
                content: {
                  entryType: "TimelineTimelineModule",
                  clientEventInfo: { component: "community_to_join" },
                  items: [{ entryId: "community-7", sortIndex: "12a", item: { itemContent: { itemType: "TimelineCommunity" } } }],
                },
              },
              cursorEntry("bottom"),
            ],
          },
          {
            type: "TimelineShowAlert",
            alertType: "NewTweets",
            displayDurationMs: 2000,
          },
          {
            type: "TimelineShowCover",
            cover: {
              primaryText: { text: "Upgrade" },
              primaryCoverCta: { text: "Subscribe", clientEventInfo: { action: "premium_upsell" } },
            },
          },
          {
            type: "TimelineTerminateTimeline",
            direction: "Bottom",
          },
        ],
      },
    },
  },
};

var cleanedHome = run(HOME, home);
var instructions = cleanedHome.data.home.home_timeline_urt.instructions;
assert.deepStrictEqual(
  instructions.map(function (item) {
    return item.type;
  }),
  ["TimelinePinEntry", "TimelineAddEntries", "TimelineShowAlert", "TimelineTerminateTimeline"]
);
assert.strictEqual(instructions[0].entry.entryId, "tweet-pinned");
assert.deepStrictEqual(entryIds(instructions[1].entries), [
  "tweet-1",
  "tweet-5",
  "tweet-5b",
  "trend-module",
  "community-join-7",
  "cursor-bottom-promoted-looking-token",
]);
assert.deepStrictEqual(entryIds(instructions[1].entries[3].content.items), ["trend-news"]);
assert.strictEqual(instructions[1].entries[0].content.itemContent.tweet_results.result.legacy.full_text.indexOf("promotedMetadata") !== -1, true);
assert.strictEqual(instructions[2].alertType, "NewTweets");

var latestIds = entryIds(
  run(LATEST, home).data.home.home_timeline_urt.instructions[1].entries
);
assert.deepStrictEqual(latestIds, entryIds(instructions[1].entries));

var detail = {
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: "TimelineAddEntries",
          entries: [
            {
              entryId: "conversationthread-10",
              sortIndex: "10",
              content: {
                entryType: "TimelineTimelineModule",
                items: [
                  {
                    entryId: "tweet-10",
                    item: {
                      itemContent: {
                        tweet_results: { result: { rest_id: "10", legacy: { full_text: "主帖" } } },
                      },
                    },
                  },
                  {
                    entryId: "tweet-11",
                    item: {
                      itemContent: {
                        tweet_results: { result: { rest_id: "11", legacy: { full_text: "回复" } } },
                      },
                    },
                  },
                  {
                    entryId: "promotedTweet-12",
                    item: {
                      itemContent: {
                        promotedMetadata: { impressionId: "reply-ad" },
                        tweet_results: { result: { rest_id: "12", legacy: { full_text: "回复区广告" } } },
                      },
                    },
                  },
                ],
              },
            },
            {
              entryId: "tweet-13",
              sortIndex: "13",
              content: {
                itemContent: {
                  socialContext: { contextType: "Promoted", text: "已推广" },
                  tweet_results: { result: { rest_id: "13", legacy: { full_text: "只有角标的广告" } } },
                },
              },
            },
            {
              entryId: "tweet-14",
              sortIndex: "14",
              content: {
                itemContent: {
                  socialContext: { contextType: "Follow", text: "Alice followed" },
                  tweet_results: { result: { rest_id: "14", legacy: { full_text: "好友关注的普通推文" } } },
                },
              },
            },
          ],
        },
      ],
    },
  },
};

var detailEntries = run(
  "https://api.twitter.com/graphql/zzz/TweetDetail",
  detail
).data.threaded_conversation_with_injections_v2.instructions[0].entries;
assert.deepStrictEqual(entryIds(detailEntries), ["conversationthread-10", "tweet-14"]);
assert.deepStrictEqual(entryIds(detailEntries[0].content.items), ["tweet-10", "tweet-11"]);

var search = {
  data: {
    search_by_raw_query: {
      search_timeline: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                tweetEntry("s1", "搜索结果"),
                {
                  entryId: "tweet-s2",
                  sortIndex: "s2",
                  content: {
                    itemContent: {
                      displayType: "PromotedTweet",
                      tweet_results: { result: { rest_id: "s2", legacy: { full_text: "搜索广告" } } },
                    },
                  },
                },
                cursorEntry("bottom"),
              ],
            },
          ],
        },
      },
    },
  },
};
assert.deepStrictEqual(
  entryIds(
    run("https://api.x.com/graphql/q/SearchTimeline", search).data.search_by_raw_query.search_timeline.timeline
      .instructions[0].entries
  ),
  ["tweet-s1", "cursor-bottom-promoted-looking-token"]
);

var profile = {
  data: {
    user: {
      result: {
        timeline_v2: {
          timeline: {
            instructions: [
              {
                type: "TimelineAddEntries",
                entries: [
                  tweetEntry("p1", "主页推文"),
                  {
                    entryId: "promoted-tweet-p2",
                    sortIndex: "p2",
                    content: {
                      itemContent: {
                        tweet_results: {
                          result: { legacy: { full_text: "主页广告", promoted_content: { impression_id: "p2" } } },
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    },
  },
};
assert.deepStrictEqual(
  entryIds(
    run("https://api.x.com/graphql/q/UserTweets", profile).data.user.result.timeline_v2.timeline.instructions[0]
      .entries
  ),
  ["tweet-p1"]
);

var users = {
  instructions: [
    {
      type: "TimelineAddEntries",
      entries: [
        {
          entryId: "user-10",
          sortIndex: "1",
          content: { itemContent: { user_results: { result: { rest_id: "10", legacy: { screen_name: "alice" } } } } },
        },
        {
          entryId: "user-11",
          sortIndex: "2",
          content: {
            itemContent: {
              user_results: { result: { rest_id: "11", legacy: { screen_name: "bob", description: "promoted creator" } } },
            },
          },
        },
        cursorEntry("bottom"),
      ],
    },
  ],
};
assert.deepStrictEqual(entryIds(run(HOME, users).instructions[0].entries), [
  "user-10",
  "user-11",
  "cursor-bottom-promoted-looking-token",
]);

var legacy = {
  globalObjects: {
    tweets: {
      "1": { id_str: "1", full_text: "organic", user: { id_str: "9" } },
      "2": { id_str: "2", full_text: "ad", promoted_content: { impression_id: "p" }, user: { id_str: "8" } },
    },
  },
  timeline: {
    instructions: [
      {
        addEntries: {
          entries: [
            {
              entryId: "tweet-1",
              sortIndex: "2",
              content: { item: { content: { tweet: { id: "1", displayType: "Tweet" } } } },
            },
            {
              entryId: "promoted-tweet-2",
              sortIndex: "1",
              content: { item: { content: { tweet: { id: "2", promotedMetadata: { impressionId: "p" } } } } },
            },
          ],
        },
      },
    ],
  },
};
var legacyCleaned = run(HOME, legacy);
assert.deepStrictEqual(
  legacyCleaned.timeline.instructions[0].addEntries.entries.map(function (entry) {
    return entry.entryId;
  }),
  ["tweet-1"]
);
assert.strictEqual(legacyCleaned.globalObjects.tweets["1"].full_text, "organic");
assert.strictEqual(legacyCleaned.globalObjects.tweets["2"].full_text, "ad");

var rest = run(HOME, [
  { id_str: "1", full_text: "hello", user: { id_str: "9" }, retweet_count: 0 },
  { id_str: "2", full_text: "buy", user: { id_str: "8" }, promoted_content: { impression_id: "p" }, retweet_count: 0 },
]);
assert.deepStrictEqual(
  rest.map(function (item) {
    return item.id_str;
  }),
  ["1"]
);

var trends = run("https://api.twitter.com/1.1/trends/place.json?id=1", [
  {
    trends: [
      { name: "#news", query: "%23news", tweet_volume: 10, promoted_content: null },
      { name: "#ad", query: "%23ad", promoted_content: { impression_id: "t" } },
      { name: "#promoted-word", query: "%23promoted-word", tweet_volume: 3, promoted_content: null },
    ],
    locations: [{ name: "Worldwide", woeid: 1 }],
  },
]);
assert.deepStrictEqual(
  trends[0].trends.map(function (item) {
    return item.name;
  }),
  ["#news", "#promoted-word"]
);
assert.strictEqual(trends[0].locations[0].woeid, 1);

var onlyAdsModule = {
  instructions: [
    {
      type: "TimelineAddEntries",
      entries: [
        {
          entryId: "conversationthread-empty",
          sortIndex: "1",
          content: {
            items: [
              {
                entryId: "promoted-tweet-only",
                item: { itemContent: { promotedMetadata: { impressionId: "only" } } },
              },
            ],
          },
        },
        cursorEntry("top"),
      ],
    },
  ],
};
assert.deepStrictEqual(entryIds(run(HOME, onlyAdsModule).instructions[0].entries), [
  "cursor-top-promoted-looking-token",
]);

var replaced = {
  instructions: [
    {
      type: "TimelineReplaceEntry",
      entry_id_to_replace: "tweet-1",
      entry: {
        entryId: "promoted-tweet-replace",
        sortIndex: "1",
        content: { itemContent: { promotedMetadata: { impressionId: "r" } } },
      },
    },
  ],
};
assert.deepStrictEqual(run(HOME, replaced).instructions, []);

var odd = run(HOME, { foo: 1, bar: [1, 2, { a: null }], nested: { ok: true } });
assert.deepStrictEqual(odd, { foo: 1, bar: [1, 2, { a: null }], nested: { ok: true } });

var errorBody = '{"errors":[{"message":"Rate limit"}]}';
assert.strictEqual(xad.processResponse(HOME, errorBody), errorBody);

var partial = run(HOME, {
  errors: [{ message: "partial" }],
  data: { home: { home_timeline_urt: { instructions: [{ type: "TimelineAddEntries", entries: [tweetEntry("1", "还在")] }] } } },
});
assert.strictEqual(partial.data.home.home_timeline_urt.instructions[0].entries[0].entryId, "tweet-1");

var createBody = JSON.stringify({
  data: { create_tweet: { tweet_results: { result: { rest_id: "1", promotedMetadata: { impressionId: "nope" } } } } },
});
assert.strictEqual(
  xad.processResponse("https://api.x.com/graphql/abc/CreateTweet", createBody),
  createBody
);
assert.strictEqual(
  xad.processResponse("https://api.twitter.com/1.1/dm/inbox.json", createBody),
  createBody
);

assert.deepStrictEqual(xad.applyResponse(HOME, "not-json"), {});
assert.deepStrictEqual(xad.applyResponse(HOME, ""), {});
assert.deepStrictEqual(xad.applyResponse(HOME, null), {});

var conf = fs.readFileSync(path.join(__dirname, "../rewrite/x.conf"), "utf8");
assert.ok(conf.indexOf("#!author=0xderon") !== -1);
assert.ok(conf.indexOf("兼容性增强") !== -1);
assert.ok(conf.indexOf("强制退出") !== -1);
assert.ok(conf.indexOf("udp_drop_list") !== -1);
assert.strictEqual(conf.indexOf("*"), -1);
assert.ok(conf.indexOf("hostname = api.x.com, api.twitter.com") !== -1);
assert.ok(!/weibo|google|alipay|stripe|ads-api/i.test(conf));
assert.ok(!/\/[0-9a-f]{40}\//.test(conf));

var scriptUrl = "https://raw.githubusercontent.com/0xderon/QuantumultX/main/scripts/x-ad.js";
conf.split("\n").forEach(function (line) {
  if (line.indexOf("url script-response-body") === -1) return;
  assert.ok(line.indexOf(scriptUrl) !== -1, line);
});

function matches(url) {
  var lines = conf.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf("url script-response-body") === -1) continue;
    var pattern = line.split(" url ")[0];
    if (new RegExp(pattern).test(url)) return true;
  }
  return false;
}

[
  "https://api.x.com/graphql/abc-DEF_1/HomeTimeline",
  "https://api.twitter.com/graphql/abc/HomeLatestTimeline?variables=%7B%7D",
  "https://api.x.com/i/api/graphql/abc/TweetDetail",
  "https://api.x.com/graphql/abc/SearchTimeline",
  "https://api.twitter.com/graphql/abc/UserTweets",
  "https://api.twitter.com/graphql/abc/UserTweetsAndReplies/",
  "https://api.x.com/graphql/abc/ExplorePage",
  "https://api.x.com/graphql/abc/ExploreSidebar",
  "https://api.x.com/graphql/abc/GenericTimelineById",
  "https://api.twitter.com/graphql/abc/ListLatestTweetsTimeline",
  "https://api.twitter.com/2/guide.json",
  "https://api.x.com/1.1/trends/place.json?id=1",
].forEach(function (url) {
  assert.strictEqual(matches(url), true, url);
});

[
  "https://api.x.com/graphql/abc/CreateTweet",
  "https://api.twitter.com/1.1/dm/inbox.json",
  "https://api.x.com/graphql/abc/HomeTimelineExtra",
  "https://x.com/i/api/graphql/abc/HomeTimeline",
  "https://twitter.com/i/api/graphql/abc/TweetDetail",
  "https://ads-api.x.com/graphql/abc/HomeTimeline",
  "https://api.x.com.evil.com/graphql/abc/HomeTimeline",
  "https://api.weibo.cn/2/statuses/friends_timeline",
  "https://api.twitter.com/1.1/trends/available.json",
].forEach(function (url) {
  assert.strictEqual(matches(url), false, url);
});

console.log("X 去广告脚本测试通过");
