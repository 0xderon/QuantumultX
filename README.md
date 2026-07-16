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
