<script>
  import { onMount } from 'svelte';
  // import {videoStream} from './store.js'
  
  /**
   * @type {MediaStream}
   */
  var videothing;
  /**
   * @type {HTMLVideoElement | null}
   */
  let video = null;
  const mediaStream = window.navigator.mediaDevices.getUserMedia({video: true})
  .then(videoStream => {
     // yay we can now assign srcObject to videoStream
    if (video!=null) {
    video.srcObject = videoStream;}
  })
  .catch(e => {
      // tell the user something went wrong, e has the reason for why it failed
      console.error('something is wrong :c', e)
  })
  // let video = document.createElement('video');
  

</script>

<main>
  <h1>Color Tuner</h1>
  <p>
    Visit the <a href="https://svelte.dev/tutorial">Svelte tutorial</a> to learn
    how to build Svelte apps.
  </p>
    <!-- svelte-ignore a11y-media-has-caption -->
    <video autoplay bind:this={video}/>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
