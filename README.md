# QuantumultX

## 微博去广告

在 Quantumult X 中打开「设置 → 重写 → 引用」，添加以下订阅地址：

```text
https://raw.githubusercontent.com/0xderon/QuantumultX/main/rewrite/weibo.conf
```

启用订阅后：

1. 按提示安装并信任 Quantumult X 的 MITM 证书。
2. 开启「重写」和「MitM」。
3. 关闭 Quantumult X 的「兼容性增强」，否则微博响应脚本可能不生效。
4. 完全退出微博后重新打开。

规则覆盖微博信息流、热搜、发现页、搜索、详情、评论区和开屏广告。接口或
响应格式发生变化时，脚本会保留原始响应，避免因解析失败影响微博使用。

## X（Twitter）去广告

在 Quantumult X 中打开「设置 → 重写 → 引用」，添加以下订阅地址：

```text
https://raw.githubusercontent.com/0xderon/QuantumultX/main/rewrite/x.conf
```

启用订阅后：

1. 按提示安装并信任 Quantumult X 的 MITM 证书。
2. 开启「重写」和「MitM」。
3. 关闭 Quantumult X 的「兼容性增强」，否则响应脚本可能不生效。
4. 更新该资源并重载配置，然后强制退出 X 后重新打开。

MitM 只有 `api.x.com` 和 `api.twitter.com`。脚本会去掉首页（为你推荐 / 正在关注）、推文详情、搜索、个人主页、探索和列表里带推广标记的条目，以及这些响应里的推荐关注、推广趋势和 Premium 推销。普通推文、登录、发帖和私信不会被改写。解析失败时保留原始响应。

## Google 搜索重定向

将 Safari 访问的 `google.cn` 或 `g.cn` 重定向到 `google.com`，并保留搜索
关键词和其他查询参数：

```text
https://raw.githubusercontent.com/0xderon/QuantumultX/main/rewrite/google-search-redirect.conf
```

该规则需要开启 MitM，并安装、信任 Quantumult X 生成的证书。`google.com`
还需使用可正常访问 Google 的分流策略。
