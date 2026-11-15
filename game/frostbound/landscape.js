(() => {
  "use strict";
  class OrientationGate {
    constructor() { this.allowPortrait=false; }
    allow() { this.allowPortrait=true; }
    reset() { this.allowPortrait=false; }
    blocks({touch,portrait,running,finished}) {
      return touch&&portrait&&running&&!finished&&!this.allowPortrait;
    }
  }
  function camera(width,height,worldWidth,worldHeight) {
    const side=Math.min(92,width*.11);
    const scale=Math.min(height/worldHeight,(width-side*2)/worldWidth);
    return {x:Math.round((width-worldWidth*scale)/2),
      y:Math.round((height-worldHeight*scale)/2),scale,tall:false};
  }
  globalThis.FrostLandscape={OrientationGate,camera};
})();
