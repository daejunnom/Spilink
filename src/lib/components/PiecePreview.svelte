<script lang="ts">
  export let cells: { x: number; y: number; color: string }[] = [];
  export let label = '미노';
</script>
<svg viewBox="0 0 100 58" role="img" aria-label={label}>
  {#each cells as cell}
    <rect x={10 + cell.x * 20} y={8 + cell.y * 20} width="18" height="18" rx="1.5" fill={cell.color} />
  {/each}
</svg>
<style>svg { display: block; width: 100%; max-width: 88px; margin: 0 auto; height: auto; }</style>
