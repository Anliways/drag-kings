'use strict';
/* ================= 第三方贴图资源注册表 =================
   全部素材为 CC0 公有领域（详见 assets/README.md）。
   图片未加载（离线 / 无头测试 / file:// 受限）时，
   render.js 会逐项检查并回退到程序化绘制，游戏功能不受影响。 */
const GameAssets = {
  base: 'assets/',
  smoke: [],            /* Kenney 烧胎烟雾贴图（白色软粒子） */
  cars: {},             /* OGA 侧视贴图车（已裁剪 alpha 边界并统一朝右） */

  init(){
    if(this.ready) return;
    this.ready = true;
    const mk = src => {
      const img = new Image();
      img.src = this.base + src;
      return img;
    };
    /* Kenney Particle Pack (CC0, kenney.nl) — 烧胎烟雾 */
    for(const f of ['smoke_01.png', 'smoke_04.png', 'smoke_07.png']){
      this.smoke.push(mk('kenney/particle-pack/' + f));
    }
    /* OpenGameArt "Side View Cars Game Assets" (CC0, Unlucky Studio) — 对手贴图车 */
    const car = (key, src) => {
      this.cars[key] = { img: mk('opengameart/side-view-cars/' + src), flame: [-2.16, -0.16] };
    };
    car('audi', 'audi.png');
    car('audi4', 'audi4.png');
    car('truck', 'truck.png');
    car('supercar', 'supercar.png');
    car('wedge_gold', 'wedge_gold.png');
    car('wedge_blue', 'wedge_blue.png');
  },
};
