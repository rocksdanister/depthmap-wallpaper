const container = document.getElementById("container");
const gui = new dat.GUI();
let isPaused = false;
let wasPaused = true;
let originX = -1;
let originY = -1;

let scene, camera, renderer, material;
let settings = {
  debug: false,
  fps: 60,
  parallaxVal: 1,
  xThreshold: 30,
  yThreshold: 15,
  xThresholdMax: 50,
  yThresholdMax: 50,
  xThresholdMin: 1,
  yThresholdMin: 1,
};
const cursor = {
  x: 0,
  y: 0,
  lerpX: 0,
  lerpY: 0,
};

async function init() {
  renderer = new THREE.WebGLRenderer({
    antialias: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight, 2);
  container.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  material = new THREE.ShaderMaterial({
    uniforms: {
      u_tex0: { type: "t" },
      u_depth_tex0: { type: "t" },
      u_blur: { value: false, type: "b" },
      u_texture_fill: { value: true, type: "b" },
      u_mouse: { value: new THREE.Vector2(0, 0), type: "v2" },
      u_threshold: {
        value: new THREE.Vector2(settings.xThreshold, settings.yThreshold),
      },
      u_resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        type: "v2",
      },
      u_tex0_resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        type: "v2",
      },
    },
    vertexShader: `
          varying vec2 vUv;        
          void main() {
              vUv = uv;
              gl_Position = vec4( position, 1.0 );    
          }
        `,
    fragmentShader: `
      precision mediump float;
      uniform sampler2D u_tex0; 
      uniform sampler2D u_depth_tex0; 
      uniform vec2 u_mouse;
      uniform vec2 u_threshold;
      uniform vec2 u_tex0_resolution;
      uniform vec2 u_resolution;
      uniform bool u_texture_fill;
      uniform bool u_blur;

      varying vec2 vUv;

      vec2 mirrored(vec2 v) {
        vec2 m = mod(v,2.);
        return mix(m,2.0 - m, step(1.0 ,m));
      }

      void main() {
        vec2 UV = gl_FragCoord.xy / u_resolution.xy;

        if(u_texture_fill) {
          float screenAspect = u_resolution.x / u_resolution.y;
          float textureAspect = u_tex0_resolution.x / u_tex0_resolution.y;
          float scaleX = 1., scaleY = 1.;
          if(textureAspect > screenAspect )
            scaleX = screenAspect / textureAspect;
          else
            scaleY = textureAspect / screenAspect;
            UV = vec2(scaleX, scaleY) * (UV - 0.5) + 0.5;
        }

        vec4 depthMap = texture2D(u_depth_tex0, mirrored(UV));
        vec2 fake3d = vec2(UV.x + (depthMap.r - 0.5) * u_mouse.x / u_threshold.x, UV.y + (depthMap.r - 0.5) * u_mouse.y / u_threshold.y);

        float lod = u_blur && depthMap.r < 0.5 ? 2. : 0.;
        gl_FragColor = textureLod(u_tex0, mirrored(fake3d), lod);
      }
    `,
  });

  new THREE.TextureLoader().load("media/image.jpg", function (tex) {
    material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
    material.uniforms.u_tex0.value = tex;
  });
  material.uniforms.u_depth_tex0.value = await new THREE.TextureLoader().loadAsync("media/depth.jpg");

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), material);
  scene.add(quad);

  if (settings.debug) {
    createWebUI();
    gui.show();
  } else {
    gui.hide();
  }
}

window.addEventListener("resize", function (e) {
  renderer.setSize(window.innerWidth, window.innerHeight, 2);

  material.uniforms.u_resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
});

