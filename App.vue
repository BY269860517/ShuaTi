<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

onLaunch(() => {
  const wxRuntime = typeof wx !== 'undefined' ? wx : null
  if (wxRuntime?.cloud) {
    wxRuntime.cloud.init({ traceUser: true })
  }
})
</script>

<style lang="scss">
page {
  min-height: 100%;
  background: #f6f7f9;
  color: #18202f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
</style>
