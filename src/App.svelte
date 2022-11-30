<script>
  // import {videoStream} from './store.js'

  /**
   * @type {MediaStream}
   */
  var videothing;
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
  // let video = document.createElement('video');

  setInterval(() => {
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

      let changeObject = document.getElementById('change');
      let complimentObject = document.getElementById('compliment');
      let c2 = document.getElementById('c2');

      if (changeObject && complimentObject && c2) {
        changeObject.style.background = 'rgba(' + pixel.data + ')';
        complimentObject.style.color =
          'rgba(' + getComplimentColor(pixel).data + ')';
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

  //  console.log(video.videoWidth, video.videoHeight);
</script>

<main id="change">
  <div id="compliment">
    <h1>Seyan</h1>
  </div>

  <!-- svelte-ignore a11y-media-has-caption -->
  <div class="parent">
    <video autoplay bind:this={video} playsinline />
    <div id="c2" class="aimline" />
  </div>
  <p>
    <span style="background-color:#FF0000;color:white"
      >{pixel?.data[0].toString()}</span
    >
    <span style="background-color:#00FF00">{pixel?.data[1].toString()}</span>
    <span style="background-color:#0000FF;color:white"
      >{pixel?.data[2].toString()}</span
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

  h1 {
    text-transform: uppercase;
    display: inline;
    font-size: 3em;
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
    max-height:50vh;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
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
