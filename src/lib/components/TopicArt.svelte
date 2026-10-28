<script lang="ts">
  let { kind = 'building' }: { kind?: string } = $props();
</script>

<svg class="topic-art" viewBox="0 0 340 150" fill="none" aria-hidden="true">
  <ellipse cx="170" cy="137" rx="92" ry="7" fill="currentColor" opacity=".07" />
  <circle cx="170" cy="77" r="61" fill="currentColor" opacity=".06" />
  <path
    d="m72 43 3-8 3 8 8 3-8 3-3 8-3-8-8-3 8-3ZM261 91l2-6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"
    fill="currentColor"
    opacity=".4"
  />
  {#if kind === 'meal'}
    <rect
      x="101"
      y="47"
      width="139"
      height="76"
      rx="17"
      fill="#F8FCF7"
      stroke="currentColor"
      stroke-width="2.4"
    />
    <rect
      x="110"
      y="56"
      width="70"
      height="58"
      rx="10"
      fill="#E5EEDB"
      stroke="currentColor"
      stroke-width="1.7"
    />
    <path
      d="M120 99c0-29 48-29 48 0"
      fill="#FFFCED"
      stroke="currentColor"
      stroke-width="1.7"
    /><path
      d="m129 91 2-5m10 3 1-6m10 7 3-5"
      stroke="#B9BE99"
      stroke-width="2"
      stroke-linecap="round"
    />
    <rect
      x="188"
      y="56"
      width="43"
      height="25"
      rx="7"
      fill="#D0DEAF"
      stroke="currentColor"
      stroke-width="1.7"
    /><path d="m197 69 7-5 6 8 10-9" stroke="#758963" stroke-width="4" stroke-linecap="round" />
    <rect
      x="188"
      y="88"
      width="43"
      height="26"
      rx="7"
      fill="#FFCE9D"
      stroke="currentColor"
      stroke-width="1.7"
    /><circle cx="208" cy="101" r="8" fill="#E89C64" />
    <path
      d="M91 56v62m-7-62v19q4 7 8 0m-1-19h7v19q-3 7-7 0m162-19v62m0-62q14 16 0 28"
      stroke="currentColor"
      stroke-width="2.8"
      stroke-linecap="round"
    />
    <path
      d="m193 34 4-9m8 13 8-6m-33 1-2-9"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  {:else if kind === 'chart'}
    <rect
      x="108"
      y="91"
      width="27"
      height="35"
      rx="5"
      fill="#F3CCA7"
      stroke="currentColor"
      stroke-width="2"
    /><rect
      x="146"
      y="71"
      width="27"
      height="55"
      rx="5"
      fill="#F0B17A"
      stroke="currentColor"
      stroke-width="2"
    /><rect
      x="184"
      y="46"
      width="27"
      height="80"
      rx="5"
      fill="#DF9056"
      stroke="currentColor"
      stroke-width="2"
    />
    <path
      d="m105 72 44-25 24 6 47-31m-20 0h20v20"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="230" cy="111" r="21" fill="#FFF5D8" stroke="currentColor" stroke-width="2" /><path
      d="M235 103h-7a4 4 0 0 0 0 8h4a4 4 0 0 1 0 8h-8m6-20v24"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  {:else if kind === 'building'}
    <path
      d="m100 64 70-38 70 38H100Z"
      fill="#E9DDF0"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linejoin="round"
    />
    <path
      d="M105 70h130M98 125h144M105 116h130"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
    />
    {#each [113, 148, 183, 218] as x}<rect
        {x}
        y="75"
        width="10"
        height="36"
        rx="2"
        fill="#DCCBE7"
        stroke="currentColor"
        stroke-width="2"
      />{/each}
    <circle cx="170" cy="53" r="8" fill="#FBF8FC" stroke="currentColor" stroke-width="2" />
    <path
      d="M170 26V10m0 1h20l-5 7h-15"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
  {:else if kind === 'energy'}
    <path
      d="M155 66v62m-15 0h30M155 66l-40-30q-5-9 5-7l35 27m0 10 40-30q10-3 6 6l-38 25m-8-1-4 43q-3 9-7 0l3-43"
      stroke="currentColor"
      stroke-width="2.2"
      fill="#D6E7D9"
      stroke-linejoin="round"
    />
    <circle cx="154" cy="65" r="7" fill="#F1FAF0" stroke="currentColor" stroke-width="2" />
    <path
      d="m187 106 25-25 17 42h-48l6-17Z"
      fill="#BBD9D0"
      stroke="currentColor"
      stroke-width="2"
    /><path d="m194 102 24 1m-29 9h32m-18-23 5 34" stroke="currentColor" stroke-width="1.5" />
    <circle cx="227" cy="42" r="14" fill="#F4DB95" stroke="currentColor" stroke-width="2" /><path
      d="m227 19 0-5m23 28h5m-12-17 4-4"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  {:else if kind === 'phone'}
    <rect
      x="137"
      y="23"
      width="66"
      height="108"
      rx="12"
      transform="rotate(8 137 23)"
      fill="#F0F6FF"
      stroke="currentColor"
      stroke-width="2.3"
    /><path
      d="m151 36 33 5m-22 77 10 1"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
    />
    <rect
      x="176"
      y="51"
      width="57"
      height="36"
      rx="11"
      fill="#D2E0F5"
      stroke="currentColor"
      stroke-width="2"
    /><path
      d="m187 87 1 9 10-9"
      fill="#D2E0F5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    /><circle cx="190" cy="69" r="2" fill="currentColor" /><circle
      cx="204"
      cy="69"
      r="2"
      fill="currentColor"
    /><circle cx="218" cy="69" r="2" fill="currentColor" />
    <circle cx="117" cy="93" r="21" fill="#E8EFFB" stroke="currentColor" stroke-width="2" /><path
      d="m109 93 6 6 11-13"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {:else}
    <path
      d="M170 35v91m-21 0h42M123 54h94m-47-19-5-8h10l-5 8Z"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="m126 54-22 44h44l-22-44Zm88 0-22 44h44l-22-44Z"
      fill="#F8D8CE"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <path
      d="M104 98q22 29 44 0m44 0q22 29 44 0"
      fill="#E9AE9C"
      stroke="currentColor"
      stroke-width="2"
    />
    <circle cx="170" cy="52" r="5" fill="#FFF8F1" stroke="currentColor" stroke-width="2" />
  {/if}
</svg>
