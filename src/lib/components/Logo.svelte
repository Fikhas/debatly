<script lang="ts">
  let { light = false, small = false }: { light?: boolean; small?: boolean } = $props();
</script>

<a href="/" class:light class:small class="brand" aria-label="Callbate — beranda">
  <span class="brand-mark"
    ><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"
      ><path d="M7 7h23v18H18l-8 7v-7H7V7Z" fill="currentColor" /><path
        d="M23 19h12v15l-6-5h-6V19Z"
        fill="#FFB99F"
      /></svg
    ></span
  >
  <span>callbate<span class="brand-dot">.</span></span>
</a>
