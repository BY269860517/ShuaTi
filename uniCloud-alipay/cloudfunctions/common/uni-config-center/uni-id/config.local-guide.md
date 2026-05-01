# uni-id 本地配置填写说明

这个目录下的 `config.json` 是本地真实配置文件，用于 HBuilderX 上传 `common/uni-config-center` 时一起部署到 uniCloud。它包含密钥，不要提交到 Git，也不要截图公开。

需要替换的字段：

- `passwordSecret`: 登录密码加密密钥。填写 32 位以上随机字符串。
- `tokenSecret`: token 签名密钥。填写 32 位以上随机字符串，不能和 `passwordSecret` 相同。
- `mp-weixin.oauth.weixin.appid`: 微信小程序 AppID，通常以 `wx` 开头。不是 DCloud AppID，也不是 `__UNI__...`。
- `mp-weixin.oauth.weixin.appsecret`: 微信小程序 AppSecret，在微信公众平台后台获取。

微信小程序 AppID / AppSecret 获取路径：

1. 打开 `https://mp.weixin.qq.com`
2. 进入对应小程序
3. 打开 `设置与开发 -> 开发管理 -> 开发设置`
4. 复制 `开发者ID(AppID)` 到 `appid`
5. 生成或查看 `AppSecret`，复制到 `appsecret`

填写完成后，在 HBuilderX 里按顺序上传：

1. `common/uni-config-center`
2. `common/uni-open-bridge-common`
3. `common/uni-id-common`
4. `common/uni-id`
5. `common/shuati-shared`
6. `userLogin`

如果修改过 `config.json`，至少需要重新上传 `common/uni-config-center` 和依赖它的登录相关云函数。
