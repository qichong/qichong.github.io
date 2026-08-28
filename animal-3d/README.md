# ANIMAL / 3D

独立的 GitHub Pages 动物科普页面：

- Three.js 3D 场景
- 🦁 狮子 / 🐯 孟加拉虎切换
- GLB 模型加载
- Idle / Walk / Roar 动作控制
- 鼠标旋转与缩放
- 浏览器中文语音讲解
- 响应式布局

访问：`/animal-3d/`

## 模型说明

狮子模型来自 `code4fukui/vr-cats`，该项目 README 标注原始模型为 kenchoo 的 Sketchfab 作品，许可证为 CC BY-NC-SA 4.0；项目文件中的 `lion.glb` 约 5.4 MB。

老虎现在使用 Google 搜索动物展示使用的孟加拉虎 GLB：
`https://storage.googleapis.com/ar-answers-in-search-models/static/Tiger/model.glb`

老虎这个 GLB 本身不保证包含与狮子完全一致的 Idle / Walk / Roar 骨骼动画，因此页面采用“原生 GLB 动画优先；缺失时使用轻量展示动画”的策略。后续如果找到授权明确、并同时包含多个完整猫科动作的 Tiger GLB，可以直接替换 URL，不需要改 Three.js 动画控制层。

## 动画控制

页面会优先按名称匹配 GLB 中的动画 clip：

- `Idle` / `Stand` / `Rest` / `Breath`
- `Walk` / `Walking` / `Stroll` / `Run`
- `Roar` / `Growl` / `Attack` / `Call`

如果某个动作不存在，会自动使用该模型的可用动作或轻量程序化展示，避免按钮失效。
