<script>
  let paused = false;
  let video = document.createElement('video');
  let data;
  /**
   * @type {number}
   */
  let target_x;
  /**
   * @type {number}
   */
  let target_y;
  let canvas;
  /**
   * @type {CanvasRenderingContext2D| null}
   */
  let ctx;
  /**
   * @type {ImageData}
   */
  let pixel;
  /**
   * @type {string}
   */
  let hex;
  /**
   * @type {string}
   */
  let buttonstr;
  /**
   * @param {HTMLVideoElement} videoObject
   */
  const mediaStream = window.navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then((videoStream) => {
      // yay we can now assign srcObject to videoStream
      if (video !== null) {
        video.srcObject = videoStream;
      }
    })
    .catch((e) => {
      // tell the user something went wrong, e has the reason for why it failed
      console.error('something is wrong :c', e);
    });
  /**
   * @type {HTMLVideoElement}
   */
  let vid = document.createElement('video');
  let refreshIntervalId = setInterval(() => {
    target_x = video.videoWidth / 2;
    target_y = video.videoHeight / 2;
    canvas = document.createElement('canvas');
    console.log('video width here', video.videoWidth);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx = canvas.getContext('2d');
    console.log(canvas.width);
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      data = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);
      console.log(target_x, target_y);

      pixel = ctx.getImageData(target_x, target_y, 1, 1);
      hex = rgbToHex(pixel.data[0], pixel.data[1], pixel.data[2]);
      buttonstr = hex;

      let changeObject = document.getElementById('change');
      let complimentObject = document.getElementById('compliment');
      let complimentObject1 = document.getElementById('compliment1');
      let c2 = document.getElementById('c2');

      if (changeObject && complimentObject && c2 && complimentObject1) {
        changeObject.style.background = 'rgba(' + pixel.data + ')';
        complimentObject.style.color =
          'rgba(' + getComplimentColor(pixel).data + ')';
        complimentObject1.style.color =
          'rgba(' + getComplimentColor(pixel).data + ')';
        complimentObject1.style.borderBottom =
          'rgba(' + getComplimentColor(pixel).data + ')  solid 2px';
        c2.style.border =
          'rgba(' + getComplimentColor(pixel).data + ') solid 4px';
      }
    }
  }, 100);

  /**
   * @param {any} input
   * takes in a pixel
   */
  function getComplimentColor(input) {
    let r = input.data[0];
    let g = input.data[1];
    let b = input.data[2];
    const pixelarray = new Uint8ClampedArray([
      255 - r,
      255 - g,
      255 - b,
      input.data[3],
    ]);
    let cc = new ImageData(pixelarray, 1, 1);
    return cc;
  }
  function pauseVideo() {
    paused = !paused;
    if (paused) {
      video.pause();
    } else {
      video.play();
    }
  }
  let copyIndicator = false;
  function copy() {
    copyIndicator = true;
    setTimeout(function () {
      copyIndicator = false;
    }, 1000);
  }

  /**
   * @param {{ toString: (arg0: number) => any; }} c
   */
  function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  /**
   * @param {{ toString: (arg0: number) => any; }} r
   * @param {{ toString: (arg0: number) => any; }} g
   * @param {{ toString: (arg0: number) => any; }} b
   */
  function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }
  $: buttonstr = copyIndicator ? hex + ' copied' : hex;
</script>

<main id="change">
  <div>
    <h1>Seyan</h1>
  </div>
  <button on:click={copy}
    ><span style="font-size:1em " id="compliment1">{buttonstr}</span></button
  >
  <!-- svelte-ignore a11y-media-has-caption -->
  <div class="parent">
    <button id="compliment" class="pauseButton" on:click={pauseVideo}>
      <video id="myvideo" autoplay bind:this={video} playsinline /></button
    >
    <div id="c2" class="aimline" />
  </div>
  <p>
    <span style="background-color:#FF0000;color:white"
      >{(pixel?.data[0]).toString().padStart(3, '0')}
    </span>
    <span style="background-color:#00FF00"
      >{(pixel?.data[1]).toString().padStart(3, '0')}</span
    >
    <span style="background-color:#0000FF;color:white"
      >{(pixel?.data[2]).toString().padStart(3, '0')}</span
    >
  </p>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 100vw;
    margin: 0 auto;
    background: black;
    height: 100vh;
  }
  @media screen and (max-width: 600px) {
    main {
      max-height: 100vh;
    }
  }

  h1 {
    text-transform: uppercase;
    display: inline;
    font-size: 3rem;
    font-weight: 100;
    font-family: 'Monoton', cursive;
    background-image: linear-gradient(
      to right,
      red,
      orange,
      yellow,
      green,
      cyan,
      blue,
      purple
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  @media screen and (max-width: 600px) {
    h1 {
      margin: 0px;
      padding: 0px;
      /* line-height: 100%; */
    }
  }
  p {
    margin-bottom: 0px;
  }
  span {
    font-family: 'Space Mono', monospace;
    font-size: 3em;
    margin: 1em;
  }
  @media screen and (max-width: 600px) {
    span {
      margin: 0em;
    }
  }
  video {
    max-width: 100%;
    max-height: 50vh;
  }
  button {
    border: transparent;
    background: transparent;
    padding: 0px;
    margin: 0px;
  }
  .pauseButton {
    border: transparent;
    background: transparent;
    padding: 10px;
    size: auto;
    margin: 0px;
  }
  .parent {
    position: relative;
  }
  .aimline {
    width: 5px;
    height: 5px;
    border: 4px black solid;
    position: absolute;
    top: 50%;
    left: 50%;
    margin: 0 auto;
    vertical-align: auto;
    transform: translate(-7px, -7px);
  }
</style>