function render() {
  setTimeout(function () {
    requestAnimationFrame(render);
  }, 1000 / settings.fps);

  // Reset to prevent overflow
  if (cursor.lerpX > 21600 || cursor.lerpY > 21600)
  {
    cursor.x = 0;
    cursor.y = 0;
    cursor.lerpX = 0;
    cursor.lerpY = 0;
  }

  // Set Cursor Variables
  const parallaxX = cursor.x * 0.5;
  const parallaxY = -cursor.y * 0.5;

  cursor.lerpX += (parallaxX - cursor.lerpX) * 5 * 0.016;
  cursor.lerpY += (parallaxY - cursor.lerpY) * 5 * 0.016;

  // Mouse Positioning Uniform Values
  material.uniforms.u_mouse.value = new THREE.Vector2(cursor.lerpX, cursor.lerpY);

  renderer.render(scene, camera);
}

function livelyWallpaperPlaybackChanged(data) {
  var obj = JSON.parse(data);
  isPaused = obj.IsPaused;

  if (isPaused) {
    // cursor.x = 0;
    // cursor.y = 0;
    // cursor.lerpX = 0;
    // cursor.lerpY = 0;
    wasPaused = true;
  }
}

let lastX = 0;
let lastY = 0;
//depth input
document.addEventListener("mousemove", (event) => {
  if (isPaused) return;

  if (wasPaused) {
    originX = event.pageX;
    originY = event.pageY;

    wasPaused = false;
  }

  cursor.x = clamp((originX - event.pageX) / window.innerWidth, "x");
  cursor.y = clamp((originY - event.pageY) / window.innerHeight, "y");

  lastX = cursor.x;
  lastY = cursor.y;
});

function clamp(value, origin) {
  let fixedVal = value;
  if (value < -0.5) {
    fixedVal = -0.5;
    let diff = value + 0.5;

    if (origin == "x") originX -= diff * window.innerWidth;
    else originY -= diff * window.innerHeight;
  } else if (value > 0.5) {
    fixedVal = 0.5;
    let diff = value - 0.5;

    if (origin == "x") originX -= diff * window.innerWidth;
    else originY -= diff * window.innerHeight;
  }
  return fixedVal;
}

// document.addEventListener("mouseout", (event) => {
//   cursor.x = 0;
//   cursor.y = 0;
// });

// document.addEventListener("touchmove", (event) => {
//   const touch = event.touches[0];
//   cursor.x = touch.pageX / window.innerWidth - 0.5;
//   cursor.y = touch.pageY / window.innerHeight - 0.5;
// });

// document.addEventListener("touchend", (event) => {
//   cursor.x = 0;
//   cursor.y = 0;
// });

//docs: https://github.com/rocksdanister/lively/wiki/Web-Guide-IV-:-Interaction
function livelyPropertyListener(name, val) {
  switch (name) {
    case "xThreshold":
      material.uniforms.u_threshold.value.x = settings.xThresholdMax - val + 1;
      break;
    case "yThreshold":
      material.uniforms.u_threshold.value.y = settings.yThresholdMax - val + 1;
      break;
    case "stretch":
      material.uniforms.u_texture_fill.value = val;
      break;
    case "blur":
      material.uniforms.u_blur.value = val;
      break;
    case "fpsLock":
      settings.fps = val ? 30 : 60;
      break;
  }
}

function createWebUI() {
  gui
    .add(settings, "xThreshold")
    .min(settings.xThresholdMin)
    .max(settings.xThresholdMax)
    .step(1)
    .name("X Threshold")
    .onChange(function () {
      material.uniforms.u_threshold.value.x = settings.xThresholdMax - settings.xThreshold + 1;
    });
  gui
    .add(settings, "yThreshold")
    .min(settings.yThresholdMin)
    .max(settings.yThresholdMax)
    .step(1)
    .name("Y Threshold")
    .onChange(function () {
      material.uniforms.u_threshold.value.y = settings.yThresholdMax - settings.yThreshold + 1;
    });
  gui.add(material.uniforms.u_blur, "value").name("Blur");
  gui.add(material.uniforms.u_texture_fill, "value").name("Scale to Fill");
}

init();
render();
