import { derived, readable, writable } from 'svelte/store';
export const videoStream = readable(
    /** @type {MediaStream | null} */ (null),
    (set) => {
      window.navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(set)
        .catch((e) => console.error('Ooopsie woopsie', e));
    }
  );