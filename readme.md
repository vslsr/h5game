这是一个即时弹射小游戏：
核心玩法：通过拖拽弹射单位，攻击其他游戏对象。

游戏流程：
* 初始时，可以选择阵营，输入名称，服务器分配id
* 玩家加入房间
* 玩家根据阵营选择并创建初始单位
* 玩家通过弹射控制这些单位（进攻，移动，收集）
* 玩家断开连接后，删除所有单位

局外功能：
* 登录功能

功能点：控制器
<!-- * 实现单位控制器：点击一个单位后，选中这个单位，此时显示这个单位的技能列表、名称等基础信息。
    * 单位属性：生命值，攻击力，质量(弹射时用)，速度（弹射基础速度），名称，所属玩家
    * 使用弹射控制单位：点击此单位时，显示发射摇杆，松开时隐藏。摇杆使用一个大一点的圈显示当前拖拽位置，需要有箭头方向。
    * 弹射控制器拉出的距离越小，发射速度更小。
* 在单位选择后，只在点击此单位时，显示发射摇杆，松开时隐藏。摇杆不会在屏幕任意位置出现。
* 删除移动摇杆，技能中默认添加一个移动技能，在选择移动技能时，可以通过右侧的发射摇杆弹射这个单位。
* 单位单位之间可以碰撞（目前只需要方形、圆形、点的碰撞）
* 弹射摇杆手感修改：拉出的距离越小，发射速度更小。摇杆中间的点使用一个圆环表示，避免挡住单位。 -->

* 镜头控制器：实现双指放大缩小，实现点击空白处移动地图。
* 实现小地图，对象使用一个小icon在小地图上绘制，小地图上显示一个当前屏幕大小相对应的框，在拖动小地图的框时可以拖动镜头。

功能点：单位设计
* 单位属性
    * 生命值，攻击力，质量(弹射时用)，速度（弹射基础速度），名称，所属玩家
* 单位技能列表
    * 在属性显示列表展示技能列表，类似RTS游戏中的方格方式实现
    * 技能类型：
        * 冲击波、瞬移等在某个点释放的技能，采用一个圆圈表示范围，可以取消，不需要通过拖拽释放，点击到圆圈范围内即可。
        * 圆形范围会被墙体阻挡，裁切为多个扇形。
        * 技能不消耗生命值。
        * 在取消选择时，默认回到弹射技能
    * 弹射类技能：在使用此技能时，使用弹射控制会发射一个子弹，而不是移动。
    * 技能可以取消
* 单位buff：buff是用于修改属性的

功能点：资源
* 玩家拥有资源

功能点：基础设施
* 对websocket进行局域网穿透

Skill: 技能 = 旧的武器，有 speedMin, speedMax, damageMin, damageMax, lifetimeMs, explosive 等
Unit: 单位 = 一种可控的实体模板，包含：unitId, name, icon, description, hue 或 color, skills[]
PlayerUnitsPayload: 加入房间时下发给玩家的可用单位列表 + 当前选择
同时简化 inventory 相关的旧接口为"可选保留"，但服务端不再使用


# deploy脚本

```
# ========== 1. 装环境 ==========
ssh root@你的公网IP

# 装 Node.js 20.x（用 nodesource 仓库，确保有新版）
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -

# 装依赖 + nginx + git
yum install -y nodejs git nginx

# 验证
node -v    # v20.x.x
npm -v     # 10.x
nginx -v   # 1.x

# ========== 2. 拉代码 + 构建 ==========
mkdir -p /opt
cd /opt
git clone https://github.com/ 你的用户名/你的仓库.git h5sgame
cd /opt/h5sgame

npm ci --no-audit --no-fund
npm run build

# 确认 dist/ 有产物
ls -la /opt/h5sgame/dist/

# ========== 3. systemd 管理 Node ==========
cp /opt/h5sgame/deploy/h5sgame.service /etc/systemd/system/h5sgame.service

# 【重要】改环境变量——把密钥换成你自己的长随机串
vi /etc/systemd/system/h5sgame.service
# 找到 H5SGAME_DEPLOY_KEY=change-me-to-a-long-random-string，改成你自己的

chmod +x /opt/h5sgame/deploy/deploy.sh

systemctl daemon-reload
systemctl enable h5sgame
systemctl start h5sgame

# 确认运行
systemctl status h5sgame
journalctl -u h5sgame -n 30

# ========== 4. nginx 反代（可选但推荐） ==========
cp /opt/h5sgame/deploy/nginx-ubuntu.conf /etc/nginx/conf.d/h5sgame.conf

# CentOS 下没有 sites-enabled 目录，直接放在 conf.d/ 即可
# 但是 conf.d/*.conf 会被主 nginx.conf include；
# 为避免与默认 80 端口冲突，先停掉默认首页（如果有）：
# 把 /etc/nginx/nginx.conf 里的默认 server 块注释掉（通常里面只有一个默认站点，端口冲突时才需要）
# 或者直接删除：
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

# 测试 + 重载
nginx -t            # 必须看到 test is successful
systemctl enable nginx
systemctl start nginx
systemctl reload nginx

# ========== 5. 放通端口（firewalld / 云安全组） ==========
# CentOS 默认带 firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-port=3000/tcp   # 如果你不装 nginx，留着；装了 nginx 可以只留 80/443
firewall-cmd --reload

# 别忘了在云厂商控制台（阿里云/腾讯云）放行同样的端口
```