# 第三方素材来源与许可证

本项目引入的所有第三方素材均为 **CC0 1.0 通用（公有领域贡献）**——
可任意使用（含商用）、无需署名、可修改再分发。本文件仅作来源追溯与致谢。

> 许可证全文：https://creativecommons.org/publicdomain/zero/1.0/

## 已采用

### 1. Kenney — Particle Pack 1.1（烧胎烟雾）

- 文件：`kenney/particle-pack/smoke_01.png`、`smoke_04.png`、`smoke_07.png`
- 作者：Kenney Vleugels（Kenney.nl）
- 来源：https://kenney.nl/assets/particle-pack
- 许可证：CC0 1.0（包内 `License.txt` 原文声明 "License (Creative Commons Zero, CC0)"）
- 用途：烧胎/起步烟雾粒子贴图（`js/render.js` drawParticles；未加载时回退为程序化圆形粒子）
- 后处理：无（原样拷贝）

### 2. Unlucky Studio — Side View Cars Game Assets（对手贴图车）

- 文件：`opengameart/side-view-cars/audi.png`、`audi4.png`、`truck.png`、`supercar.png`、`wedge_gold.png`、`wedge_blue.png`
- 作者：Sujit Yadav / Unlucky Studio（https://www.unluckystudio.com）
- 来源：https://opengameart.org/content/side-view-cars-game-assets
- 许可证：CC0 1.0（OpenGameArt 页面标注；包内 Read Me 声明可商用）
- 用途：六名对手与玩家可选车体的贴图外观（`js/assets.js` 注册，`js/render.js` drawCar 贴图分支；
  对手配置于 `js/data.js` OPPONENTS 的 `sprite` 字段——
  阿强=货车、Mika=绯红敞篷（Audi color_4）、东叔=蓝色经典楔形（Unknown car_2）、
  阿坤=金色经典楔形（Unknown car_1）、陈董=Audi 敞篷（color_1）、Zero=超跑）；
  玩家可在改装间「车体套件」中选择同款车体（`save.vis.body`，经典街车为程序化绘制）。
  素材缺失/未加载时自动回退为程序化绘制的车身。
- 后处理：按 alpha 边界裁剪（去除透明留白）；`truck.png`、`supercar.png`、`wedge_gold.png`、
  `wedge_blue.png` 原图朝左，已水平翻转为游戏统一的朝右方向；
  该四款车身不带轮毂（素材设计为 body+tyre 分离），已用包内 `tyre.png`
  按 sample.png 差分/轮廓扫描反推的轮位烘焙合成；重命名。

## 评估后未采用（留档）

- **Parallax City – Night (4 Colors)**（Glitch game assets）—
  https://opengameart.org/content/parallax-city-night-4-colors （CC0）。
  为像素风（160×144 平铺放大呈块状），与本项目"扁平矢量 + 霓虹点缀"的
  程序化夜景风格不匹配，评估后不集成，避免割裂。如未来做"复古像素主题"可复用。

## 运行时行为

`js/assets.js` 在浏览器中以 `new Image()` 异步加载以上贴图；
渲染端逐项检查 `img.complete && img.naturalWidth > 0`，
任何加载失败（离线、file:// 受限、无头测试）都自动回退到原有程序化绘制，游戏功能不受影响。
