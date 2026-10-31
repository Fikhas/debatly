<script lang="ts">
  let { light = false, small = false }: { light?: boolean; small?: boolean } = $props();
</script>

<a href="/" class:light class:small class="brand" aria-label="debatly. — beranda"
  ><img class="brand-image" src="/debatly-logo.png" alt="debatly." width="1600" height="1000" /></a
>

<style>
  .brand {
    flex-shrink: 0;
  }
  .brand-image {
    width: 125px;
    height: 78px;
    object-fit: contain;
    display: block;
  }
  .small .brand-image {
    width: 96px;
    height: 60px;
  }
  @media (max-width: 760px) {
    .brand-image {
      width: 100px;
      height: 62px;
    }
  }
</style>
