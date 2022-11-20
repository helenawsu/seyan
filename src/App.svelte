<script>
  import { onMount } from 'svelte';
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

  const mediaStream = window.navigator.mediaDevices.getUserMedia({video: true})
  .then(videoStream => {
     // yay we can now assign srcObject to videoStream
    if (video!=null) {
    video.srcObject = videoStream;
    target_x = video.videoWidth/2;
    target_y = video.videoWidth/2;
  }
    
  })
  .catch(e => {
      // tell the user something went wrong, e has the reason for why it failed
      console.error('something is wrong :c', e)
  })
  // let video = document.createElement('video');

  setInterval(()=> { 
    canvas = document.createElement('canvas');
    console.log("video width here", video.videoWidth);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx = canvas.getContext('2d');
    console.log(canvas.width);
    if (ctx) {
    ctx.drawImage(video, 0, 0);
    data = ctx.getImageData(0, 0,video.videoWidth,video.videoHeight);
   

    pixel = ctx.getImageData(target_x, target_y, 1, 1);
    const uintc8 = new Uint8ClampedArray([0,0,0,1]);

    let thiscolor = new ImageData(uintc8,1,1);
    ctx.putImageData(thiscolor, target_x, target_y);
    console.log(data?.data);
    let changeObject = document.getElementById("change");
    let rectangle = document.getElementById("rectangle");
    if (changeObject){
    changeObject.style.background = "rgba("+pixel.data+")";
    }
    }} ,1000);
    

//  console.log(video.videoWidth, video.videoHeight);

</script>

<main id="change">
  <h1 id="change">Seyan</h1>

  <p>{pixel?.data.toString()}</p>
    <!-- svelte-ignore a11y-media-has-caption -->
    <video autoplay bind:this={video}/>

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
    color: black;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
  #rectangle{
    width:200px;
    height:100px;
    background:blue;
  }
</style>
