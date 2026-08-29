# ANIMAL / 3D

独立的 GitHub Pages 动物科普页面：

- Three.js 3D 场景
- 22 个动物 / 生物模型切换
- 所有模型从 `animal-3d/models/` 同源加载，避免第三方模型跨域
- GLB 模型加载与缓存
- Idle / Walk / Attack / Dead 动作控制
- 鼠标旋转与缩放
- 浏览器中文语音讲解
- 响应式布局

访问：`/animal-3d/`

## 当前模型

当前页面包含 22 个模型：

1. 非洲狮
2. 孟加拉虎
3. 鮟鱇鱼
4. 蝙蝠
5. 柯基犬
6. 鸭子
7. 河马
8. 水母
9. 鸭嘴兽
10. 犀牛
11. 鲨鱼
12. 蜜蜂
13. 野猪
14. 河豚
15. 山羊
16. 旱獭
17. 猫头鹰
18. 老鼠
19. 海豹
20. 鲸
21. Gobkit Red
22. Gobkit Blue

## 模型来源与授权

新增的 20 个模型来自 Gobkit Free Animal Pack / Vol. 2。Gobkit 的免费资源清单标注这些动物包为 CC0 1.0，并使用统一的 rigged 动画：Idle / Attack / Dead / Walk，动画帧率为 24 FPS。

Lion 使用项目原有的 `code4fukui/vr-cats` 模型，原始许可证为 CC BY-NC-SA 4.0；对应说明保存在 `models/ATTRIBUTIONS.md`。

Tiger 保留项目现有模型。

详细来源、下载地址及授权记录见：`animal-3d/models/ATTRIBUTIONS.md`。

## 动画实现

Gobkit 的部分 GLB 把多个动作放在同一个 animation clip 中，因此页面会按统一帧区间切片：

- 0–29：Idle
- 30–59：Attack
- 60–89：Dead
- 90–119：Walk

Lion / Tiger 则优先根据原始动画 clip 名称匹配 Idle / Walk / Attack 等动作。

## 下载方式

仓库包含 `.github/workflows/animal-3d-assets.yml`。更新资源清单或手动执行 Workflow 时，它会把外部模型下载到 `animal-3d/models/` 并提交回仓库。页面运行时只读取同源本地 GLB。
