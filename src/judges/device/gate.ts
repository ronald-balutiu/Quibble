// Which devices are offered the on-device judge (D-07, D-56): desktop-class
// browsers with a WebGPU adapter. Everything else sees model.unsupported and no offer.

interface GpuNavigator {
  gpu?: { requestAdapter: () => Promise<unknown> }
  userAgentData?: { mobile?: boolean }
  userAgent: string
}

const isMobile = (nav: GpuNavigator) => nav.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/u.test(nav.userAgent)

export async function deviceSupported(nav: GpuNavigator = navigator): Promise<boolean> {
  if (isMobile(nav) || !nav.gpu) return false
  try {
    return Boolean(await nav.gpu.requestAdapter())
  } catch {
    return false
  }
}
